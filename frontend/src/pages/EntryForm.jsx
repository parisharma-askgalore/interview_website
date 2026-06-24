import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";
import API from "../api/interviewApi";
import DeviceCheck from "../components/DeviceCheck";
import styles from "../components/StartForm.module.css";

export default function StartForm() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  
  const [details, setDetails] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const [deviceReady, setDeviceReady] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [isEarly, setIsEarly] = useState(false);

  // Fetch interview details on mount
  useEffect(() => {
    if (!token) return;

    const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787/api/v1/interview-sessions";
    const joinUrl = baseURL.replace('/interview-sessions', '/interviews/join');

    const fetchDetails = async () => {
      try {
        const res = await axios.get(`${joinUrl}/${token}`);
        setDetails(res.data);
      } catch (err) {
        setError(err.response?.data?.error || "Failed to fetch interview details. Link might be invalid or expired.");
      }
    };
    fetchDetails();
  }, [token]);

  // Countdown timer logic
  useEffect(() => {
    if (!details || !details.scheduledAt) return;

    const checkTime = () => {
      const now = new Date().getTime();
      const scheduled = new Date(details.scheduledAt).getTime();
      const diffSeconds = Math.floor((scheduled - now) / 1000);

      if (diffSeconds > 0) {
        setIsEarly(true);
        setTimeRemaining(diffSeconds);
      } else {
        setIsEarly(false);
        setTimeRemaining(0);
      }
    };

    // Initial check
    checkTime();

    // Setup interval
    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  }, [details]);

  const formatTime = (totalSeconds) => {
    if (totalSeconds === null || totalSeconds < 0) return "00:00";
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setError("No interview token found in URL. Please use the link provided in your email.");
      return;
    }
    if (isEarly) {
      setError("It is not time for your interview yet.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await API.post("/start", { token });
      
      // The Hono backend returns session_id, position, etc.
      localStorage.setItem("sessionId", response.data.session_id);
      localStorage.setItem("position", response.data.position || "");
      
      navigate("/instructions");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to start interview. Please check your link or contact HR.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.badge}>Interview Portal</div>
          <h1 className={styles.title}>
            <span>Candidate</span> Application
          </h1>
          <p className={styles.subtitle}>
            {details ? `Welcome, ${details.candidateName}` : "Verify your details to begin."}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className={styles.form}>

          {error && (
            <div style={{ color: '#ef4444', background: '#fee2e2', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', border: '1px solid #fca5a5' }}>
              {error}
            </div>
          )}

          {!token ? (
            <div className={styles.field} style={{ textAlign: 'center', color: '#ef4444', marginBottom: '24px' }}>
              <p>Missing interview token. Please use the link from your email.</p>
            </div>
          ) : !details && !error ? (
            <div className={styles.field} style={{ textAlign: 'center', color: '#cbd5e1', marginBottom: '24px' }}>
              <p>Loading interview details...</p>
            </div>
          ) : details && (
            <>
              {/* Interview Info */}
              <div style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '8px', marginBottom: '20px', color: '#e2e8f0', fontSize: '14px', border: '1px solid #334155' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#94a3b8' }}>Position:</span>
                  <strong>{details.position}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#94a3b8' }}>Scheduled Start:</span>
                  <strong>{new Date(details.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Duration:</span>
                  <strong>{details.durationMinutes} minutes</strong>
                </div>
              </div>

              {/* Waiting Room & Device Check */}
              {isEarly ? (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ backgroundColor: '#0f172a', border: '1px solid #3b82f6', borderRadius: '8px', padding: '16px', textAlign: 'center', marginBottom: '20px' }}>
                    <p style={{ margin: '0 0 8px 0', color: '#93c5fd', fontSize: '14px', fontWeight: '500' }}>Starting In</p>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#60a5fa', fontFamily: 'monospace' }}>
                      {formatTime(timeRemaining)}
                    </div>
                    <p style={{ margin: '8px 0 0 0', color: '#cbd5e1', fontSize: '13px' }}>
                      Please wait here until your scheduled time. You can use this time to check your camera and microphone below.
                    </p>
                  </div>
                  
                  <DeviceCheck onReady={setDeviceReady} />
                </div>
              ) : (
                <div style={{ marginBottom: '24px' }}>
                  <DeviceCheck onReady={setDeviceReady} />
                </div>
              )}
            </>
          )}

          <div className={styles.divider} />

          <button 
            type="submit" 
            className={styles.submitBtn} 
            disabled={!token || !details || isEarly || !deviceReady || loading}
            style={(!deviceReady || isEarly) ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
          >
            <span className={styles.btnInner}>
              {loading ? "Starting..." : 
               isEarly ? "Waiting for Scheduled Time..." : 
               !deviceReady ? "Waiting for Device Access..." : "Continue to Instructions"}
              <svg className={styles.btnArrow} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
              </svg>
            </span>
          </button>

        </form>

        <p className={styles.footerNote}>
          Your interview will be recorded for evaluation purposes.
        </p>

      </div>
    </div>
  );
}