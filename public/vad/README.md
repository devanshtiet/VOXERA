# Vendored VAD runtime assets

These files are copied from `@ricky0123/vad-web` (and its nested `onnxruntime-web` dependency),
not written by hand. `@ricky0123/vad-web` resolves its model/WASM/worklet paths relative to the
page origin in a bundler context like Next.js — there's no automatic CDN fallback — so these have
to be self-hosted here for `TestAgentDrawer`'s barge-in detection to work at all.

| File | Source | Purpose |
|---|---|---|
| `silero_vad_v5.onnx` | `node_modules/@ricky0123/vad-web/dist/` | The Silero VAD v5 model |
| `vad.worklet.bundle.min.js` | `node_modules/@ricky0123/vad-web/dist/` | AudioWorklet processor |
| `ort-wasm-simd-threaded.mjs` | `node_modules/@ricky0123/vad-web/node_modules/onnxruntime-web/dist/` | ONNX Runtime Web glue |
| `ort-wasm-simd-threaded.wasm` | same as above | ONNX Runtime Web WASM binary |

## Regenerating after a `@ricky0123/vad-web` version bump

```bash
cp node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js public/vad/
cp node_modules/@ricky0123/vad-web/dist/silero_vad_v5.onnx public/vad/
cp node_modules/@ricky0123/vad-web/node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs public/vad/
cp node_modules/@ricky0123/vad-web/node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm public/vad/
```

`useVoiceActivityDetection.ts` passes `baseAssetPath: "/vad/"` and `onnxWASMBasePath: "/vad/"` to
`MicVAD.new()` to point at these. Excluded from lint via `eslint.config.mjs` (vendored, not our
source).
