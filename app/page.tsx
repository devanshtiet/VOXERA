import { VoiceAgent } from "./_components/VoiceAgent";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-5xl mx-auto flex-col px-6 py-10 gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Emotion-Adaptive Voice Agent
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Deepgram STT + TTS · hierarchical memory (STM / MTM / LTM) · emotion-aware retrieval.
          </p>
        </header>
        <VoiceAgent />
      </main>
    </div>
  );
}
