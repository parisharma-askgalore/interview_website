import { useEffect, useRef, useState } from "react";
import API from "../api/interviewApi";
import { useNavigate } from "react-router-dom";
import styles from "../components/Questions.module.css";

import * as sdk from
"microsoft-cognitiveservices-speech-sdk";

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


function Questions() {
    const navigate = useNavigate();

const [questions, setQuestions] = useState([]);

const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

const [readingTime, setReadingTime] = useState(5);

const [isRecording, setIsRecording] = useState(false);

const [status, setStatus] = useState("Loading questions...");

const TOTAL = 10;

const mediaRecorderRef = useRef(null);

const recognizerRef = useRef(null);

const transcriptRef = useRef(null);

const audioChunksRef = useRef([]);

const streamRef = useRef(null);

const silenceTimeoutRef = useRef(null);

const analyserRef = useRef(null);

const audioContextRef = useRef(null);

const sessionId = localStorage.getItem("sessionId");

const [violationCount,
setViolationCount] =
useState(0);

const [
  fullscreenWarning,
  setFullscreenWarning
] = useState(false);

useEffect(() => {

  fetchQuestions();

}, []);

useEffect(() => {

  if (questions.length > 0) {

    startReadingTimer();

  }

}, [questions, currentQuestionIndex]);

useEffect(() => {

  const enterFullscreen = async () => {

    try {

      if (
        !document.fullscreenElement
      ) {

        await document.documentElement
          .requestFullscreen();

      }

    } catch (error) {

      console.log(error);

    }
  };

  enterFullscreen();

  const handleFullscreenChange =
    async () => {

      if (
        !document.fullscreenElement
      ) {

        const response =
          await API.post(

            `/interview/${sessionId}/violation`,

            {
              type:
                "fullscreen_exit"
            }
          );

        if (
          response.data.terminated
        ) {

          alert(
            "Interview ended due to cheating detection."
          );

          navigate("/thankyou");

          return;
        }

        setFullscreenWarning(true);
      }
    };

  document.addEventListener(

    "fullscreenchange",

    handleFullscreenChange
  );

  if (fullscreenWarning) {

  return (

    <div className={styles.page}>

      <div className={styles.card}>

        <h2>
          Fullscreen Required
        </h2>

        <p>
          Please re-enter fullscreen
          mode to continue the
          interview.
        </p>

        <button

          onClick={async () => {

            await document
              .documentElement
              .requestFullscreen();

            setFullscreenWarning(
              false
            );
          }}
        >
          Re-enter Fullscreen
        </button>

      </div>

    </div>
  );
}

  return () => {

    document.removeEventListener(

      "fullscreenchange",

      handleFullscreenChange
    );

  };

}, []);

useEffect(() => {

  window.history.pushState(
    null,
    "",
    window.location.href
  );

  const handleBackButton = () => {

    alert(
      "Back navigation is disabled during the interview."
    );

    window.history.pushState(
      null,
      "",
      window.location.href
    );
  };

  window.addEventListener(
    "popstate",
    handleBackButton
  );

  return () => {

    window.removeEventListener(
      "popstate",
      handleBackButton
    );

  };

}, []);

useEffect(() => {

  const handleVisibility = async () => {

    if (document.hidden) {

      const response =
        await API.post(

          `/interview/${sessionId}/violation`,

          {
            type:
              "tab_switch"
          }
        );

      if (response.data.terminated) {

        alert(
          "Interview ended due to cheating detection."
        );

        navigate("/thankyou");

      } else {

        alert(
          "Tab switching detected."
        );
      }
    }
  };

  document.addEventListener(
    "visibilitychange",
    handleVisibility
  );

  return () => {

    document.removeEventListener(
      "visibilitychange",
      handleVisibility
    );

  };

}, []);

const fetchQuestions = async () => {

  try {

    const response =
      await API.get("/interview/questions");

    setQuestions(response.data);

  } catch (error) {

    console.log(error);

  }
};

const startReadingTimer = () => {

  setReadingTime(5);

  setStatus("Read the question carefully");

  let timer = 5;

  const interval = setInterval(() => {

    timer--;

    setReadingTime(timer);

    if (timer <= 0) {

      clearInterval(interval);

      startRecording();

    }

  }, 1000);
};

const startRecording = async () => {

  try {

    const speechConfig =
      sdk.SpeechConfig.fromSubscription(

        import.meta.env.VITE_AZURE_SPEECH_KEY,

        "centralindia"
      );

    speechConfig.speechRecognitionLanguage =
      "en-US";

    const audioConfig =
      sdk.AudioConfig.fromDefaultMicrophoneInput();

    const recognizer =
      new sdk.SpeechRecognizer(

        speechConfig,

        audioConfig
      );

    let finalTranscript = "";

    recognizer.recognizing = (s, e) => {

      console.log("Partial:", e.result.text);

    };

    recognizer.recognized = (s, e) => {

      if (
        e.result.reason ===
        sdk.ResultReason.RecognizedSpeech
      ) {

        finalTranscript +=
          " " + e.result.text;

      }
    };

    recognizer.startContinuousRecognitionAsync();

    recognizerRef.current =
      recognizer;

    transcriptRef.current =
      () => finalTranscript;

    setIsRecording(true);

  } catch (error) {

    console.log(error);

  }
};

const detectSilence = (stream) => {

  const audioContext = new AudioContext();

  audioContextRef.current =
    audioContext;

  const analyser =
    audioContext.createAnalyser();

  analyserRef.current = analyser;

  const microphone =
    audioContext.createMediaStreamSource(stream);

  microphone.connect(analyser);

  const dataArray =
    new Uint8Array(analyser.frequencyBinCount);

  let voiceDetected = false;

  silenceTimeoutRef.current =
    setTimeout(() => {

      if (!voiceDetected) {

        stopRecording();

      }

    }, 5000);

  const checkVoice = () => {

    analyser.getByteFrequencyData(dataArray);

    const volume =
      dataArray.reduce((a, b) => a + b, 0);

    if (volume > 1000) {

      voiceDetected = true;

      clearTimeout(silenceTimeoutRef.current);

    }

    if (isRecording) {

      requestAnimationFrame(checkVoice);

    }
  };

  checkVoice();
};
  
    const stopRecording = async () => {

        setIsRecording(false);

        recognizerRef.current
          .stopContinuousRecognitionAsync();

        const transcript =
          transcriptRef.current();

        await API.post(

          `/interview/${sessionId}/answer`,

          {

            questionIndex:
              currentQuestionIndex,

            questionText:
              questions[currentQuestionIndex]
                .question,

            transcript,

            expectedAnswer:
              questions[currentQuestionIndex]
                .answer

          }

        );

        moveNextQuestion();
      };
  
    const uploadAnswer = async (audioBlob) => {
      try {
        const formData = new FormData();
        formData.append("audio", audioBlob);
        formData.append("questionIndex", currentQuestionIndex);
        formData.append("questionText", questions[currentQuestionIndex].question);
        await API.post(`/interview/${sessionId}/answer`, formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        moveNextQuestion();
      } catch (error) {
        console.log(error);
      }
    };

  
    const moveNextQuestion = async () => {
      if (
          currentQuestionIndex >= 2
          &&
          questions.length < 10
        ) {

          const response =
            await API.post(

              `/interview/${sessionId}/generate-question`
            );

          setQuestions(prev => [

            ...prev,

            {
              question:
                response.data.question,

              answer:
                response.data.expectedAnswer,

              aiGenerated: true
            }
          ]);
        }

      if (currentQuestionIndex + 1 >= questions.length) {

        setStatus("Finalizing interview...");

        await API.post(
          `/interview/${sessionId}/complete`
        );

        navigate("/thankyou");

        return;
      }
      setCurrentQuestionIndex(prev => prev + 1);
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
    const progressPct = ((currentQuestionIndex) / questions.length) * 100;
    /* SVG ring: circumference ≈ 176, dashoffset = 176 - (176 * fraction) */
    const ringOffset  = 176 - (176 * (readingTime / TOTAL));
  
    /* ── Status area content ── */
    const renderStatus = () => {
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
  
    return (
      <div className={styles.page}>
        <div className={styles.card}>
  
          {/* Progress bar */}
          <div className={styles.topBar}>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
            </div>
            <div className={styles.counter}>
              Q{currentQuestionIndex + 1} <span>/ {questions.length}</span>
            </div>
          </div>
  
          {/* Question */}
          <p className={styles.questionLabel}>Question {currentQuestionIndex + 1}</p>
          <h2 className={styles.questionText}>
            {questions[currentQuestionIndex].question}
          </h2>
  
          {/* Status area */}
          <div className={styles.statusArea}>
            {renderStatus()}
          </div>
  
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