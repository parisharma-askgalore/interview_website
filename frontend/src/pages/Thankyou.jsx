import styles from "../components/Thankyou.module.css";

// Floating particle data
const PARTICLES = [
  { left: "8%",  size: 5,  color: "rgba(74,135,232,0.5)",  dur: "7s",  delay: "0s"    },
  { left: "20%", size: 3,  color: "rgba(147,187,245,0.4)", dur: "9s",  delay: "1.2s"  },
  { left: "35%", size: 6,  color: "rgba(37,99,196,0.45)",  dur: "6.5s",delay: "0.4s"  },
  { left: "50%", size: 4,  color: "rgba(74,135,232,0.35)", dur: "8s",  delay: "2s"    },
  { left: "63%", size: 3,  color: "rgba(147,187,245,0.5)", dur: "7.5s",delay: "0.8s"  },
  { left: "78%", size: 5,  color: "rgba(243,107,33,0.25)", dur: "9.5s",delay: "1.6s"  },
  { left: "90%", size: 4,  color: "rgba(74,135,232,0.4)",  dur: "6s",  delay: "3s"    },
  { left: "14%", size: 3,  color: "rgba(243,107,33,0.2)",  dur: "8.5s",delay: "2.5s"  },
];

// Inline SVG icons
const IconCheck = () => (
  <svg className={styles.checkIcon} width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5"/>
  </svg>
);

const IconMail = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="16" x="2" y="4" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
);

const IconClock = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const IconShield = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

export default function Thankyou() {
  return (
    <div className={styles.page}>

      {/* Floating particles */}
      <div className={styles.particles}>
        {PARTICLES.map((p, i) => (
          <div
            key={i}
            className={styles.particle}
            style={{
              left: p.left,
              bottom: "-10px",
              width:  p.size,
              height: p.size,
              background: p.color,
              "--dur":   p.dur,
              "--delay": p.delay,
            }}
          />
        ))}
      </div>

      <div className={styles.card}>

        {/* Check icon */}
        <div className={styles.iconWrap}>
          <IconCheck />
        </div>

        {/* Badge */}
        <div className={styles.badge}>Interview Complete</div>

        {/* Heading */}
        <h1 className={styles.title}>
          <span>Thank you</span> for your time!
        </h1>

        {/* Subtitle */}
        <p className={styles.subtitle}>
          Your interview has been successfully submitted. Our team will review your responses and be in touch shortly.
        </p>

        <div className={styles.divider} />

        {/* Info pills */}
        <div className={styles.pills}>
          <div className={styles.pill}>
            <div className={styles.pillIcon}><IconMail /></div>
            <div className={styles.pillText}>
              <strong>Check your inbox</strong>
              A confirmation has been sent to the email address you provided.
            </div>
          </div>
          <div className={styles.pill}>
            <div className={styles.pillIcon}><IconClock /></div>
            <div className={styles.pillText}>
              <strong>Response time</strong>
              Our team typically follows up within 2–3 business days.
            </div>
          </div>
          <div className={styles.pill}>
            <div className={styles.pillIcon}><IconShield /></div>
            <div className={styles.pillText}>
              <strong>Data security</strong>
              Your responses are stored securely and only shared with the hiring team.
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className={styles.footerNote}>
          You may now close this window. Good luck with your application!
        </p>

      </div>
    </div>
  );
}
