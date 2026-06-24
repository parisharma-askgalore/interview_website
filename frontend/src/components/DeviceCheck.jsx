import React, { useEffect, useRef, useState } from 'react';

export default function DeviceCheck({ onReady }) {
  const videoRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneRef = useRef(null);
  const animationFrameRef = useRef(null);

  const [hasVideo, setHasVideo] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    let stream = null;

    const setupDevices = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
        // Setup Video
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasVideo(true);
        setHasAudio(true);
        onReady(true);

        // Setup Audio visualizer
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;
        microphoneRef.current = source;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateVolume = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          setVolume(average);
          animationFrameRef.current = requestAnimationFrame(updateVolume);
        };
        updateVolume();

      } catch (err) {
        console.error("Error accessing media devices.", err);
        setError("Unable to access camera and microphone. Please ensure permissions are granted.");
        onReady(false);
      }
    };

    setupDevices();

    // Cleanup
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [onReady]);

  // Render Volume bar
  const volumePercentage = Math.min(100, Math.max(0, (volume / 128) * 100));

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Device Check</h3>
      {error ? (
        <div style={styles.error}>{error}</div>
      ) : (
        <div style={styles.content}>
          <div style={styles.videoWrapper}>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              style={styles.video} 
            />
          </div>
          
          <div style={styles.audioWrapper}>
            <p style={styles.audioLabel}>Microphone Activity</p>
            <div style={styles.volumeTrack}>
              <div 
                style={{
                  ...styles.volumeFill,
                  width: `${volumePercentage}%`,
                  backgroundColor: volumePercentage > 5 ? '#10b981' : '#cbd5e1'
                }} 
              />
            </div>
          </div>

          <div style={styles.status}>
            {hasVideo && hasAudio ? (
              <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
                Camera and Microphone ready
              </span>
            ) : (
              <span style={{ color: '#f59e0b' }}>Waiting for permissions...</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    border: '1px solid #334155',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px',
    textAlign: 'center'
  },
  title: {
    color: '#e2e8f0',
    marginTop: 0,
    marginBottom: '16px',
    fontSize: '1.1rem',
    fontWeight: '600'
  },
  error: {
    color: '#ef4444',
    padding: '12px',
    backgroundColor: '#fee2e2',
    borderRadius: '8px',
    fontSize: '14px'
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  videoWrapper: {
    width: '100%',
    maxWidth: '400px',
    margin: '0 auto',
    aspectRatio: '16/9',
    backgroundColor: '#0f172a',
    borderRadius: '8px',
    overflow: 'hidden',
    position: 'relative',
    border: '1px solid #475569'
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: 'scaleX(-1)' // Mirror effect
  },
  audioWrapper: {
    marginTop: '8px'
  },
  audioLabel: {
    color: '#94a3b8',
    fontSize: '14px',
    marginBottom: '8px',
    margin: 0
  },
  volumeTrack: {
    width: '100%',
    maxWidth: '300px',
    height: '8px',
    backgroundColor: '#334155',
    borderRadius: '4px',
    margin: '8px auto',
    overflow: 'hidden'
  },
  volumeFill: {
    height: '100%',
    transition: 'width 0.1s ease-out, background-color 0.2s',
  },
  status: {
    fontSize: '14px',
    marginTop: '8px',
    fontWeight: '500'
  }
};
