import { useEffect, useRef, useState } from "react";
import API from "../api/interviewApi";
import { useNavigate } from "react-router-dom";
import styles from "../components/Questions.module.css";
import InterviewStage from "../components/interview/InterviewStage";

import * as sdk from "microsoft-cognitiveservices-speech-sdk";

const IconMic = () => (
  <svg className={styles.micIcon} width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="22"/>
  </svg>
);

const IconStop = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <rect x="4" y="4" width="16" height="16" rx="2"/>
  </svg>
);

// Violation threshold before the interview is terminated
const VIOLATION_LIMIT = 3;

function Questions() {
  const navigate = useNavigate();

  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [readingTime, setReadingTime] = useState(5);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState("Loading questions...");
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [fullscreenWarning, setFullscreenWarning] = useState(false);
  const [questionTimer, setQuestionTimer] = useState(0);

  const [totalTimer, setTotalTimer] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [speaking, setSpeaking] = useState(false);

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

  const totalTimerRef = useRef(null);

  const questionStartTimeRef = useRef(null);

  const interviewStartTimeRef = useRef(Date.now());
  const recordingTimeoutRef = useRef(null);

  // FIX 3: Ref that mirrors isRecording state so closures (e.g. detectSilence)
  // always read the current value instead of a stale snapshot.
  const isRecordingRef = useRef(false);

  // FIX 5: Guard against missing sessionId — redirect to home if not found.
  const sessionId = localStorage.getItem("sessionId");

  useEffect(() => {
    if (!sessionId) {
      navigate("/");
      return;
    }
    fetchQuestions();
  }, []);

  useEffect(() => {
    if (questions.length > 0) {
      startReadingTimer();
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
    };
  }, [questions, currentQuestionIndex]);

  useEffect(() => {
    const enterFullscreen = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch (error) {
        console.log(error);
      }
    };

    enterFullscreen();

    const handleFullscreenChange = async () => {
      if (!document.fullscreenElement) {
        // FIX 2: Only one alert for fullscreen exit (removed the duplicate at the bottom).
        // FIX 4: Only terminate after VIOLATION_LIMIT violations, not on the very first one.
        setViolationCount(prev => {
          const updated = prev + 1;

          if (updated >= VIOLATION_LIMIT) {
            alert("Interview ended due to repeated violations.");
            setTimeout(() => navigate("/thankyou"), 0);
          } else {
            alert(`Fullscreen exit detected. Warning ${updated}/${VIOLATION_LIMIT}.`);
          }

          return updated;
        });

        try {
          const response = await API.post(
            `/interview/${sessionId}/violation`,
            { type: "fullscreen_exit" }
          );

          if (response.data.terminated) {
            alert("Interview ended due to cheating detection.");
            setTimeout(() => navigate("/thankyou"), 0);
            return;
          }
        } catch (error) {
          console.error("Violation error:", error);
        }

        setFullscreenWarning(true);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {

    totalTimerRef.current =
      setInterval(() => {

        const seconds = Math.floor(

          (Date.now() -
            interviewStartTimeRef.current)

          / 1000
        );

        setTotalTimer(seconds);

      }, 1000);

    return () => {

      clearInterval(
        totalTimerRef.current
      );
    };

  }, []);

  useEffect(() => {
    window.history.pushState(null, "", window.location.href);

    const handleBackButton = () => {
      alert("Back navigation is disabled during the interview.");
      window.history.pushState(null, "", window.location.href);
    };

    window.addEventListener("popstate", handleBackButton);

    return () => {
      window.removeEventListener("popstate", handleBackButton);
    };
  }, []);

  useEffect(() => {
    const handleVisibility = async () => {
      if (document.hidden) {
        // FIX 2 & 4: Single alert, only terminate after VIOLATION_LIMIT violations.
        setViolationCount(prev => {
          const updated = prev + 1;

          if (updated >= VIOLATION_LIMIT) {
            alert("Interview ended due to repeated violations.");
            setTimeout(() => navigate("/thankyou"), 0);
          } else {
            alert(`Tab switching detected. Warning ${updated}/${VIOLATION_LIMIT}.`);
          }

          return updated;
        });

        try {
          const response = await API.post(
            `/interview/${sessionId}/violation`,
            { type: "tab_switch" }
          );

          if (response.data.terminated) {
            alert("Interview ended due to cheating detection.");
            setTimeout(() => navigate("/thankyou"), 0);
          }
        } catch (error) {
          console.error("Violation error:", error);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const fetchQuestions = async () => {
    try {
      const response = await API.get("/interview/questions");
      setQuestions(response.data);
    } catch (error) {
      console.log(error);
    }
  };

  const startReadingTimer = () => {
    setReadingTime(5);
    setStatus("Read the question carefully");

    let timer = 5;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    timerIntervalRef.current = setInterval(() => {
      timer--;
      setReadingTime(timer);

      if (timer <= 0) {
        clearInterval(timerIntervalRef.current);
        startRecording();
      }
    }, 1000);
  };

  const playAIQuestion = async (text) => {
  try {
    const response = await fetch(
      "http://localhost:5000/api/tts",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      }
    );

    const audioBlob = await response.blob();

    const audioUrl = URL.createObjectURL(audioBlob);

    const audio = new Audio(audioUrl);

    audio.onplay = () => {
      setSpeaking(true);
    };

    audio.onended = () => {
      setSpeaking(false);

      URL.revokeObjectURL(audioUrl);
    };

    audio.preload = "auto";
    await audio.play();
  } catch (error) {
    console.error(error);
  }
};

useEffect(() => {
  if (currentQuestion) {
    playAIQuestion(currentQuestion.question);
  }
}, [currentQuestion]);

  const startRecording = async () => {
    setLiveTranscript("");
    try {
      const speechConfig = sdk.SpeechConfig.fromSubscription(
        import.meta.env.VITE_AZURE_SPEECH_KEY,
        "centralindia"
      );

      speechConfig.speechRecognitionLanguage = "en-US";

      const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();

      const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

      let finalTranscript = "";

      recognizer.recognizing = (s, e) => {
        setLiveTranscript(e.result.text);
      };

      recognizer.recognized = (s, e) => {
        if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
          finalTranscript += " " + e.result.text;
          setLiveTranscript(finalTranscript);
        }
      };

      recognizer.startContinuousRecognitionAsync();

      recognizerRef.current = recognizer;
      transcriptRef.current = () => finalTranscript;

      // FIX 3: Keep the ref in sync when setting recording state to true.
      isRecordingRef.current = true;
      setIsRecording(true);

      questionStartTimeRef.current =
      Date.now();

    setQuestionTimer(0);

    questionTimerRef.current =
      setInterval(() => {

        const seconds = Math.floor(

          (Date.now() -
            questionStartTimeRef.current)

          / 1000
        );

        setQuestionTimer(seconds);

      }, 1000);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      detectSilence(stream);

      // 30-second timeout fallback
      recordingTimeoutRef.current = setTimeout(() => {
        if (isRecordingRef.current) {
          console.warn("Recording timeout - auto-submitting answer");
          stopRecording();
        }
      }, 30000);
    } catch (error) {
      console.error("Error starting recording:", error);
      isRecordingRef.current = false;
      setIsRecording(false);
      setStatus("Microphone error - retrying...");

      setTimeout(() => {
        startRecording();
      }, 2000);
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
        if (!voiceDetected) {
          stopRecording();
        }
      }, 5000);

      const checkVoice = () => {
        analyser.getByteFrequencyData(dataArray);

        const volume = dataArray.reduce((a, b) => a + b, 0);

        if (volume > 1000) {
          voiceDetected = true;
          clearTimeout(silenceTimeoutRef.current);
        }

        // FIX 3: Use isRecordingRef.current instead of the stale isRecording
        // state variable so the rAF loop keeps running correctly after mount.
        if (isRecordingRef.current) {
          requestAnimationFrame(checkVoice);
        }
      };

      checkVoice();
    } catch (error) {
      console.error("Error in detectSilence:", error);
    }
  };

  const stopRecording = async () => {
    // FIX 3: Keep ref in sync when stopping.
    clearInterval(
      questionTimerRef.current
    );

    const questionTimeTaken =
      Math.floor(

        (Date.now() -
          questionStartTimeRef.current)

        / 1000
      );
    isRecordingRef.current = false;
    setIsRecording(false);

    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
    }

    if (recognizerRef.current) {
      recognizerRef.current.stopContinuousRecognitionAsync();
    }

    const transcript = transcriptRef.current ? transcriptRef.current() : "";

    const currentQuestion = questions[currentQuestionIndex];

    if (!currentQuestion) {
      console.error("Current question not found");
      return;
    }

    try {
      await API.post(`/interview/${sessionId}/answer`, {
        questionIndex: currentQuestionIndex,
        questionText: currentQuestion.question,
        transcript,
        expectedAnswer: currentQuestion.answer,
        timeTaken: questionTimeTaken,
        isFollowUp: currentQuestion.isFollowUp || false,
        parentQuestion: currentQuestion.parentQuestion || null,
      });
    } catch (error) {
      console.error("Error submitting answer:", error);
    }

    moveNextQuestion();
  };

  // FIX 1: Removed dead uploadAnswer function and unused mediaRecorderRef /
  // audioChunksRef — the Azure Speech SDK transcript path is the active one.

  const moveNextQuestion = async () => {
    setQuestionTimer(0);
    const nextIndex = currentQuestionIndex + 1;

    if (nextIndex >= TOTAL) {
      setStatus("Completing interview...");

      try {
        await API.post(`/interview/${sessionId}/complete`);
        setTimeout(() => navigate("/thankyou"), 500);
      } catch (error) {
        console.error("Error completing interview:", error);
        setTimeout(() => navigate("/thankyou"), 500);
      }
      return;
    }

    if (currentQuestionIndex >= 1 && questions.length < nextIndex + 1) {
      setIsGeneratingQuestion(true);
      try {
        const response = await API.post(
          `/interview/${sessionId}/generate-question`
        );

        const aiQuestion = {
          question: response.data.question,
          answer: response.data.expectedAnswer,
          aiGenerated: true,
          isFollowUp:
            response.data.type === "followup",
          reason:
            response.data.reason
        };

        setQuestions(prev => [...prev, aiQuestion]);
        setIsGeneratingQuestion(false);
      } catch (error) {
        console.log("Error generating question:", error);
        setIsGeneratingQuestion(false);
      }
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

  /* ── Progress values ── */
  const progressPct = ((currentQuestionIndex + 1) / 10) * 100;
  const ringOffset = 176 - (176 * (readingTime / 5));

  /* ── Status area content ── */
  const renderStatus = () => {
    if (status === "Completing interview...") {
      return (
        <div className={styles.processingWrap}>
          <div className={styles.processingSpinner} />
          <span className={styles.processingLabel}>
            Thank you for your time! Hold on while we upload your answers…
          </span>
        </div>
      );
    }
    if (isGeneratingQuestion) {
      return (
        <div className={styles.processingWrap}>
          <div className={styles.processingSpinner} />
          <span className={styles.processingLabel}>Loading next question…</span>
        </div>
      );
    }
    if (status === "Processing answer") {
      return (
        <div className={styles.processingWrap}>
          <div className={styles.processingSpinner} />
          <span className={styles.processingLabel}>Processing your answer…</span>
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
    return (
      <div className={styles.countdownWrap}>
        <div className={styles.ring}>
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle className={styles.ringTrack} cx="32" cy="32" r="28" />
            <circle
              className={styles.ringFill}
              cx="32" cy="32" r="28"
              style={{ strokeDashoffset: ringOffset }}
            />
          </svg>
          <div className={styles.ringNumber}>{readingTime}</div>
        </div>
        <span className={styles.countdownLabel}>Recording begins in…</span>
      </div>
    );
  };

  if (fullscreenWarning) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h2>Fullscreen Required</h2>
          <p>Please re-enter fullscreen mode to continue the interview.</p>
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
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        {/* Progress bar */}
        <div className={styles.topBar}>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
          </div>
          <div className={styles.counter}>
            Q{currentQuestionIndex + 1} <span>/ 10</span>
          </div>
        </div>
        <InterviewStage speaking={speaking} />
        {/* Question */}
        <p className={styles.questionLabel}>
          {
            questions[currentQuestionIndex]?.isFollowUp
              ? "Follow-up Question"
              : `Question ${currentQuestionIndex + 1}`
          }
        </p>
        <h2 className={styles.questionText}>
          {questions[currentQuestionIndex]?.question || "Loading next question..."}
        </h2>

        <div className={styles.timerRow}>
          <div className={styles.timerBox}>
            Question Time: {questionTimer}s
          </div>
          <div className={styles.timerBox}>
            Total Time: {Math.floor(totalTimer / 60)}m {totalTimer % 60}s
          </div>
        </div>

        {/* Status area */}
        <div className={styles.statusArea}>
          {renderStatus()}
        </div>

        {/* Live Transcript */}
        {(isRecording || liveTranscript) && (
          <div style={{
            width: "100%",
            marginTop: "24px",
            padding: "18px",
            borderRadius: "14px",
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            textAlign: "left",
            boxSizing: "border-box",
          }}>
            <div style={{
              fontSize: "12px",
              fontWeight: "700",
              letterSpacing: "1px",
              textTransform: "uppercase",
              opacity: 0.7,
              marginBottom: "10px",
            }}>
              Live Transcript
            </div>
            <div style={{
              fontSize: "15px",
              lineHeight: "1.7",
              color: "#ffffff",
              minHeight: "48px",
            }}>
              {liveTranscript || "Listening..."}
            </div>
          </div>
        )}

        {/* Stop & Next button — only shown while recording */}
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
  );
}

export default Questions;
