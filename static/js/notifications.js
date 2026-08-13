// ============================================================================
// static/js/notifications.js
// Shared toast notifications + small UI helpers used across every page.
// ============================================================================

function ensureToastContainer() {
  let el = document.getElementById('toast-container');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast-container';
    el.className = 'toast-container';
    document.body.appendChild(el);
  }
  return el;
}

function showToast(message, type = 'info', duration = 3800) {
  const container = ensureToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;

  const icons = { success: '✓', error: '!', info: 'i' };
  toast.innerHTML = `
    <span class="toast__icon">${icons[type] || icons.info}</span>
    <span class="toast__message"></span>
    <button class="toast__close" aria-label="Dismiss">&times;</button>
  `;
  toast.querySelector('.toast__message').textContent = message;

  const remove = () => {
    toast.classList.add('toast--leaving');
    setTimeout(() => toast.remove(), 220);
  };

  toast.querySelector('.toast__close').addEventListener('click', remove);
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast--visible'));
  setTimeout(remove, duration);
}

function toggleLoading(buttonEl, isLoading, loadingText = 'Working…') {
  if (!buttonEl) return;
  if (isLoading) {
    buttonEl.dataset.originalText = buttonEl.innerHTML;
    buttonEl.disabled = true;
    buttonEl.innerHTML = `<span class="spinner" aria-hidden="true"></span> ${loadingText}`;
  } else {
    buttonEl.disabled = false;
    if (buttonEl.dataset.originalText) buttonEl.innerHTML = buttonEl.dataset.originalText;
  }
}

function confirmAction(message, confirmLabel = 'Delete') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card" role="alertdialog" aria-modal="true">
        <p class="modal-card__message"></p>
        <div class="modal-card__actions">
          <button type="button" class="btn btn--ghost" data-action="cancel">Cancel</button>
          <button type="button" class="btn btn--danger" data-action="confirm"></button>
        </div>
      </div>
    `;
    overlay.querySelector('.modal-card__message').textContent = message;
    overlay.querySelector('[data-action="confirm"]').textContent = confirmLabel;

    function close(result) {
      overlay.classList.add('modal-overlay--leaving');
      setTimeout(() => overlay.remove(), 160);
      resolve(result);
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(false);
    });
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => close(false));
    overlay.querySelector('[data-action="confirm"]').addEventListener('click', () => close(true));

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('modal-overlay--visible'));
  });
}

function friendlySupabaseError(error) {
  if (!error) return 'Something went wrong. Please try again.';
  const msg = error.message || String(error);
  if (msg.includes('Invalid login credentials')) return 'That email and password don\u2019t match our records.';
  if (msg.includes('User already registered')) return 'An account with this email already exists.';
  if (msg.includes('Password should be')) return 'Password must be at least 6 characters.';
  if (msg.includes('duplicate key value')) return 'That item already exists.';
  if (msg.includes('violates row-level security')) return 'You don\u2019t have permission to do that.';
  return msg;
}