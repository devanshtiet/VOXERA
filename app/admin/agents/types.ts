export interface Agent {
  id: string;
  tenant_id: string;
  name: string;
  type: string | null;
  status: string;
  description: string | null;
  system_prompt: string | null;
  greeting: string | null;
  voice_persona: string | null;
  created_at: string;
  updated_at: string;
}

export interface GeneratedAgentDraft {
  name: string;
  description: string;
  system_prompt: string;
  greeting: string;
}

export interface Draft {
  name: string;
  description: string;
  system_prompt: string;
  greeting: string;
  voice_persona: string;
}

export const BLANK_DRAFT: Draft = {
  name: "",
  description: "",
  system_prompt: "",
  greeting: "",
  voice_persona: "female-friendly",
};

export const VOICE_PERSONAS = [
  { id: "female-friendly", label: "Female · Friendly" },
  { id: "male-formal", label: "Male · Formal" },
  { id: "female-formal", label: "Female · Formal" },
  { id: "male-friendly", label: "Male · Friendly" },
];
