import { useEffect, useRef, useState } from "react";

const videos = {
  idle: "/avatar/idle.mp4",
  speak: [
    "/avatar/speak-1.mp4",
    "/avatar/speak-2.mp4",
    "/avatar/speak-3.mp4",
  ],
};

export default function AvatarPlayer({ speaking }) {
  const videoRef = useRef(null);
  const [src, setSrc] = useState(videos.idle);

  useEffect(() => {
    if (speaking) {
      const randomVideo =
        videos.speak[Math.floor(Math.random() * videos.speak.length)];

      setSrc(randomVideo);
    } else {
      setSrc(videos.idle);
    }
  }, [speaking]);

  useEffect(() => {
  if (speaking) {
    setSrc("/avatar/speak.mp4");
  } else {
    setSrc("/avatar/idle.mp4");
  }
}, [speaking]);

  return (
    <div className="w-1/2 rounded-2xl overflow-hidden bg-black">
      <video
        ref={videoRef}
        src={src}
        autoPlay
        muted
        loop
        playsInline
        className="w-full h-full object-cover"
      />
    </div>
  );
}