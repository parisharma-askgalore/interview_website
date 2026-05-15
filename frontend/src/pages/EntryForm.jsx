import { useNavigate } from "react-router-dom";
import { useState } from "react";
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
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    position: ""
  });

  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {

  e.preventDefault();

  try {

    const response = await API.post(
      "/interview/start",
      formData
    );

    localStorage.setItem(
      "sessionId",
      response.data.sessionId
    );
    navigate("/instructions");

  } catch (error) {

    console.log(error);

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
    
              <div className={styles.field}>
                <label className={styles.label}>
                  Name <span className={styles.required}>*</span>
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon}><IconUser /></span>
                  <input
                    className={styles.input}
                    type="text"
                    name="name"
                    placeholder="Your full name"
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
    
              <div className={styles.field}>
                <label className={styles.label}>
                  Email <span className={styles.required}>*</span>
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon}><IconMail /></span>
                  <input
                    className={styles.input}
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
    
              <div className={styles.field}>
                <label className={styles.label}>
                  Position <span className={styles.required}>*</span>
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon}><IconBriefcase /></span>
                  <input
                    className={styles.input}
                    type="text"
                    name="position"
                    placeholder="Role you're applying for"
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
    
              <div className={styles.divider} />
    
              <button type="submit" className={styles.submitBtn}>
                <span className={styles.btnInner}>
                  Continue to Instructions
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