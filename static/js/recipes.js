// ============================================================================
// static/js/recipes.js
// ============================================================================

let currentUserId = null;
let allRecipes = []; // cached, so filtering doesn't re-hit the network each time
let ingredientRowCount = 0;

(async function initRecipesPage() {
  const session = await initAuthedNav();
  if (!session) return;
  currentUserId = session.user.id;

  await loadRecipes();
  wireToolbarEvents();
  wireModalEvents();
})();

// -------------------- Load + render --------------------
async function loadRecipes() {
  const { data, error } = await supabaseClient
    .from('recipes')
    .select('*, recipe_ingredients(id, name, quantity, unit), favorites(id)')
    .order('created_at', { ascending: false });

  if (error) {
    showToast(friendlySupabaseError(error), 'error');
    return;
  }

  allRecipes = data;
  applyFiltersAndRender();
}

function applyFiltersAndRender() {
  const search = document.getElementById('search-input').value.trim().toLowerCase();
  const category = document.getElementById('category-filter').value;
  const difficulty = document.getElementById('difficulty-filter').value;
  const favoritesOnly = document.getElementById('favorites-only').checked;
  const [sortField, sortDir] = document.getElementById('sort-select').value.split('-');

  let filtered = allRecipes.filter((r) => {
    if (search && !r.name.toLowerCase().includes(search)) return false;
    if (category && r.category !== category) return false;
    if (difficulty && r.difficulty !== difficulty) return false;
    if (favoritesOnly && (!r.favorites || r.favorites.length === 0)) return false;
    return true;
  });

  filtered.sort((a, b) => {
    const av = a[sortField], bv = b[sortField];
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  renderRecipeGrid(filtered);
}

function renderRecipeGrid(recipes) {
  const grid = document.getElementById('recipe-grid');

  if (recipes.length === 0) {
    grid.innerHTML = `
      <div class="empty-state empty-state--large">
        <p>No recipes match your filters yet.</p>
        <button class="btn btn--primary" onclick="openRecipeModal()">Add your first recipe</button>
      </div>`;
    return;
  }

  grid.innerHTML = recipes.map((r) => {
    const isFavorited = r.favorites && r.favorites.length > 0;
    const totalTime = (r.prep_time_minutes || 0) + (r.cook_time_minutes || 0);
    return `
      <article class="recipe-card" data-id="${r.id}">
        <div class="recipe-card__image" style="background-image:url('${r.image_url || ''}')">
          <button class="favorite-btn ${isFavorited ? 'favorite-btn--active' : ''}" data-favorite-toggle="${r.id}" data-favorited="${isFavorited}">
            ${isFavorited ? '♥' : '♡'}
          </button>
        </div>
        <div class="recipe-card__body">
          <span class="badge badge--${r.difficulty}">${r.difficulty}</span>
          <h3>${escapeHtml(r.name)}</h3>
          <p class="recipe-card__meta">${totalTime} min · ${r.servings} servings</p>
          <div class="recipe-card__actions">
            <button class="btn btn--small btn--ghost" data-edit="${r.id}">Edit</button>
            <button class="btn btn--small btn--danger" data-delete="${r.id}">Delete</button>
          </div>
        </div>
      </article>`;
  }).join('');

  // Wire per-card buttons (event delegation would also work; this is simpler to follow)
  grid.querySelectorAll('[data-favorite-toggle]').forEach((btn) =>
    btn.addEventListener('click', () => toggleFavorite(btn.dataset.favoriteToggle, btn.dataset.favorited === 'true'))
  );
  grid.querySelectorAll('[data-edit]').forEach((btn) =>
    btn.addEventListener('click', () => openRecipeModal(btn.dataset.edit))
  );
  grid.querySelectorAll('[data-delete]').forEach((btn) =>
    btn.addEventListener('click', () => deleteRecipe(btn.dataset.delete))
  );
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// -------------------- Toolbar --------------------
function wireToolbarEvents() {
  ['search-input', 'category-filter', 'difficulty-filter', 'sort-select', 'favorites-only']
    .forEach((id) => {
      const el = document.getElementById(id);
      el.addEventListener(el.tagName === 'INPUT' && el.type === 'search' ? 'input' : 'change', applyFiltersAndRender);
    });
}

// -------------------- Favorite toggle --------------------
async function toggleFavorite(recipeId, isCurrentlyFavorited) {
  if (isCurrentlyFavorited) {
    const { error } = await supabaseClient
      .from('favorites')
      .delete()
      .eq('recipe_id', recipeId)
      .eq('user_id', currentUserId);
    if (error) return showToast(friendlySupabaseError(error), 'error');
  } else {
    const { error } = await supabaseClient
      .from('favorites')
      .insert({ recipe_id: recipeId, user_id: currentUserId });
    if (error) return showToast(friendlySupabaseError(error), 'error');
  }
  await loadRecipes();
}

// -------------------- Delete --------------------
async function deleteRecipe(recipeId) {
  const confirmed = await confirmAction('Delete this recipe? This also removes its ingredients from any shopping lists.', 'Delete Recipe');
  if (!confirmed) return;

  const { error } = await supabaseClient.from('recipes').delete().eq('id', recipeId);
  if (error) return showToast(friendlySupabaseError(error), 'error');

  showToast('Recipe deleted.', 'success');
  await loadRecipes();
}

// -------------------- Modal: open/close --------------------
function wireModalEvents() {
  document.getElementById('new-recipe-btn').addEventListener('click', () => openRecipeModal());
  document.getElementById('cancel-recipe-btn').addEventListener('click', closeRecipeModal);
  document.getElementById('add-ingredient-btn').addEventListener('click', () => addIngredientRow());
  document.getElementById('recipe-form').addEventListener('submit', handleRecipeFormSubmit);
}

function openRecipeModal(recipeId = null) {
  const modal = document.getElementById('recipe-modal');
  const form = document.getElementById('recipe-form');
  form.reset();
  document.getElementById('ingredient-rows').innerHTML = '';
  ingredientRowCount = 0;

  const recipe = recipeId ? allRecipes.find((r) => r.id === recipeId) : null;
  document.getElementById('modal-title').textContent = recipe ? 'Edit Recipe' : 'New Recipe';
  form.id.value = recipe?.id || '';

  if (recipe) {
    form.name.value = recipe.name;
    form.description.value = recipe.description || '';
    form.image_url.value = recipe.image_url || '';
    form.prep_time_minutes.value = recipe.prep_time_minutes;
    form.cook_time_minutes.value = recipe.cook_time_minutes;
    form.servings.value = recipe.servings;
    form.difficulty.value = recipe.difficulty;
    form.category.value = recipe.category;
    form.tags.value = (recipe.tags || []).join(', ');
    form.instructions.value = recipe.instructions;
    (recipe.recipe_ingredients || []).forEach((ing) => addIngredientRow(ing));
  } else {
    addIngredientRow(); // start with one empty row
  }

  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add('modal-overlay--visible'));
}

function closeRecipeModal() {
  const modal = document.getElementById('recipe-modal');
  modal.classList.remove('modal-overlay--visible');
  setTimeout(() => (modal.hidden = true), 160);
}

// -------------------- Dynamic ingredient rows --------------------
function addIngredientRow(ingredient = null) {
  ingredientRowCount += 1;
  const rowId = `ing-${ingredientRowCount}`;
  const container = document.getElementById('ingredient-rows');

  const row = document.createElement('div');
  row.className = 'ingredient-row';
  row.dataset.rowId = rowId;
  row.innerHTML = `
    <input type="text" placeholder="Ingredient name" class="ing-name" value="${ingredient?.name ? escapeHtml(ingredient.name) : ''}" required />
    <input type="number" step="0.01" min="0" placeholder="Qty" class="ing-qty" value="${ingredient?.quantity ?? ''}" required />
    <input type="text" placeholder="Unit" class="ing-unit" value="${ingredient?.unit ? escapeHtml(ingredient.unit) : ''}" />
    <button type="button" class="btn btn--ghost btn--icon" aria-label="Remove ingredient">&times;</button>
  `;
  row.querySelector('button').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

// -------------------- Save (create or update) --------------------
async function handleRecipeFormSubmit(event) {
  event.preventDefault();
  const form = event.target;
  clearFieldErrors(form);

  const name = form.name.value.trim();
  const instructions = form.instructions.value.trim();
  let hasError = false;

  if (!name) { setFieldError(form.name, 'Recipe name is required.'); hasError = true; }
  if (!instructions) { setFieldError(form.instructions, 'Instructions are required.'); hasError = true; }

  const ingredientRows = [...document.querySelectorAll('.ingredient-row')].map((row) => ({
    name: row.querySelector('.ing-name').value.trim(),
    quantity: parseFloat(row.querySelector('.ing-qty').value) || 0,
    unit: row.querySelector('.ing-unit').value.trim(),
  })).filter((i) => i.name);

  if (ingredientRows.length === 0) {
    showToast('Add at least one ingredient.', 'error');
    hasError = true;
  }
  if (hasError) return;

  const submitBtn = form.querySelector('button[type="submit"]');
  toggleLoading(submitBtn, true, 'Saving…');

  const recipePayload = {
    user_id: currentUserId,
    name,
    description: form.description.value.trim() || null,
    image_url: form.image_url.value.trim() || null,
    prep_time_minutes: parseInt(form.prep_time_minutes.value, 10) || 0,
    cook_time_minutes: parseInt(form.cook_time_minutes.value, 10) || 0,
    servings: parseInt(form.servings.value, 10) || 1,
    difficulty: form.difficulty.value,
    category: form.category.value,
    tags: form.tags.value.split(',').map((t) => t.trim()).filter(Boolean),
    instructions,
  };

  const existingId = form.id.value;
  let recipeId = existingId;
  let error;

  if (existingId) {
    ({ error } = await supabaseClient.from('recipes').update(recipePayload).eq('id', existingId));
  } else {
    const { data, error: insertError } = await supabaseClient
      .from('recipes').insert(recipePayload).select('id').single();
    error = insertError;
    recipeId = data?.id;
  }

  if (error) {
    toggleLoading(submitBtn, false);
    return showToast(friendlySupabaseError(error), 'error');
  }

  // Simplest correct approach: replace all ingredients for this recipe.
  await supabaseClient.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
  const { error: ingError } = await supabaseClient.from('recipe_ingredients').insert(
    ingredientRows.map((i, idx) => ({ ...i, recipe_id: recipeId, user_id: currentUserId, sort_order: idx }))
  );

  toggleLoading(submitBtn, false);

  if (ingError) return showToast(friendlySupabaseError(ingError), 'error');

  showToast(existingId ? 'Recipe updated.' : 'Recipe created.', 'success');
  closeRecipeModal();
  await loadRecipes();
}