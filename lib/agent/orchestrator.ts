import { nanoid } from "nanoid";
import { CONFIG } from "../config";
import { buildEmotionContext } from "../emotion/context";
import { detectTextEmotion, fuseEmotion } from "../emotion/detect";
import { importanceScore, novelty, policyFlag, taskCriticality } from "../emotion/importance";
import { retrieve, topScore } from "../memory/retrieval";
import { stm } from "../memory/stm";
import { vectorStore } from "../memory/store";
import { writeMemory } from "../memory/writer";
import type { Utterance, EmotionSignal } from "../types";
import { embed } from "../util/embed";
import { buildLLMContext } from "./context";
import { guardOutput } from "./guard";
import { generateReply } from "./llm";
import { decidePolicy } from "./policy";

export interface TurnInput {
  sessionId: string;
  userId: string;
  clientId: string;
  transcript: string;
  sttConfidence?: number;
  audioEmotion?: EmotionSignal | null;
}

export interface TurnTrace {
  utterance: Utterance;
  emotion: ReturnType<typeof buildEmotionContext>;
  importance: number;
  memoryWrite: ReturnType<typeof writeMemory>;
  retrieved: { mtmIds: string[]; ltmUserIds: string[]; ltmClientIds: string[]; scores: { id: string; score: number }[] };
  policy: ReturnType<typeof decidePolicy>;
  guardReasons: string[];
  llmModel: string;
  usedLiveLlm: boolean;
}

export interface TurnOutput {
  reply: string;
  trace: TurnTrace;
}

export async function handleTurn(input: TurnInput): Promise<TurnOutput> {
  const ts = Date.now();
  const sttConf = input.sttConfidence ?? 1;

  const textEmo = detectTextEmotion(input.transcript);
  const fused = fuseEmotion(textEmo, input.audioEmotion ?? null);

  const userTurn: Utterance = {
    id: nanoid(8),
    role: "user",
    text: input.transcript,
    sttConfidence: sttConf,
    emotion: fused,
    ts,
  };
  stm.push(input.sessionId, userTurn);

  const ltmUserAll = vectorStore.byTier("LTM_user", input.userId, input.clientId);
  const emotionCtx = buildEmotionContext({
    current: fused,
    stm: stm.get(input.sessionId),
    ltmUser: ltmUserAll,
  });

  const queryEmbedding = embed(input.transcript);
  const mtmExisting = vectorStore.byTier("MTM", input.userId, input.clientId);
  const I = importanceScore({
    text: input.transcript,
    emotion: emotionCtx,
    novelty: novelty(queryEmbedding, mtmExisting),
    recurrence: mtmExisting.filter((m) => m.topic && input.transcript.toLowerCase().includes(m.topic)).length,
    taskCriticality: taskCriticality(input.transcript),
    policyFlag: policyFlag(emotionCtx),
  });

  const memoryWrite = writeMemory({
    utterance: userTurn,
    userId: input.userId,
    clientId: input.clientId,
    emotion: emotionCtx,
    importance: I,
  });

  const retrieved = retrieve({
    sessionId: input.sessionId,
    userId: input.userId,
    clientId: input.clientId,
    queryText: input.transcript,
    emotion: emotionCtx,
  });

  const policy = decidePolicy(emotionCtx);

  const llmContext = buildLLMContext({
    userId: input.userId,
    clientId: input.clientId,
    userTurn,
    retrieved,
    emotion: emotionCtx,
    policy,
  });

  const llmReply = await generateReply({ system: llmContext.system, user: llmContext.user });

  const guarded = guardOutput({
    reply: llmReply.text,
    allowedCitations: llmContext.citations,
    policy,
    sttConfidence: sttConf,
    topRetrievalScore: topScore(retrieved),
    minStt: CONFIG.gates.minSttConfidence,
    minRetrieval: CONFIG.gates.minRetrievalScore,
  });

  const agentTurn: Utterance = {
    id: nanoid(8),
    role: "agent",
    text: guarded.cleaned,
    ts: Date.now(),
  };
  stm.push(input.sessionId, agentTurn);

  return {
    reply: guarded.cleaned,
    trace: {
      utterance: userTurn,
      emotion: emotionCtx,
      importance: I,
      memoryWrite,
      retrieved: {
        mtmIds: retrieved.mtm.map((m) => m.id),
        ltmUserIds: retrieved.ltmUser.map((m) => m.id),
        ltmClientIds: retrieved.ltmClient.map((m) => m.id),
        scores: retrieved.scores,
      },
      policy,
      guardReasons: guarded.reasons,
      llmModel: llmReply.model,
      usedLiveLlm: llmReply.usedLive,
    },
  };
}
