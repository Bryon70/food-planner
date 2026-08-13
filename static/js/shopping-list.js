// ============================================================================
// static/js/shopping-list.js
// ============================================================================

let currentUserId = null;
let allItems = [];
let userRecipes = [];

(async function initShoppingListPage() {
  const session = await initAuthedNav();
  if (!session) return;
  currentUserId = session.user.id;

  await loadItems();
  wireEvents();
})();

// -------------------- Load + render --------------------
async function loadItems() {
  const { data, error } = await supabaseClient
    .from('shopping_list_items')
    .select('*')
    .order('category')
    .order('created_at', { ascending: false });

  if (error) return showToast(friendlySupabaseError(error), 'error');

  allItems = data;
  render();
}

function render() {
  const hidePurchased = document.getElementById('hide-purchased').checked;
  const visible = hidePurchased ? allItems.filter((i) => !i.is_purchased) : allItems;

  const purchasedCount = allItems.filter((i) => i.is_purchased).length;
  document.getElementById('progress-label').textContent =
    `${purchasedCount} of ${allItems.length} items purchased`;

  const container = document.getElementById('shopping-list-container');

  if (visible.length === 0) {
    container.innerHTML = `
      <div class="empty-state empty-state--large">
        <p>Your shopping list is empty.</p>
        <button class="btn btn--primary" onclick="openItemModal()">Add an item</button>
      </div>`;
    return;
  }

  // Group by category
  const groups = visible.reduce((acc, item) => {
    (acc[item.category] ||= []).push(item);
    return acc;
  }, {});

  container.innerHTML = Object.entries(groups).map(([category, items]) => `
    <div class="shopping-group">
      <h2 class="shopping-group__title">${capitalize(category)}</h2>
      ${items.map((item) => `
        <div class="shopping-item ${item.is_purchased ? 'shopping-item--purchased' : ''}">
          <label class="checkbox-label">
            <input type="checkbox" data-toggle-purchased="${item.id}" ${item.is_purchased ? 'checked' : ''} />
            <span>${escapeHtml(item.name)}</span>
          </label>
          <span class="shopping-item__qty">${item.quantity || ''} ${escapeHtml(item.unit || '')}</span>
          <div class="shopping-item__actions">
            <button class="btn btn--small btn--ghost" data-edit-item="${item.id}">Edit</button>
            <button class="btn btn--small btn--danger" data-delete-item="${item.id}">Delete</button>
          </div>
        </div>`).join('')}
    </div>`).join('');

  container.querySelectorAll('[data-toggle-purchased]').forEach((cb) =>
    cb.addEventListener('change', () => togglePurchased(cb.dataset.togglePurchased, cb.checked))
  );
  container.querySelectorAll('[data-edit-item]').forEach((btn) =>
    btn.addEventListener('click', () => openItemModal(btn.dataset.editItem))
  );
  container.querySelectorAll('[data-delete-item]').forEach((btn) =>
    btn.addEventListener('click', () => deleteItem(btn.dataset.deleteItem))
  );
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// -------------------- Toggle purchased --------------------
async function togglePurchased(itemId, isPurchased) {
  const { error } = await supabaseClient
    .from('shopping_list_items')
    .update({ is_purchased: isPurchased })
    .eq('id', itemId);

  if (error) return showToast(friendlySupabaseError(error), 'error');
  await loadItems();
}

// -------------------- Delete --------------------
async function deleteItem(itemId) {
  const confirmed = await confirmAction('Remove this item from your shopping list?', 'Delete Item');
  if (!confirmed) return;

  const { error } = await supabaseClient.from('shopping_list_items').delete().eq('id', itemId);
  if (error) return showToast(friendlySupabaseError(error), 'error');

  showToast('Item removed.', 'success');
  await loadItems();
}

// -------------------- Add/edit modal --------------------
function wireEvents() {
  document.getElementById('add-item-btn').addEventListener('click', () => openItemModal());
  document.getElementById('item-cancel-btn').addEventListener('click', closeItemModal);
  document.getElementById('item-form').addEventListener('submit', handleItemFormSubmit);
  document.getElementById('hide-purchased').addEventListener('change', render);

  document.getElementById('generate-from-recipe-btn').addEventListener('click', openRecipePicker);
  document.getElementById('recipe-picker-cancel-btn').addEventListener('click', closeRecipePicker);
  document.getElementById('recipe-picker-search').addEventListener('input', renderRecipePickerResults);
}

function openItemModal(itemId = null) {
  const form = document.getElementById('item-form');
  form.reset();
  const item = itemId ? allItems.find((i) => i.id === itemId) : null;

  document.getElementById('item-modal-title').textContent = item ? 'Edit Item' : 'Add Item';
  form.id.value = item?.id || '';
  if (item) {
    form.name.value = item.name;
    form.quantity.value = item.quantity;
    form.unit.value = item.unit || '';
    form.category.value = item.category;
  }

  const modal = document.getElementById('item-modal');
  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add('modal-overlay--visible'));
}

function closeItemModal() {
  const modal = document.getElementById('item-modal');
  modal.classList.remove('modal-overlay--visible');
  setTimeout(() => (modal.hidden = true), 160);
}

async function handleItemFormSubmit(event) {
  event.preventDefault();
  const form = event.target;
  clearFieldErrors(form);

  const name = form.name.value.trim();
  if (!name) {
    setFieldError(form.name, 'Item name is required.');
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  toggleLoading(submitBtn, true, 'Saving…');

  const payload = {
    user_id: currentUserId,
    name,
    quantity: parseFloat(form.quantity.value) || 0,
    unit: form.unit.value.trim(),
    category: form.category.value,
  };

  const existingId = form.id.value;
  const { error } = existingId
    ? await supabaseClient.from('shopping_list_items').update(payload).eq('id', existingId)
    : await supabaseClient.from('shopping_list_items').insert(payload);

  toggleLoading(submitBtn, false);

  if (error) return showToast(friendlySupabaseError(error), 'error');

  showToast(existingId ? 'Item updated.' : 'Item added.', 'success');
  closeItemModal();
  await loadItems();
}

// -------------------- Generate from recipe --------------------
async function openRecipePicker() {
  if (userRecipes.length === 0) {
    const { data } = await supabaseClient.from('recipes').select('id, name').order('name');
    userRecipes = data || [];
  }
  document.getElementById('recipe-picker-search').value = '';
  renderRecipePickerResults();

  const modal = document.getElementById('recipe-picker-modal');
  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add('modal-overlay--visible'));
}

function closeRecipePicker() {
  const modal = document.getElementById('recipe-picker-modal');
  modal.classList.remove('modal-overlay--visible');
  setTimeout(() => (modal.hidden = true), 160);
}

function renderRecipePickerResults() {
  const query = document.getElementById('recipe-picker-search').value.trim().toLowerCase();
  const results = userRecipes.filter((r) => r.name.toLowerCase().includes(query));
  const container = document.getElementById('recipe-picker-results');

  if (results.length === 0) {
    container.innerHTML = `<p class="empty-state">No recipes found.</p>`;
    return;
  }

  container.innerHTML = results.map((r) => `
    <button type="button" class="picker-result" data-recipe-id="${r.id}">${escapeHtml(r.name)}</button>
  `).join('');

  container.querySelectorAll('.picker-result').forEach((btn) =>
    btn.addEventListener('click', () => generateFromRecipe(btn.dataset.recipeId))
  );
}

async function generateFromRecipe(recipeId) {
  const { data, error } = await supabaseClient.rpc('generate_shopping_list_from_recipe', {
    p_recipe_id: recipeId,
  });

  if (error) return showToast(friendlySupabaseError(error), 'error');

  showToast(`Added ${data.length} ingredient${data.length === 1 ? '' : 's'} to your shopping list.`, 'success');
  closeRecipePicker();
  await loadItems();
}