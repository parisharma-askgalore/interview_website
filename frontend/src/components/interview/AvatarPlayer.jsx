import { useEffect, useRef, useState } from "react";

const videos = {
  idle: "/avatar/idle.mp4",
  speak: [
    "/avatar/speak-1.mp4",
    "/avatar/speak-2.mp4",
  ],
};

export default function AvatarPlayer({ speaking }) {
  const videoRef = useRef(null);
  const [src, setSrc] = useState(videos.idle);

  // FIX: single useEffect (removed the duplicate that was overwriting this one)
  useEffect(() => {
    if (speaking) {
      const randomVideo =
        videos.speak[Math.floor(Math.random() * videos.speak.length)];
      setSrc(randomVideo);
    } else {
      setSrc(videos.idle);
    }
  }, [speaking]);

  // FIX: when src changes, explicitly call load() + play() so the video actually reloads
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {
        // autoplay may be blocked — silently ignore
      });
    }
  }, [src]);

  return (
    // FIX: removed w-1/2 so avatar fills its panel fully
    <div style={{ width: "100%", height: "100%" }}>
      <video
        ref={videoRef}
        src={src}
        autoPlay
        muted
        loop
        preload="auto"
        playsInline
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </div>
  );
}
