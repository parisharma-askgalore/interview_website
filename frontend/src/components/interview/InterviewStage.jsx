import AvatarPlayer from "./AvatarPlayer";
import UserCamera from "./UserCamera";

export default function InterviewStage({ speaking }) {
  return (
    // FIX: fill parent completely; parent (.videoTile) already handles border-radius & overflow
    <div style={{ display: "contents" }}>

      {/* AI Interviewer — the parent .videoTileAI wraps this */}
      <AvatarPlayer speaking={speaking} />

      <style>{`
        /* These labels are rendered by Questions.jsx's videoLabel, nothing extra needed here */
      `}</style>
    </div>
  );
}
