"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Thin wrapper around @ricky0123/vad-web's MicVAD (Silero VAD via ONNX
 * Runtime Web). Its only job here is turn-taking signal — telling the UI
 * the instant the user starts/stops talking, independent of Deepgram's
 * server-side transcript finalization. Model/WASM/worklet assets are
 * self-hosted under public/vad/ (see baseAssetPath/onnxWASMBasePath below)
 * rather than fetched from a CDN, since the package resolves relative to
 * the page origin by default in a bundler context like Next.js.
 */

type MicVADInstance = {
  start: () => void;
  pause: () => void;
  destroy: () => void;
};

export interface VoiceActivityHandlers {
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
}

export function useVoiceActivityDetection() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ready, setReady] = useState(false);
  const vadRef = useRef<MicVADInstance | null>(null);
  const handlersRef = useRef<VoiceActivityHandlers>({});

  const start = useCallback(async (
    handlers: VoiceActivityHandlers,
    shared?: { stream: MediaStream }
  ) => {
    handlersRef.current = handlers;

    if (vadRef.current) {
      vadRef.current.start();
      return;
    }

    const { MicVAD } = await import("@ricky0123/vad-web");
    const vad = await MicVAD.new({
      model: "v5",
      baseAssetPath: "/vad/",
      onnxWASMBasePath: "/vad/",
      // Reuse the caller's already-open mic MediaStream (avoids a second
      // getUserMedia prompt) but let VAD create and own its own
      // AudioContext. Sharing one AudioContext between our raw-PCM
      // ScriptProcessorNode pipeline and VAD's AudioWorkletNode caused
      // "Failed to construct 'AudioWorkletNode': No execution context
      // available" — mixing the legacy ScriptProcessor and modern
      // AudioWorklet subsystems on one context is fragile. Two contexts on
      // the same stream is a normal, well-supported pattern.
      ...(shared
        ? {
            getStream: async () => shared.stream,
            pauseStream: async () => {},
            resumeStream: async (s: MediaStream) => s,
          }
        : {}),
      onSpeechStart: () => {
        setIsSpeaking(true);
        handlersRef.current.onSpeechStart?.();
      },
      onSpeechEnd: () => {
        setIsSpeaking(false);
        handlersRef.current.onSpeechEnd?.();
      },
      onVADMisfire: () => {
        setIsSpeaking(false);
      },
    });

    vadRef.current = vad;
    setReady(true);
    vad.start();
  }, []);

  const stop = useCallback(() => {
    vadRef.current?.pause();
    setIsSpeaking(false);
  }, []);

  const destroy = useCallback(() => {
    vadRef.current?.destroy();
    vadRef.current = null;
    setReady(false);
    setIsSpeaking(false);
  }, []);

  return { start, stop, destroy, isSpeaking, ready };
}
