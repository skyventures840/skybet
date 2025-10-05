import React, { useEffect, useMemo, useRef, useState } from 'react';

// Props:
// - src: string (required)
// - poster: string (optional)
// - startTime: Date|string (ISO) (required)
// - controls: boolean (default true)
// - className: string
// - videoDisplayControl: string (optional) - 'scheduled', 'manual', 'live_only'
// Behavior: show countdown if now < startTime; auto-play when now >= startTime
const VideoPlayerScheduled = ({ src, poster, startTime, controls = true, className = '', videoDisplayControl = 'scheduled' }) => {
  const videoRef = useRef(null);
  const [now, setNow] = useState(Date.now());
  const startTs = useMemo(() => {
    if (!startTime) return null;
    const t = typeof startTime === 'string' ? Date.parse(startTime) : +startTime;
    return Number.isFinite(t) ? t : null;
  }, [startTime]);

  // Determine if video should be displayed based on videoDisplayControl
  const shouldDisplayVideo = useMemo(() => {
    if (!startTs) return false;
    
    switch (videoDisplayControl) {
      case 'scheduled':
        return now >= startTs;
      case 'manual':
        return true; // Admin controls this
      case 'live_only':
        // For live_only, we need to check if the match is actually live
        // This would typically come from the parent component
        return now >= startTs;
      default:
        return now >= startTs;
    }
  }, [startTs, now, videoDisplayControl]);

  const isReadyToPlay = shouldDisplayVideo && startTs !== null && now >= startTs;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (isReadyToPlay && videoRef.current) {
      const tryPlay = async () => {
        try {
          await videoRef.current.play();
        } catch (e) {
          // Autoplay may be blocked; show controls for manual start
          // No-op: the user can press play
        }
      };
      tryPlay();
    }
  }, [isReadyToPlay]);

  const remainingMs = startTs ? Math.max(0, startTs - now) : 0;
  const remainingSec = Math.floor(remainingMs / 1000);
  const hh = String(Math.floor(remainingSec / 3600)).padStart(2, '0');
  const mm = String(Math.floor((remainingSec % 3600) / 60)).padStart(2, '0');
  const ss = String(remainingSec % 60).padStart(2, '0');

  if (!src || !startTs) {
    return null;
  }

  // Don't show anything if video shouldn't be displayed
  if (!shouldDisplayVideo) {
    return null;
  }

  return (
    <div className={`scheduled-video-container ${className}`} style={{ width: '100%', maxWidth: 960, margin: '0 auto' }}>
      {!isReadyToPlay ? (
        <div className="scheduled-video-countdown" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          aspectRatio: '16 / 9', backgroundColor: '#111', color: '#fff', borderRadius: 8, position: 'relative'
        }}>
          {poster && (
            <img src={poster} alt="Poster" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35, borderRadius: 8 }} />
          )}
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 18, marginBottom: 8 }}>Broadcast starts in</div>
            <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: 1 }}>{hh}:{mm}:{ss}</div>
            <div style={{ marginTop: 8, fontSize: 14, opacity: 0.85 }}>
              {videoDisplayControl === 'manual' 
                ? 'Video is ready to play. Click play to start.' 
                : 'The video will start automatically at the scheduled time.'}
            </div>
          </div>
        </div>
      ) : (
        <video
          ref={videoRef}
          src={src}
          poster={poster || undefined}
          controls={controls}
          playsInline
          style={{ width: '100%', height: 'auto', borderRadius: 8, background: '#000' }}
        />
      )}
    </div>
  );
};

export default VideoPlayerScheduled;


