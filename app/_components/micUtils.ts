export function getMicSupport(): boolean {
  if (typeof navigator === "undefined") return false;
  return !!navigator.mediaDevices?.getUserMedia;
}

export function describeMicError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : undefined;
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Microphone permission denied — allow microphone access in your browser's site settings and try again.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No microphone found on this device.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Couldn't start the microphone — it may be in use by another app.";
  }
  return e instanceof Error ? e.message : String(e);
}
