// ============================================================================
// static/js/favorites.js
// ============================================================================

let currentUserId = null;

(async function initFavoritesPage() {
  const session = await initAuthedNav();
  if (!session) return;
  currentUserId = session.user.id;

  await loadFavorites();
})();

async function loadFavorites() {
  // Query FROM favorites, pulling the related recipe through the FK.
  const { data, error } = await supabaseClient
    .from('favorites')
    .select('id, recipes(id, name, image_url, difficulty, prep_time_minutes, cook_time_minutes, servings)')
    .order('created_at', { ascending: false });

  if (error) {
    showToast(friendlySupabaseError(error), 'error');
    return;
  }

  renderFavoritesGrid(data);
}

function renderFavoritesGrid(favorites) {
  const grid = document.getElementById('favorites-grid');

  if (favorites.length === 0) {
    grid.innerHTML = `
      <div class="empty-state empty-state--large">
        <p>You haven't favorited any recipes yet.</p>
        <a href="recipes.html" class="btn btn--primary">Browse Recipes</a>
      </div>`;
    return;
  }

  grid.innerHTML = favorites.map((fav) => {
    const r = fav.recipes;
    if (!r) return ''; // recipe was deleted but favorite row lingered somehow; skip safely
    const totalTime = (r.prep_time_minutes || 0) + (r.cook_time_minutes || 0);
    return `
      <article class="recipe-card" data-favorite-id="${fav.id}">
        <div class="recipe-card__image" style="background-image:url('${r.image_url || ''}')">
          <button class="favorite-btn favorite-btn--active" data-unfavorite="${fav.id}" aria-label="Remove from favorites">♥</button>
        </div>
        <div class="recipe-card__body">
          <span class="badge badge--${r.difficulty}">${r.difficulty}</span>
          <h3>${escapeHtml(r.name)}</h3>
          <p class="recipe-card__meta">${totalTime} min · ${r.servings} servings</p>
          <a href="recipes.html" class="btn btn--small btn--ghost">View in Recipes</a>
        </div>
      </article>`;
  }).join('');

  grid.querySelectorAll('[data-unfavorite]').forEach((btn) =>
    btn.addEventListener('click', () => unfavorite(btn.dataset.unfavorite))
  );
}

async function unfavorite(favoriteRowId) {
  const { error } = await supabaseClient.from('favorites').delete().eq('id', favoriteRowId);
  if (error) return showToast(friendlySupabaseError(error), 'error');

  showToast('Removed from favorites.', 'success');
  await loadFavorites();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}