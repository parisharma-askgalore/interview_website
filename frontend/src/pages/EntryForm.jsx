import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import API from "../api/interviewApi";
import styles from "../components/StartForm.module.css";

// Inline SVG icons (no extra dependency needed)
const IconUser = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconMail = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
);
const IconBriefcase = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
  </svg>
);

export default function StartForm() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setError("No interview token found in URL. Please use the link provided in your email.");
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
                Fill in your details below to begin the interview process.
              </p>
            </div>
    
            {/* Form */}
            <form onSubmit={handleSubmit} className={styles.form}>
    
              {error && (
                <div style={{ color: '#ef4444', background: '#fee2e2', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', border: '1px solid #fca5a5' }}>
                  {error}
                </div>
              )}

              <div className={styles.field} style={{ textAlign: 'center', color: '#cbd5e1', marginBottom: '24px' }}>
                {token ? (
                  <p>You have a valid interview link. Click below to begin the technical checks and read the instructions.</p>
                ) : (
                  <p style={{ color: '#ef4444' }}>Missing interview token. Please use the link from your email.</p>
                )}
              </div>
    
              <div className={styles.divider} />
    
              <button type="submit" className={styles.submitBtn} disabled={!token || loading}>
                <span className={styles.btnInner}>
                  {loading ? "Starting..." : "Continue to Instructions"}
                  <svg className={styles.btnArrow} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                  </svg>
                </span>
              </button>
    
            </form>
    
            <p className={styles.footerNote}>
              All fields are <strong>required</strong>. Your information is kept confidential.
            </p>
    
          </div>
        </div>
  );
}