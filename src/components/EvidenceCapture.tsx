"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Photo evidence: file picker or laptop webcam. Images are downscaled to
 * 1280px JPEG before upload — a raw phone photo base64-encodes to ~6MB, which
 * is slow to send and slow for Spark to read.
 */
async function toDataUrl(file: Blob, max = 1280): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

export function EvidenceCapture({
  onSubmit,
  busy,
}: {
  onSubmit: (dataUrl: string) => void;
  busy: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [camOn, setCamOn] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // getUserMedia only exists in a secure context. Over http on a phone — which
  // is how you reach a laptop dev server on the same wifi — it is simply
  // absent. The file picker is not gated this way and opens the camera anyway.
  const [camSupported, setCamSupported] = useState(true);

  useEffect(() => {
    setCamSupported(
      typeof navigator !== "undefined" &&
        Boolean(navigator.mediaDevices?.getUserMedia) &&
        (window.isSecureContext || location.hostname === "localhost")
    );
  }, []);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  async function startCam() {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setCamOn(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      });
    } catch {
      setErr("Couldn't open the camera — use Choose photo instead.");
    }
  }

  function stopCam() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
  }

  function shoot() {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
    setPreview(canvas.toDataURL("image/jpeg", 0.8));
    stopCam();
  }

  return (
    <div className="space-y-3">
      {camOn && (
        <div className="space-y-2">
          <video ref={videoRef} playsInline muted className="w-full rounded-xl border border-edge" />
          <div className="flex gap-2">
            <button onClick={shoot} className="flex-1 py-2 rounded-lg bg-accent text-ink font-semibold text-sm">
              Capture
            </button>
            <button onClick={stopCam} className="px-4 py-2 rounded-lg border border-edge text-sm text-muted">
              Cancel
            </button>
          </div>
        </div>
      )}

      {preview && !camOn && (
        <img src={preview} alt="evidence" className="w-full rounded-xl border border-edge" />
      )}

      {!camOn && (
        <div className="flex gap-2">
          <label
            className={`py-2 rounded-lg border border-edge text-sm text-center cursor-pointer hover:border-muted ${
              camSupported ? "flex-1" : "w-full"
            }`}
          >
            {camSupported ? "Choose photo" : "Take or choose a photo"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setPreview(await toDataUrl(f));
              }}
            />
          </label>
          {camSupported && (
            <button onClick={startCam} className="flex-1 py-2 rounded-lg border border-edge text-sm hover:border-muted">
              Use camera
            </button>
          )}
        </div>
      )}

      {err && <p className="text-xs text-no">{err}</p>}

      {!camSupported && !preview && (
        <p className="text-[11px] text-muted leading-relaxed">
          Live camera needs HTTPS, so it&#39;s off over your local network. The
          button above still opens your camera on a phone.
        </p>
      )}

      {preview && !camOn && (
        <button
          disabled={busy}
          onClick={() => onSubmit(preview)}
          className="w-full py-2.5 rounded-lg bg-yes text-ink font-semibold text-sm disabled:opacity-50"
        >
          {busy ? "Muse Spark is reading it…" : "Submit as evidence"}
        </button>
      )}
    </div>
  );
}
