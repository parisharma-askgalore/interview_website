import { useEffect, useRef } from "react";

export default function UserCamera() {
  const videoRef = useRef(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (e) {
        console.error("Camera access error:", e);
      }
    };

    startCamera();
  }, []);

  return (
    // FIX: removed w-1/2 and rounded-2xl — the parent .video-panel handles sizing & border-radius
    <div style={{ width: "100%", height: "100%" }}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </div>
  );
}
