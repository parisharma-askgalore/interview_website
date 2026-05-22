import AvatarPlayer from "./AvatarPlayer";
import UserCamera from "./UserCamera";

export default function InterviewStage({ speaking }) {
  return (
    <div className="flex gap-6 mb-6">
      <AvatarPlayer speaking={speaking} />
      <UserCamera />
    </div>
  );
}