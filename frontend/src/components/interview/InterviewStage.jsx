import AvatarPlayer from "./AvatarPlayer";
import UserCamera from "./UserCamera";

export default function InterviewStage({ speaking }) {
  return (
    <div className="interview-stage-wrap">
      {/* AI Interviewer — LEFT */}
      <div className="video-panel">
        <AvatarPlayer speaking={speaking} />
        <div className="video-label video-label--ai">
          <span className="label-dot label-dot--ai" />
          AI Interviewer
        </div>
      </div>

      {/* User — RIGHT */}
      <div className="video-panel">
        <UserCamera />
        <div className="video-label video-label--user">
          <span className="label-dot label-dot--user" />
          You
        </div>
      </div>

      <style>{`
        .interview-stage-wrap {
          display: flex;
          gap: 12px;
          width: 100%;
          margin-bottom: 1.5rem;
        }
        .video-panel {
          position: relative;
          flex: 1;
          min-height: 220px;
          border-radius: 16px;
          overflow: hidden;
          background: #040c1e;
          border: 1px solid rgba(255,255,255,0.07);
          box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.05) inset;
        }
        .video-panel > * {
          width: 100% !important;
          height: 100% !important;
          border-radius: 0 !important;
        }
        .video-label {
          position: absolute;
          bottom: 10px;
          left: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 20px;
          font-family: 'Sora', sans-serif;
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          background: rgba(10, 22, 40, 0.7);
          border: 1px solid rgba(255,255,255,0.1);
          color: #fff;
        }
        .label-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        .label-dot--ai {
          background: #4a87e8;
          box-shadow: 0 0 6px rgba(74,135,232,0.8);
        }
        .label-dot--user {
          background: #f36b21;
          box-shadow: 0 0 6px rgba(243,107,33,0.8);
          animation: userDotBlink 2s ease-in-out infinite;
        }
        @keyframes userDotBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
