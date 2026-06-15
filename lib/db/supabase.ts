import { createClient } from "@supabase/supabase-js";

/**
 * We use the SERVICE ROLE KEY because this code runs in a secure Node.js backend.
 * The Service Role key bypasses Row Level Security (RLS) policies, allowing the AI 
 * agent to read/write reservations without having to mock a logged-in user.
 * 
 * NOTE: NEVER expose this key to a frontend client like the browser.
 */
function getSupabaseUrl() {
  return process.env.SUPABASE_URL || "";
}

function getSupabaseKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";
}

export const supabase = createClient(getSupabaseUrl(), getSupabaseKey(), {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

// A helper for ensuring the connection is up during startup checks
export async function testConnection() {
  const { data, error } = await supabase.from("reservations").select("id").limit(1);
  if (error && error.code !== "42P01") { // 42P01 is table does not exist
    throw error;
  }
  return true;
}
