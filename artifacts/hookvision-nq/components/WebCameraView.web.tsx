/**
 * WebCameraView — HTML5 camera using getUserMedia for mobile browsers.
 * Used automatically on web via Expo's platform file resolution.
 */
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export interface WebCameraHandle {
  takePicture: () => Promise<{ base64: string; uri: string }>;
}

interface Props {
  style?: React.CSSProperties;
  onReady?: () => void;
}

const WebCameraView = forwardRef<WebCameraHandle, Props>(function WebCameraView(
  { style, onReady },
  ref
) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().then(() => {
            if (!cancelled) { setActive(true); onReady?.(); }
          });
        }
      })
      .catch(() => {
        // permission denied or not available — parent shows its own error UI
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    takePicture: async () => {
      const video = videoRef.current;
      if (!video || !video.videoWidth) throw new Error("Camera not ready");

      const canvas = document.createElement("canvas");
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      const base64  = dataUrl.split(",")[1];
      return { base64, uri: dataUrl };
    },
  }));

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: "#000",
        ...style,
      }}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: active ? "block" : "none",
        }}
      />
      {!active && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#00d4aa",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              border: "3px solid #00d4aa",
              borderTopColor: "transparent",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ fontSize: 14, fontFamily: "sans-serif" }}>
            Starting camera…
          </span>
        </div>
      )}
    </div>
  );
});

export default WebCameraView;
