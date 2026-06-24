import { useEffect, useRef, useState } from "react";
import API from "../api/interviewApi";
import { useNavigate } from "react-router-dom";
import styles from "../components/Questions.module.css";
import AvatarPlayer from "../components/interview/AvatarPlayer";
import UserCamera from "../components/interview/UserCamera";

import * as sdk from "microsoft-cognitiveservices-speech-sdk";

const IconMic = () => (
  <svg className={styles.micIcon} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="22"/>
  </svg>
);

const IconStop = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <rect x="4" y="4" width="16" height="16" rx="2"/>
  </svg>
);

const VIOLATION_LIMIT = 3;

function Questions() {
  const navigate = useNavigate();

  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState("Loading questions...");
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [fullscreenWarning, setFullscreenWarning] = useState(false);
  const sessionId = localStorage.getItem("sessionId");
  const fullscreenExitCountRef = useRef(Number(localStorage.getItem(`fullscreen_exits_${sessionId}`) || 0));
  const [liveTranscript, setLiveTranscript] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [showEnterFullscreen, setShowEnterFullscreen] = useState(() => {
    try { return !document.fullscreenElement && !localStorage.getItem(`fullscreen_ack_${localStorage.getItem('sessionId')}`); } catch (e) { return true; }
  });

  // FIX: removed readingTime / readingTimer countdown — recording starts automatically after bot finishes speaking

  const TOTAL = 10;

  const currentQuestion = questions[currentQuestionIndex];

  const recognizerRef = useRef(null);
  const transcriptRef = useRef(null);
  const streamRef = useRef(null);
  const silenceTimeoutRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const questionTimerRef = useRef(null);
  const questionStartTimeRef = useRef(null);
  const interviewStartTimeRef = useRef(Date.now());
  const recordingTimeoutRef = useRef(null);
  const isRecordingRef = useRef(false);
  // Tracks whether the current question needs to be replayed after fullscreen is restored
  const needsReplayRef = useRef(false);
  // Keep a always-current mirror of these inside event handlers that close over stale values
  const currentQuestionIndexRef = useRef(0);
  const questionsRef = useRef([]);
  const utteranceRef = useRef(null);
  const voiceDetectedRef = useRef(false);


  useEffect(() => {
    if (!sessionId) { navigate("/"); return; }
    fetchQuestions();
  }, []);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
    };
  }, [questions, currentQuestionIndex]);

  useEffect(() => {
    // Do NOT programmatically request fullscreen here because `requestFullscreen` must be initiated by a user gesture.
    // Show a user-facing button overlay to request fullscreen once per session.
    const lastViolationRef = { last: 0 };

    const handleFullscreenChange = async () => {
      // ── Fullscreen RE-ENTERED ──────────────────────────────────────────
      if (document.fullscreenElement) {
        if (needsReplayRef.current) {
          needsReplayRef.current = false;
          setFullscreenWarning(false);
          // Use refs — this handler closes over stale state from mount time
          const q = questionsRef.current[currentQuestionIndexRef.current];
          if (q) {
            setStatus("Preparing...");
            setLiveTranscript("");
            // Small delay so the overlay has time to hide before TTS starts
            setTimeout(() => playAIQuestion(q.question), 300);
          }
        }
        return;
      }

      // ── Fullscreen EXITED ──────────────────────────────────────────────
      if (!document.fullscreenElement) {
        // debounce duplicate events
        const now = Date.now();
        if (now - lastViolationRef.last < 1200) return;
        lastViolationRef.last = now;

        // Stop AI speech immediately — user left fullscreen
        stopSpeakingImmediately(true);

        try {
          // increment local defensive counter first
          fullscreenExitCountRef.current = (fullscreenExitCountRef.current || 0) + 1;
          localStorage.setItem(`fullscreen_exits_${sessionId}`, String(fullscreenExitCountRef.current));

          const response = await API.post(`/interview/${sessionId}/violation`, { type: "fullscreen_exit" });
          const count = response.data.counts?.fullscreen || fullscreenExitCountRef.current || 1;

          // If either server or local count indicates termination threshold reached, end interview
          if (response.data.terminated || count >= 2 || fullscreenExitCountRef.current >= 2) {
            console.warn("Fullscreen termination triggered", { serverTerminated: response.data.terminated, serverCount: count, localCount: fullscreenExitCountRef.current });
            alert("Interview ended due to repeated fullscreen exits.");
            // clear local counter
            localStorage.removeItem(`fullscreen_exits_${sessionId}`);
            setTimeout(() => navigate("/thankyou"), 0);
            return;
          }

          alert(`Fullscreen exit detected. Warning ${count}/2.`);
        } catch (e) {
          console.error("Violation error:", e);
          // fallback: use local counter to determine warnings/termination
          const localCount = (fullscreenExitCountRef.current || 0);
          if (localCount >= 2) {
            localStorage.removeItem(`fullscreen_exits_${sessionId}`);
            alert("Interview ended due to repeated fullscreen exits.");
            setTimeout(() => navigate("/thankyou"), 0);
            return;
          }
          alert(`Fullscreen exit detected. Warning ${localCount}/2.`);
        }

        // Only show overlay if still not fullscreen (user might have re-entered quickly)
        if (!document.fullscreenElement) setFullscreenWarning(true);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const handleEnterFullscreenClick = async () => {
    try {
      await document.documentElement.requestFullscreen();
      localStorage.setItem(`fullscreen_ack_${sessionId}`, '1');
      setShowEnterFullscreen(false);
    } catch (e) {
      console.error('requestFullscreen failed on user gesture:', e);
      setShowEnterFullscreen(false);
    }
  };

  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    const handleBack = () => {
      alert("Back navigation is disabled during the interview.");
      window.history.pushState(null, "", window.location.href);
    };
    window.addEventListener("popstate", handleBack);
    return () => window.removeEventListener("popstate", handleBack);
  }, []);

  useEffect(() => {
    const handleVisibility = async () => {
      if (document.hidden) {
        // Stop AI speech immediately — tab is hidden
        stopSpeakingImmediately(true);

        // Immediately register tab switch violation and terminate
        try {
          const response = await API.post(`/interview/${sessionId}/violation`, { type: "tab_switch" });
          // server enforces immediate termination for tab switches
          if (response.data.terminated) {
            alert("Interview ended due to tab switching.");
            localStorage.removeItem(`fullscreen_exits_${sessionId}`);
            setTimeout(() => navigate("/thankyou"), 0);
            return;
          }
          // fallback: navigate away
          alert("Tab switching detected. Interview will be terminated.");
          localStorage.removeItem(`fullscreen_exits_${sessionId}`);
          setTimeout(() => navigate("/thankyou"), 0);
        } catch (e) {
          console.error("Violation error:", e);
          alert("Tab switching detected. Interview will be terminated.");
          localStorage.removeItem(`fullscreen_exits_${sessionId}`);
          setTimeout(() => navigate("/thankyou"), 0);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const fetchQuestions = async () => {
    try {
      const response = await API.get("/interview/questions");
      questionsRef.current = response.data;
      setQuestions(response.data);
    } catch (e) { console.log(e); }
  };

  // Keep refs in sync with state so stale-closure handlers always read fresh values
  useEffect(() => { currentQuestionIndexRef.current = currentQuestionIndex; }, [currentQuestionIndex]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);

  // Ref to track whether we intentionally cancelled speech (e.g. violation) vs natural end
  const speechCancelledRef = useRef(false);

  /** Immediately silence TTS without triggering the normal "onend → startRecording" flow. */
  const stopSpeakingImmediately = (isViolation = false) => {
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      speechCancelledRef.current = true; // flag so onend knows not to start recording
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
    utteranceRef.current = null;
    if (isViolation) {
      // Mark that the current question needs to be replayed once fullscreen is restored
      needsReplayRef.current = true;
    }
  };

  const playAIQuestion = (text) => {
    // Cancel any ongoing speech first
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    speechCancelledRef.current = false;

    if (window.speechSynthesis) {
      const utter = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utter; // prevent garbage collection
      setSpeaking(true);
      utter.onend = () => {
        utteranceRef.current = null;
        if (!speechCancelledRef.current) {
          setSpeaking(false);
          // ONLY start recording AFTER TTS finishes
          startRecording();
        }
      };
      utter.onerror = (e) => {
        console.error("TTS error:", e);
        utteranceRef.current = null;
        setSpeaking(false);
        if (!speechCancelledRef.current) {
          startRecording();
        }
      };
      window.speechSynthesis.speak(utter);
    } else {
      // No TTS available — start recording immediately
      setSpeaking(false);
      startRecording();
    }
  };

  useEffect(() => {
    // Don't speak if the "Enter Fullscreen" overlay is still visible —
    // the user hasn't entered fullscreen yet so the interview shouldn't start.
    if (currentQuestion && !showEnterFullscreen) playAIQuestion(currentQuestion.question);
  }, [currentQuestion, showEnterFullscreen]);

const startRecording = async () => {
  // ─── Guard: prevent double-start ──────────────────────────────────────────
  if (isRecordingRef.current) {
    console.warn("startRecording called while already recording — skipping");
    return;
  }

  // ─── Guard: Azure credentials ─────────────────────────────────────────────
  const speechKey = import.meta.env.VITE_AZURE_SPEECH_KEY;
  const speechRegion = import.meta.env.VITE_AZURE_SPEECH_REGION;

  if (!speechKey || !speechRegion) {
    setStatus("Azure Speech credentials not configured");
    console.error("[Azure STT] Missing VITE_AZURE_SPEECH_KEY or VITE_AZURE_SPEECH_REGION");
    return;
  }

  setLiveTranscript("");
  setStatus("Requesting microphone...");
  voiceDetectedRef.current = false;

  // ─── Explicitly acquire microphone ─────────────────────────────────────────
  let mediaStream;
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
    const tracks = mediaStream.getAudioTracks();
    console.log(`[Azure STT] Microphone granted — ${tracks.length} audio track(s):`, tracks.map(t => t.label));
    if (tracks.length === 0) {
      setStatus("No microphone audio track available");
      return;
    }
  } catch (e) {
    console.error("[Azure STT] getUserMedia failed:", e);
    setStatus("Microphone access denied — allow mic access and reload");
    return;
  }

  streamRef.current = mediaStream;

  // ─── Azure Speech SDK setup ────────────────────────────────────────────────
  const speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion);
  speechConfig.speechRecognitionLanguage = "en-US";

  // 5-second initial silence → service will fire NoMatch
  speechConfig.setProperty(
    sdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs,
    "5000"
  );
  // 3-second end-of-speech silence
  speechConfig.setProperty(
    sdk.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs,
    "3000"
  );

  // Pass the explicit MediaStream to Azure SDK instead of fromDefaultMicrophoneInput
  // const audioConfig = sdk.AudioConfig.fromStreamInput(mediaStream);
  const audioConfig = sdk.AudioConfig.fromStreamInput(mediaStream);
  const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

  let finalTranscript = "";

  // ─── Live interim transcripts ──────────────────────────────────────────────
  recognizer.recognizing = (_s, e) => {
    if (e.result.reason === sdk.ResultReason.RecognizingSpeech) {
      voiceDetectedRef.current = true;
      // Clear initial silence timeout — user is speaking
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      // Reset end-of-speech silence timer (3s after last speech activity)
      silenceTimeoutRef.current = setTimeout(() => {
        if (isRecordingRef.current && voiceDetectedRef.current) {
          console.warn("[Azure STT] End-of-speech silence — auto-submitting");
          stopRecording();
        }
      }, 3000);

      setLiveTranscript((finalTranscript + e.result.text).trim());
      console.log("[Azure STT] Recognizing (interim):", e.result.text);
    }
  };

  // ─── Final recognized phrases ──────────────────────────────────────────────
  recognizer.recognized = (_s, e) => {
    if (e.result.reason === sdk.ResultReason.RecognizedSpeech && e.result.text) {
      voiceDetectedRef.current = true;
      finalTranscript += e.result.text + " ";
      console.log(finalTranscript,"final transcript )()()()(()()((")
      setLiveTranscript(finalTranscript.trim());
      console.log("[Azure STT] Recognized (final):", e.result.text);

      // Reset end-of-speech silence timer
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = setTimeout(() => {
        if (isRecordingRef.current && voiceDetectedRef.current) {
          console.warn("[Azure STT] End-of-speech silence — auto-submitting");
          stopRecording();
        }
      }, 3000);
    } else if (e.result.reason === sdk.ResultReason.NoMatch) {
      console.log("[Azure STT] NoMatch — no speech could be recognized");
      // If initial silence timeout from Azure service and no voice yet, auto-skip
      if (!voiceDetectedRef.current && isRecordingRef.current) {
        console.warn("[Azure STT] Azure NoMatch + no voice → auto-skipping");
        stopRecording();
      }
    }
  };

  // ─── Handle cancellation / errors ──────────────────────────────────────────
  recognizer.canceled = (_s, e) => {
    console.error("[Azure STT] Canceled:", sdk.CancellationReason[e.reason], e.errorDetails);
    if (e.reason === sdk.CancellationReason.Error) {
      setStatus(`Speech error: ${e.errorDetails || "unknown"}`);
      isRecordingRef.current = false;
      setIsRecording(false);
    }
    // If canceled due to no speech detected, auto-submit
    if (!voiceDetectedRef.current && isRecordingRef.current) {
      console.warn("[Azure STT] Canceled with no voice → auto-skipping");
      stopRecording();
    }
  };

  recognizer.sessionStarted = (_s, _e) => {
    console.log("[Azure STT] Session started (WebSocket connected)");
  };

  recognizer.sessionStopped = (_s, _e) => {
    console.log("[Azure STT] Session stopped");
  };

  // ─── Store refs ────────────────────────────────────────────────────────────
  recognizerRef.current = recognizer;
  transcriptRef.current = () => finalTranscript.trim();

  // ─── Start continuous recognition ──────────────────────────────────────────
  recognizer.startContinuousRecognitionAsync(
    () => {
      console.log("[Azure STT] Started continuous recognition");
      isRecordingRef.current = true;
      setIsRecording(true);
      setStatus("Recording — speak now");
      questionStartTimeRef.current = Date.now();

      // 5-second initial silence timeout (client-side backup)
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = setTimeout(() => {
        if (!voiceDetectedRef.current && isRecordingRef.current) {
          console.warn("[Azure STT] 5s silence timeout — no voice detected, auto-skipping");
          stopRecording();
        }
      }, 5000);

      // 30-second hard cap
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = setTimeout(() => {
        if (isRecordingRef.current) {
          console.warn("[Azure STT] 30s hard cap reached");
          stopRecording();
        }
      }, 30000);
    },
    (err) => {
      console.error("[Azure STT] Start failed:", err);
      setStatus("Could not start speech recognition — check microphone permissions");
      isRecordingRef.current = false;
      setIsRecording(false);
      // Release mic on failure
      if (mediaStream) mediaStream.getAudioTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  );
};

const stopRecording = () => {
  if (!isRecordingRef.current) return;

  // Flip state FIRST so event handlers don't re-trigger
  isRecordingRef.current = false;
  setIsRecording(false);
  setStatus("Processing...");

  clearTimeout(silenceTimeoutRef.current);
  clearTimeout(recordingTimeoutRef.current);
  clearInterval(questionTimerRef.current);

  const transcript = transcriptRef.current?.() ?? "";
  console.log("[stopRecording] Final transcript:", transcript);

  // Stop Azure recognizer
  const recognizer = recognizerRef.current;
  if (recognizer) {
    recognizerRef.current = null;
    recognizer.stopContinuousRecognitionAsync(
      () => {
        console.log("[Azure STT] Stopped");
        try { recognizer.close(); } catch (_e) { /* ignore */ }
      },
      (err) => {
        console.warn("[Azure STT] Stop error:", err);
        try { recognizer.close(); } catch (_e) { /* ignore */ }
      }
    );
  }

  // Release microphone stream
  if (streamRef.current) {
    streamRef.current.getAudioTracks().forEach(track => track.stop());
    streamRef.current = null;
    console.log("[Azure STT] Microphone released");
  }

  // Submit the answer and advance to next question
  submitAnswerAndNext(transcript);
};

  const submitAnswerAndNext = async (transcript) => {
    console.log(transcript,"____________________________@@@@@@")
    const question = questionsRef.current[currentQuestionIndexRef.current];
    if (!question) {
      moveNextQuestion();
      return;
    }

    const timeTaken = questionStartTimeRef.current
      ? Math.round((Date.now() - questionStartTimeRef.current) / 1000)
      : 0;

    setStatus("Processing answer");

    try {
      await API.post(`/interview/${sessionId}/answer`, {
        questionIndex: currentQuestionIndexRef.current,
        questionText: question.question,
        transcript: transcript || "(no response)",
        timeTaken,
        expectedAnswer: question.answer || "",
        isFollowUp: question.isFollowUp || false,
        parentQuestion: question.parentQuestion || null,
      });
      console.log("[submitAnswer] Answer submitted successfully");
    } catch (e) {
      console.error("[submitAnswer] Failed to submit answer:", e);
    }

    moveNextQuestion();
  };  
  const moveNextQuestion = async () => {
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex >= TOTAL) {
      setStatus("Completing interview...");
      try {
        await API.post(`/interview/${sessionId}/complete`);
        localStorage.removeItem(`fullscreen_exits_${sessionId}`);
        setTimeout(() => navigate("/thankyou"), 500);
      } catch (e) { setTimeout(() => navigate("/thankyou"), 500); }
      return;
    }
    if (currentQuestionIndex >= 1 && questions.length < nextIndex + 1) {
      setIsGeneratingQuestion(true);
      try {
        const response = await API.post(`/interview/${sessionId}/generate-question`);
        const aiQuestion = {
          question: response.data.question,
          answer: response.data.expectedAnswer,
          aiGenerated: true,
          isFollowUp: response.data.type === "followup",
          reason: response.data.reason,
        };
        setQuestions(prev => [...prev, aiQuestion]);
      // reset transient status so the next question can show speaking state
      setStatus("Preparing...");
      setCurrentQuestionIndex(nextIndex);
      } catch (e) { console.log("Error generating question:", e); setIsGeneratingQuestion(false); }
    }
    setCurrentQuestionIndex(nextIndex);
  };

  /* ── Loading screen ── */
  if (questions.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>
          <div className={styles.loadingSpinner} />
          Loading questions…
        </div>
      </div>
    );
  }

  const progressPct = ((currentQuestionIndex + 1) / 10) * 100;

  const renderStatus = () => {
    // Show speaking state first to ensure TTS UI appears even while status briefly says Processing
    if (speaking) {
      return (
        <div className={styles.speakingWrap}>
          <div className={styles.speakingBars}>
            <span /><span /><span /><span /><span />
          </div>
          <span className={styles.speakingLabel}>AI is speaking…</span>
        </div>
      );
    }

    if (status === "Completing interview..." || isGeneratingQuestion || status === "Processing answer") {
      return (
        <div className={styles.processingWrap}>
          <div className={styles.processingSpinner} />
          <span className={styles.processingLabel}>
            {status === "Completing interview..."
              ? "Thank you for your time! Uploading your answers…"
              : isGeneratingQuestion
              ? "Loading next question…"
              : "Processing your answer…"}
          </span>
        </div>
      );
    }
    if (isRecording) {
      return (
        <div className={styles.recordingWrap}>
          <div className={styles.micRing}><IconMic /></div>
          <span className={styles.recordingLabel}>
            <span className={styles.recDot} /> Recording
          </span>
        </div>
      );
    }
    // FIX: instead of countdown timer, show "AI Speaking" state while bot talks (handled above)
    // Waiting state (between speaking ending and recording starting)
    return (
      <div className={styles.processingWrap}>
        <div className={styles.processingSpinner} />
        <span className={styles.processingLabel}>Preparing…</span>
      </div>
    );
  };

  return (
    <div className={styles.page}>

      {/* ── Top progress bar ── */}
      <div className={styles.topBar}>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
        </div>
        <div className={styles.counter}>
          Q{currentQuestionIndex + 1} <span>/ 10</span>
        </div>
      </div>

      {/* ── Google Meet-style layout ── */}
      <div className={styles.meetLayout}>

        {/* LEFT: Video panels stacked vertically */}
        <div className={styles.videoPanels}>

          {/* AI Interviewer tile */}
          <div className={`${styles.videoTile} ${styles.videoTileAI} ${speaking ? styles.speakingActive : ""}`}>
            {/* FIX: AvatarPlayer directly inside tile — fills 100% width/height */}
            <AvatarPlayer speaking={speaking} />
            <div className={styles.videoLabel}>
              <span className={`${styles.videoLabelDot} ${styles.blue}`} />
              AI Interviewer
            </div>
          </div>

          {/* User tile — FIX: UserCamera rendered here instead of placeholder SVG */}
          <div className={`${styles.videoTile} ${styles.videoTileUser} ${isRecording ? styles.recordingActive : ""}`}>
            <UserCamera />
            <div className={styles.videoLabel}>
              <span className={`${styles.videoLabelDot} ${isRecording ? styles.orange : styles.blue}`} />
              You
            </div>
          </div>

        </div>

        {/* RIGHT: Question + controls */}
        <div className={styles.questionPanel}>

          <p className={styles.questionLabel}>
            {questions[currentQuestionIndex]?.isFollowUp
              ? "Follow-up Question"
              : `Question ${currentQuestionIndex + 1}`}
          </p>

          <h2 className={styles.questionText}>
            {questions[currentQuestionIndex]?.question || "Loading next question..."}
          </h2>

          {/* FIX: removed timerRow entirely */}

          {/* Status area */}
          <div className={styles.statusArea}>
            {renderStatus()}
          </div>

          {/* Live Transcript — only shown when recording */}
          {(isRecording || liveTranscript) && (
            <div className={styles.transcriptBox}>
              <div className={styles.transcriptLabel}>Live Transcript</div>
              <div className={`${styles.transcriptText} ${!liveTranscript ? styles.listening : ""}`}>
                {liveTranscript || "Listening..."}
              </div>
            </div>
          )}

          {/* Stop button */}
          {isRecording && (
            <button className={styles.stopBtn} onClick={stopRecording}>
              <span className={styles.btnInner}>
                <IconStop />
                Stop Recording &amp; Next
              </span>
            </button>
          )}

        </div>
      </div>

      {/* ── Fullscreen warning overlay ── */}
      {fullscreenWarning && (
        <div className={styles.warningOverlay}>
          <div className={styles.warningCard}>
            <div className={styles.warningIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h2 className={styles.warningTitle}>Fullscreen Required</h2>
            <p className={styles.warningText}>Please re-enter fullscreen mode to continue the interview.</p>
            <button
              className={styles.stopBtn}
              onClick={async () => {
                await document.documentElement.requestFullscreen();
                setFullscreenWarning(false);
              }}
            >
              Re-enter Fullscreen
            </button>
          </div>
        </div>
      )}

      {/* ── Enter fullscreen overlay (user gesture required) ── */}
      {showEnterFullscreen && (
        <div className={styles.enterFullscreenOverlay}>
          <div className={styles.enterCard}>
            <h2 className={styles.enterTitle}>Enter Fullscreen</h2>
            <p className={styles.enterText}>Please click the button below to enter fullscreen for the best interview experience.</p>
            <button className={styles.stopBtn} onClick={handleEnterFullscreenClick}>Enter Fullscreen</button>
          </div>
        </div>
      )}

    </div>
  );
}

export default Questions;
