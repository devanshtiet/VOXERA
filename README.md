<div align="center">
  <img src="public/images/voxera-hero.png" alt="VOXERA Premium Design" width="100%" style="border-radius: 12px; margin-bottom: 20px;" />
  
  <h1>🎙️ VOXERA</h1>
  <p><b>Premium Agentic AI Voice Platform</b></p>
  <p>Real-time voice agent routing <b>Deepgram STT + TTS</b> through a hierarchical, emotion-conditioned memory system powered by <b>Supabase `pgvector`</b> and an emotion-aware LLM policy layer.</p>

  [![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
  [![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_v4-06B6D4?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
  [![Framer Motion](https://img.shields.io/badge/Framer_Motion-E11D48?style=flat-square&logo=framer)](https://www.framer.com/motion/)
  [![Supabase](https://img.shields.io/badge/Supabase-pgvector-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
  [![Deepgram](https://img.shields.io/badge/Deepgram-Nova--2-13B5C1?style=flat-square)](https://deepgram.com/)
  [![Llama 3](https://img.shields.io/badge/Groq-Llama--3.3-orange?style=flat-square)](https://groq.com/)
</div>

---

## 🚀 Features

- **🧠 Production Vector Memory:** Replaced local in-memory stores with `pgvector` on Supabase. Implements dynamic semantic routing for Short-Term (STM), Medium-Term (MTM), and Long-Term (LTM) memories.
- **🔐 Secure Multi-Tenant Admin Portal:** Complete separation of the public site and the secure Admin Portal. Employs server-side cookies (`@supabase/ssr`) ensuring strict client data isolation.
- **✨ World-Class UX & UI:** A custom, ground-up dark theme utilizing Tailwind v4 `--theme` variables, self-hosted *Syne* and *JetBrains Mono* typography, and butter-smooth `framer-motion` layout animations. 
- **🗂️ Knowledge Base UI:** Drag-and-drop dashboard for business owners to upload `.txt` and `.pdf` files. The pipeline automatically chunks, embeds, and stores business knowledge for RAG.
- **🎭 Voice Personas:** Dynamically toggle AI personalities (Professional, Friendly, Emphatic, Casual) via the admin dashboard, mapping directly to Deepgram TTS acoustic models.
- **📈 Real-Time Analytics:** Dashboard visualizing the Commitment Acoustic Index (CAI), user emotional states (VAD tracking), escalation triggers, and tool invocations.
- **🛠️ Automated Workflows:** Integrated tool-calling for intelligent calendar availability checks, reservation creation, and live email confirmation dispatches.

---

## 🛡️ Security First

The architecture of VOXERA prioritizes security:
- **Environment Strictness:** API keys (Deepgram, Groq, Supabase) are isolated entirely to the server-side Node environment and never leaked to the client bundle.
- **Admin Isolation:** Public users cannot access the `/admin` portal. Onboarding flows divert external users to safe confirmation pages to prevent unauthorized portal viewing.
- **Zero-Trust Memory:** The vector RAG engine checks `clientId` row-level ownership on every query.

---

## 🔄 Core Pipeline

```mermaid
graph TD
    A[Mic] -->|Deepgram Nova-2| B(Text + STT Confidence)
    B --> C{Orchestrator Turn}
    
    C --> D[Text Emotion + VAD]
    D --> E[Fused Emotion State]
    E --> F[Push to STM & Context]
    F --> G[Importance Score]
    
    G --> H[Write Memory]
    H -->|Promote on Recurrence| I[(Supabase LTM)]
    
    I --> J[Retrieve]
    J -->|Semantic + EmoMatch + Recency + Importance| K[Decide Policy]
    K -->|Acknowledge, Escalate, Guard| L(LLM: Llama-3.3-70b)
    L --> M[Guard Output]
    M -->|Deepgram Aura| N[Audio Output]
```

## 🧮 Acoustic & Semantic Scoring

The platform evaluates real-time conversational significance utilizing advanced decay formulas.

- **Importance Scoring**: 
  `I = α·intensity + β·ΔVAD_user + γ·novelty + δ·recurrence + ε·taskCriticality + ζ·policyFlag`
- **Retrieval Math**: 
  `score = w1·cos(q,m) + w2·EmoMatch + w3·exp(−Δt/τ_I) + w4·I(m) − w5·stale − w6·redund`
  *With Emotion-adaptive decay:* `τ_I = τ₀(1 + λ·I)`

---

## 💻 Local Setup & Deployment

> [!IMPORTANT]
> To run this application locally, you will need a Supabase project instance with the `pgvector` extension enabled.

1. **Clone & Install**
   ```bash
   git clone https://github.com/your-username/voxera.git
   cd voxera
   npm install
   ```

2. **Environment Variables**
   Copy `.env.example` to `.env.local` and configure your API keys:
   ```bash
   cp .env.example .env.local
   ```
   *(Requires: `GROQ_API_KEYS`, `DEEPGRAM_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`)*

3. **Database Migration**
   Execute the migration script to configure your Postgres instance.
   - Navigate to your Supabase **SQL Editor**.
   - Copy the contents of `sql/migration_v2.sql` and run the script. This will establish the `memories`, `reservations`, and `session_logs` tables along with the `match_memories` RPC function.

4. **Run Development Server**
   ```bash
   npm run dev
   ```
   Visit `http://localhost:3000` to interact with the Voice Agent, or navigate to `http://localhost:3000/admin` to access the secured dashboard.

---

## 📁 Directory Architecture

| Path | Description |
|------|-------------|
| 📂 `lib/types.ts` | Core interfaces (`Utterance`, `MemoryRecord`, `PolicyDirectives`, `VAD`). |
| 📂 `lib/emotion/` | VAD fusion, trajectory analysis, Commitment Acoustic Index (CAI), and importance engine. |
| 📂 `lib/memory/` | STM ring buffer, Supabase `pgvector` writer (merge/promotion) & MMR retrieval algorithms. |
| 📂 `lib/agent/` | Dynamic LLM system prompt assembler, tool orchestration, and anti-hallucination guard rails. |
| 📂 `lib/deepgram/`| Real-time WebSocket wrappers for STT and HTTP TTS logic. |
| 📂 `app/api/` | Next.js 16 App Router handlers bridging the client stream to the orchestrator. |
| 📂 `app/admin/` | Secure multi-tenant SSR portal containing analytics, settings, and the RAG document uploader. |

---

<div align="center">
  <p><i>Engineered for robust, hallucination-resistant voice workflows.</i></p>
</div>
