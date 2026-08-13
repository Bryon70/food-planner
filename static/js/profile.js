// ============================================================================
// static/js/profile.js
// ============================================================================

let currentSession = null;

(async function initProfilePage() {
  currentSession = await initAuthedNav();
  if (!currentSession) return;

  await loadProfile();
  wireForms();
})();

async function loadProfile() {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('full_name, avatar_url, bio')
    .eq('id', currentSession.user.id)
    .single();

  if (error) return showToast(friendlySupabaseError(error), 'error');

  const form = document.getElementById('profile-form');
  form.email.value = currentSession.user.email;
  form.full_name.value = data.full_name || '';
  form.avatar_url.value = data.avatar_url || '';
  form.bio.value = data.bio || '';
}

function wireForms() {
  document.getElementById('profile-form').addEventListener('submit', handleProfileSubmit);
  document.getElementById('password-form').addEventListener('submit', handlePasswordSubmit);
}

// -------------------- Update profile --------------------
async function handleProfileSubmit(event) {
  event.preventDefault();
  const form = event.target;
  clearFieldErrors(form);

  const fullName = form.full_name.value.trim();
  if (fullName.length < 2) {
    setFieldError(form.full_name, 'Enter your full name.');
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  toggleLoading(submitBtn, true, 'Saving…');

  const { error } = await supabaseClient
    .from('profiles')
    .update({
      full_name: fullName,
      avatar_url: form.avatar_url.value.trim() || null,
      bio: form.bio.value.trim() || null,
    })
    .eq('id', currentSession.user.id);

  toggleLoading(submitBtn, false);

  if (error) return showToast(friendlySupabaseError(error), 'error');

  showToast('Profile updated.', 'success');
  // Keep the sidenav name in sync without a full page reload.
  document.querySelectorAll('[data-user-name]').forEach((el) => (el.textContent = fullName));
}

// -------------------- Change password --------------------
async function handlePasswordSubmit(event) {
  event.preventDefault();
  const form = event.target;
  clearFieldErrors(form);

  const newPassword = form.new_password.value;
  const confirmPassword = form.confirm_new_password.value;

  let hasError = false;
  if (!validatePassword(newPassword)) {
    setFieldError(form.new_password, 'Password must be at least 6 characters.');
    hasError = true;
  }
  if (newPassword !== confirmPassword) {
    setFieldError(form.confirm_new_password, 'Passwords don\u2019t match.');
    hasError = true;
  }
  if (hasError) return;

  const submitBtn = form.querySelector('button[type="submit"]');
  toggleLoading(submitBtn, true, 'Updating…');

  const { error } = await supabaseClient.auth.updateUser({ password: newPassword });

  toggleLoading(submitBtn, false);

  if (error) return showToast(friendlySupabaseError(error), 'error');

  showToast('Password updated.', 'success');
  form.reset();
}