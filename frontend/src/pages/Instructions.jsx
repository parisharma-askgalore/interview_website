import { useNavigate } from "react-router-dom";
import styles from "../components/Instructions.module.css";

// Inline SVG icons
const IconList    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
const IconPlay    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>;
const IconShield  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IconBan     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>;
const IconCompass = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>;
const IconCheck   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;

export default function Instructions() {
  const navigate = useNavigate();

    const startInterview = () => {

      navigate("/questions");

    };

  return (
    <div className={styles.page}>
          <div className={styles.container}>
    
            {/* ── Page header ── */}
            <header className={styles.pageHeader}>
              <div className={styles.badge}>Pre-Interview</div>
              <h1 className={styles.title}>
                <span>Interview</span> Instructions
              </h1>
              <p className={styles.lead}>
                Please read all instructions carefully before beginning
                the interview assessment.
              </p>
            </header>
    
            {/* ── Interview Overview ── */}
            <section className={styles.section}>
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionIcon}><IconList /></span>
                Interview Overview
              </h2>
              <ul className={styles.list}>
                <li>This interview consists of 10 questions.</li>
                <li>Questions will appear one at a time on the screen.</li>
                <li>Each question is timed and recorded automatically.</li>
                <li>Your audio responses will be converted into text and securely stored for evaluation.</li>
              </ul>
            </section>
    
            {/* ── How It Works ── */}
            <section className={styles.section}>
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionIcon}><IconPlay /></span>
                How The Interview Works
              </h2>
              <ol className={styles.listOrdered}>
                <li>A question will appear on the screen.</li>
                <li>You will have 5 seconds to carefully read the question before recording begins automatically.</li>
                <li>Once recording starts, answer the question clearly using your microphone.</li>
                <li>After completing your response, click the <strong>Stop &amp; Next</strong> button to continue to the next question.</li>
                <li>If no speech is detected within the allowed time, the system may automatically skip to the next question.</li>
              </ol>
            </section>
    
            {/* ── Important Guidelines ── */}
            <section className={styles.section}>
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionIcon}><IconShield /></span>
                Important Guidelines
              </h2>
              <ul className={styles.list}>
                <li>Ensure your microphone is connected and working properly.</li>
                <li>Sit in a quiet environment with minimal background noise.</li>
                <li>Speak clearly, naturally, and at a moderate pace.</li>
                <li>Avoid interrupting yourself frequently while answering.</li>
                <li>Keep your answers relevant to the question being asked.</li>
                <li>Maintain professional language and communication.</li>
              </ul>
            </section>
    
            {/* ── Do Not ── */}
            <section className={`${styles.section} ${styles.sectionWarn}`}>
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionIcon}><IconBan /></span>
                Do Not
              </h2>
              <ul className={styles.list}>
                <li>Refresh or close the browser during the interview.</li>
                <li>Open multiple tabs for the interview session.</li>
                <li>Disconnect your microphone while recording is active.</li>
                <li>Use external audio playback or voice assistance tools.</li>
                <li>Leave long periods of silence during recording.</li>
              </ul>
            </section>
    
            {/* ── Navigation ── */}
            <section className={styles.section}>
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionIcon}><IconCompass /></span>
                Navigation
              </h2>
              <ul className={styles.list}>
                <li>Questions must be answered in sequence.</li>
                <li>You cannot return to previous questions once submitted.</li>
                <li>Use the on-screen controls only to proceed.</li>
              </ul>
            </section>
    
            {/* ── Before You Begin ── */}
            <section className={styles.section}>
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionIcon}><IconCheck /></span>
                Before You Begin
              </h2>
              <ul className={styles.list}>
                <li>Check your internet connection stability.</li>
                <li>Verify microphone permissions are enabled in your browser.</li>
                <li>Ensure you are ready before starting the interview.</li>
              </ul>
            </section>
    
            {/* ── CTA ── */}
            <footer className={styles.footer}>
              <p className={styles.footerNote}>
                By continuing, you confirm you have read and understood all instructions above.
              </p>
              <button className={styles.startBtn} onClick={startInterview}>
                <span className={styles.btnInner}>
                  Start Interview
                  <svg className={styles.btnArrow} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                  </svg>
                </span>
              </button>
            </footer>
    
          </div>
        </div>
  );
}