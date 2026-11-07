// ============================================================================
// static/js/supabaseClient.js
// Central Supabase client. Only the public URL + anon/publishable key go here.
// NEVER put a service-role/secret key in frontend code.
// ============================================================================

const SUPABASE_URL = "https://fozwexrhmkwevwtejkic.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvendleHJobWt3ZXZ3dGVqa2ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMTczOTAsImV4cCI6MjEwNDc5MzM5MH0.JM2uOMVnpk3md54qlLpTRc3UtuFCgvQX-rCC4ye1nnw";

const { createClient } = supabase;

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

async function requireAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

async function redirectIfAuthed() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    window.location.href = 'dashboard.html';
  }
}