import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CameraScannerProps } from './cameraScannerTypes';

type Detector = { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> };

const SCAN_INTERVAL_MS = 250;
const MAX_DECODE_FAILURES = 8;
// Copied from node_modules/zxing-wasm into public/ so scanning never depends on a third-party CDN.
const WASM_URL = '/zxing_reader.wasm';

const videoStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  backgroundColor: '#000',
} as const;

// Chrome on Android ships a native BarcodeDetector, but it can exist yet fail (no Play Services,
// unsupported format list), so it is only trusted after a construction check and abandoned on error.
async function createNativeDetector(): Promise<Detector | null> {
  const Native = (globalThis as { BarcodeDetector?: any }).BarcodeDetector;
  if (!Native) return null;
  try {
    const formats: string[] | undefined = await Native.getSupportedFormats?.();
    if (formats && !formats.includes('qr_code')) return null;
    return new Native({ formats: ['qr_code'] }) as Detector;
  } catch {
    return null;
  }
}

// WASM decoder that works in every browser (iOS Safari has no native detector).
async function createWasmDetector(): Promise<Detector> {
  const { BarcodeDetector, setZXingModuleOverrides } = await import('barcode-detector/ponyfill');
  setZXingModuleOverrides({
    locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? WASM_URL : prefix + path),
  });
  return new BarcodeDetector({ formats: ['qr_code'] }) as Detector;
}

function cameraErrorMessage(e: unknown): string {
  const name = e instanceof Error ? e.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return "Camera access is blocked. Allow the camera for this site in your browser's site settings, then tap Try again.";
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No camera was found on this device.';
  }
  if (name === 'NotReadableError' || name === 'AbortError') {
    return 'The camera is being used by another app. Close it and tap Try again.';
  }
  return 'The camera could not be started.';
}

export function CameraScanner({ armed, torch, onCode, onError }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  // Latest props for the long-lived scan loop, so the camera is not restarted on every render.
  const armedRef = useRef(armed);
  const onCodeRef = useRef(onCode);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    armedRef.current = armed;
    onCodeRef.current = onCode;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    const video = videoRef.current;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stream: MediaStream | null = null;

    const fail = (message: string) => {
      if (!cancelled) onErrorRef.current?.(message);
    };

    async function start() {
      if (!video) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        fail('The camera needs a secure (https) connection and a supported browser.');
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch (e) {
        fail(cameraErrorMessage(e));
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const track = stream.getVideoTracks()[0] ?? null;
      trackRef.current = track;
      track?.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => {});

      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // Autoplay can be rejected briefly; the muted/playsInline attributes normally cover it.
      }

      let detector: Detector | null = await createNativeDetector();
      let usingNative = detector !== null;
      let failures = 0;

      const tick = async () => {
        if (cancelled) return;
        try {
          if (armedRef.current && video.readyState >= 2 && video.videoWidth > 0) {
            if (!detector) detector = await createWasmDetector();
            const results = await detector.detect(video);
            failures = 0;
            const value = results[0]?.rawValue;
            if (value && !cancelled && armedRef.current) onCodeRef.current(value);
          }
        } catch {
          if (usingNative) {
            // Native detector is unusable on this device: switch to the WASM decoder and carry on.
            usingNative = false;
            detector = null;
          } else if (++failures >= MAX_DECODE_FAILURES) {
            fail('The QR reader could not start. Check your connection, or type the code instead.');
            return;
          }
        }
        timer = setTimeout(tick, SCAN_INTERVAL_MS);
      };
      tick();
    }

    start();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      trackRef.current = null;
      if (video) video.srcObject = null;
    };
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    const supportsTorch = !!(track?.getCapabilities?.() as { torch?: boolean } | undefined)?.torch;
    if (!track || !supportsTorch) return;
    track.applyConstraints({ advanced: [{ torch } as MediaTrackConstraintSet] }).catch(() => {});
  }, [torch]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {React.createElement('video', {
        ref: videoRef,
        autoPlay: true,
        playsInline: true,
        muted: true,
        style: videoStyle,
      })}
    </View>
  );
}
