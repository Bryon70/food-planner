// ============================================================================
// static/js/supabaseClient.js
// Central Supabase client. Only the public URL + anon/publishable key go here.
// NEVER put a service-role/secret key in frontend code.
// ============================================================================

const SUPABASE_URL = 'https://ccajdurzluxkiybinqvn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_oIVomKyLaIqPpAUNYhSdnQ_b5GvWeJw';

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