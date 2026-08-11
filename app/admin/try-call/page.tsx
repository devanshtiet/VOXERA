import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "../../../lib/db/server";
import { VoiceAgent } from "../../_components/VoiceAgent";

export const metadata = {
  title: "Try a Call — VOXERA",
};

export default async function TryCallPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const sessionId = crypto.randomUUID();

  await supabase.from("call_logs").insert({
    id: sessionId,
    clientId: user.id,
    callerNumber: "Browser Demo",
    status: "active",
    startedAt: Date.now(),
    sessionId,
  });

  return (
    <div className="p-6 sm:p-10 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tighter text-gradient">
            Try a Call
          </h1>
          <p className="mt-2 text-[14px] text-[var(--color-text-secondary)]">
            Speak or type as a caller. This session is live — open{" "}
            <Link href="/admin" className="text-[var(--color-accent-cyan)] hover:underline">
              the dashboard
            </Link>{" "}
            in another tab to watch the emotion engine react in real time.
          </p>
        </div>
      </div>

      <VoiceAgent sessionId={sessionId} clientId={user.id} userId={user.id} />
    </div>
  );
}
