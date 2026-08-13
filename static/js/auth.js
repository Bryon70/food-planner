// ============================================================================
// static/js/auth.js
// Registration, login, logout, and session helpers via Supabase Auth.
// ============================================================================

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  return typeof password === 'string' && password.length >= 6;
}

function setFieldError(inputEl, message) {
  const wrapper = inputEl.closest('.field');
  if (!wrapper) return;
  wrapper.classList.toggle('field--error', Boolean(message));
  const errorEl = wrapper.querySelector('.field__error');
  if (errorEl) errorEl.textContent = message || '';
}

function clearFieldErrors(formEl) {
  formEl.querySelectorAll('.field').forEach((f) => f.classList.remove('field--error'));
  formEl.querySelectorAll('.field__error').forEach((e) => (e.textContent = ''));
}

// -------------------- Register --------------------
async function handleRegisterSubmit(event) {
  event.preventDefault();
  const form = event.target;
  clearFieldErrors(form);

  const fullName = form.fullName.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;
  const confirmPassword = form.confirmPassword.value;
  const submitBtn = form.querySelector('button[type="submit"]');

  let hasError = false;
  if (fullName.length < 2) {
    setFieldError(form.fullName, 'Enter your full name.');
    hasError = true;
  }
  if (!validateEmail(email)) {
    setFieldError(form.email, 'Enter a valid email address.');
    hasError = true;
  }
  if (!validatePassword(password)) {
    setFieldError(form.password, 'Password must be at least 6 characters.');
    hasError = true;
  }
  if (password !== confirmPassword) {
    setFieldError(form.confirmPassword, 'Passwords don\u2019t match.');
    hasError = true;
  }
  if (hasError) return;

  toggleLoading(submitBtn, true, 'Creating account…');
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  toggleLoading(submitBtn, false);

  if (error) {
    showToast(friendlySupabaseError(error), 'error');
    return;
  }

  if (data.session) {
    showToast('Account created. Welcome to Food Planner!', 'success');
    window.location.href = 'dashboard.html';
  } else {
    showToast('Account created. Check your email to confirm, then sign in.', 'success', 6000);
    window.location.href = 'login.html';
  }
}

// -------------------- Login --------------------
async function handleLoginSubmit(event) {
  event.preventDefault();
  const form = event.target;
  clearFieldErrors(form);

  const email = form.email.value.trim();
  const password = form.password.value;
  const submitBtn = form.querySelector('button[type="submit"]');

  let hasError = false;
  if (!validateEmail(email)) {
    setFieldError(form.email, 'Enter a valid email address.');
    hasError = true;
  }
  if (!password) {
    setFieldError(form.password, 'Enter your password.');
    hasError = true;
  }
  if (hasError) return;

  toggleLoading(submitBtn, true, 'Signing in…');
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  toggleLoading(submitBtn, false);

  if (error) {
    showToast(friendlySupabaseError(error), 'error');
    return;
  }

  showToast('Welcome back!', 'success');
  window.location.href = 'dashboard.html';
}

// -------------------- Logout --------------------
async function handleLogout() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    showToast(friendlySupabaseError(error), 'error');
    return;
  }
  window.location.href = 'login.html';
}

// -------------------- Shared nav / current user --------------------
async function initAuthedNav() {
  const session = await requireAuth();
  if (!session) return null;

  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', session.user.id)
    .single();

  document.querySelectorAll('[data-user-name]').forEach((el) => {
    el.textContent = profile?.full_name || session.user.email.split('@')[0];
  });
  document.querySelectorAll('[data-user-email]').forEach((el) => {
    el.textContent = session.user.email;
  });

  document.querySelectorAll('[data-logout]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      handleLogout();
    });
  });

  highlightActiveNavLink();

  return session;
}

function highlightActiveNavLink() {
  const current = window.location.pathname.split('/').pop() || 'dashboard.html';
  document.querySelectorAll('.sidenav__link').forEach((link) => {
    const href = link.getAttribute('href');
    link.classList.toggle('sidenav__link--active', href === current);
  });
}