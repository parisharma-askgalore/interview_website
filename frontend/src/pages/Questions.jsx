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
  const analyserRef = useRef(null);
  const audioContextRef = useRef(null);
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
        stopSpeakingImmediately();

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
        stopSpeakingImmediately();

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
  const stopSpeakingImmediately = () => {
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      speechCancelledRef.current = true; // flag so onend knows not to start recording
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
    // Mark that the current question needs to be replayed once fullscreen is restored
    needsReplayRef.current = true;
  };

  const playAIQuestion = async (text) => {
    try {
      if (window.speechSynthesis) {
        speechCancelledRef.current = false; // reset flag for new utterance
        const utter = new SpeechSynthesisUtterance(text);
        setSpeaking(true);
        utter.onend = () => {
          // Only start recording if the speech ended naturally (not cancelled by violation)
          if (!speechCancelledRef.current) {
            setSpeaking(false);
            startRecording();
          }
        };
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utter);
      } else {
        // If speechSynthesis isn't available, proceed to recording
        startRecording();
      }
    } catch (e) {
      console.error("speechSynthesis error:", e);
      startRecording();
    }
  };

  useEffect(() => {
    // Don't speak if the "Enter Fullscreen" overlay is still visible —
    // the user hasn't entered fullscreen yet so the interview shouldn't start.
    if (currentQuestion && !showEnterFullscreen) playAIQuestion(currentQuestion.question);
  }, [currentQuestion, showEnterFullscreen]);

  const startRecording = async () => {
    setLiveTranscript("");
    setStatus("Recording");
    try {
      const speechConfig = sdk.SpeechConfig.fromSubscription(
        import.meta.env.VITE_AZURE_SPEECH_KEY, "centralindia"
      );
      speechConfig.speechRecognitionLanguage = "en-US";
      const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
      let finalTranscript = "";

      recognizer.recognizing = (s, e) => setLiveTranscript(e.result.text);
      recognizer.recognized = (s, e) => {
        if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
          finalTranscript += " " + e.result.text;
          setLiveTranscript(finalTranscript);
        }
      };
      recognizer.startContinuousRecognitionAsync();
      recognizerRef.current = recognizer;
      transcriptRef.current = () => finalTranscript;

      isRecordingRef.current = true;
      setIsRecording(true);
      questionStartTimeRef.current = Date.now();

      questionTimerRef.current = setInterval(() => {}, 1000); // kept for stopRecording timing calc

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      detectSilence(stream);

      recordingTimeoutRef.current = setTimeout(() => {
        if (isRecordingRef.current) { console.warn("Recording timeout"); stopRecording(); }
      }, 30000);
    } catch (e) {
      console.error("Error starting recording:", e);
      isRecordingRef.current = false;
      setIsRecording(false);
      setStatus("Microphone error - retrying...");
      setTimeout(() => startRecording(), 2000);
    }
  };

  const detectSilence = (stream) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let voiceDetected = false;

      silenceTimeoutRef.current = setTimeout(() => {
        if (!voiceDetected) stopRecording();
      }, 5000);

      const checkVoice = () => {
        analyser.getByteFrequencyData(dataArray);
        const volume = dataArray.reduce((a, b) => a + b, 0);
        if (volume > 1000) { voiceDetected = true; clearTimeout(silenceTimeoutRef.current); }
        if (isRecordingRef.current) requestAnimationFrame(checkVoice);
      };
      checkVoice();
    } catch (e) { console.error("Error in detectSilence:", e); }
  };

  const stopRecording = async () => {
    clearInterval(questionTimerRef.current);
    const questionTimeTaken = Math.floor((Date.now() - questionStartTimeRef.current) / 1000);
    isRecordingRef.current = false;
    setIsRecording(false);
    if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
    if (recognizerRef.current) recognizerRef.current.stopContinuousRecognitionAsync();

    const transcript = transcriptRef.current ? transcriptRef.current() : "";
    const currentQ = questions[currentQuestionIndex];
    if (!currentQ) { console.error("Question not found"); return; }

    setStatus("Processing answer");

    try {
      await API.post(`/interview/${sessionId}/answer`, {
        questionIndex: currentQuestionIndex,
        questionText: currentQ.question,
        transcript,
        expectedAnswer: currentQ.answer,
        timeTaken: questionTimeTaken,
        isFollowUp: currentQ.isFollowUp || false,
        parentQuestion: currentQ.parentQuestion || null,
      });
    } catch (e) { console.error("Error submitting answer:", e); }

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
