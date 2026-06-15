import { DeepgramClient } from "@deepgram/sdk";

let client: DeepgramClient | null = null;

export function getDeepgram(): DeepgramClient {
  if (client) return client;
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) throw new Error("DEEPGRAM_API_KEY is not set");
  client = new DeepgramClient({ apiKey: key });
  return client;
}

export function hasDeepgram(): boolean {
  return !!process.env.DEEPGRAM_API_KEY;
}
