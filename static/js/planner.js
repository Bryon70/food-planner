
// ============================================================================
// static/js/planner.js
// ============================================================================

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

let currentUserId = null;
let weekStart = getMonday(new Date()); // Date object, always a Monday
let weekMeals = [];       // meal_plans rows for the visible week
let userRecipes = [];     // cached for the picker
let activeSlot = null;    // { date: 'YYYY-MM-DD', mealType: 'lunch' }

(async function initPlannerPage() {
  const session = await initAuthedNav();
  if (!session) return;
  currentUserId = session.user.id;

  const { data: recipes } = await supabaseClient
    .from('recipes')
    .select('id, name, image_url')
    .order('name');
  userRecipes = recipes || [];

  await loadWeek();
  wireControls();
})();

// -------------------- Date helpers --------------------
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISODate(date) {
  return date.toISOString().split('T')[0];
}

function weekDates() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

// -------------------- Load + render --------------------
async function loadWeek() {
  const dates = weekDates();
  const startISO = toISODate(dates[0]);
  const endISO = toISODate(dates[6]);

  const { data, error } = await supabaseClient
    .from('meal_plans')
    .select('id, plan_date, meal_type, notes, recipes(id, name, image_url)')
    .gte('plan_date', startISO)
    .lte('plan_date', endISO);

  if (error) {
    showToast(friendlySupabaseError(error), 'error');
    return;
  }

  weekMeals = data;
  renderWeekLabel(dates);
  renderGrid(dates);
}

function renderWeekLabel(dates) {
  const fmt = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  document.getElementById('week-range-label').textContent = `${fmt(dates[0])} – ${fmt(dates[6])}`;
}

function renderGrid(dates) {
  const grid = document.getElementById('planner-grid');

  let html = `<div class="planner-grid__header-row">
    <div class="planner-grid__corner"></div>
    ${dates.map((d, i) => `
      <div class="planner-grid__day-header ${isToday(d) ? 'planner-grid__day-header--today' : ''}">
        <span>${DAY_LABELS[i]}</span>
        <span class="planner-grid__day-date">${d.getDate()}</span>
      </div>`).join('')}
  </div>`;

  MEAL_TYPES.forEach((mealType) => {
    html += `<div class="planner-grid__row">
      <div class="planner-grid__row-label">${capitalize(mealType)}</div>
      ${dates.map((d) => renderCell(toISODate(d), mealType)).join('')}
    </div>`;
  });

  grid.innerHTML = html;

  grid.querySelectorAll('[data-add-slot]').forEach((btn) =>
    btn.addEventListener('click', () => openPicker(btn.dataset.date, btn.dataset.mealType))
  );
  grid.querySelectorAll('[data-remove-meal]').forEach((btn) =>
    btn.addEventListener('click', () => removeMeal(btn.dataset.removeMeal))
  );
}

function renderCell(dateISO, mealType) {
  const mealsInSlot = weekMeals.filter((m) => m.plan_date === dateISO && m.meal_type === mealType);

  const chips = mealsInSlot.map((m) => `
    <div class="meal-chip">
      <span>${escapeHtml(m.recipes?.name || 'Untitled')}</span>
      <button type="button" data-remove-meal="${m.id}" aria-label="Remove">&times;</button>
    </div>`).join('');

  return `
    <div class="planner-grid__cell">
      ${chips}
      <button type="button" class="planner-grid__add-btn" data-add-slot data-date="${dateISO}" data-meal-type="${mealType}">+ Add</button>
    </div>`;
}

function isToday(date) {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// -------------------- Week navigation --------------------
function wireControls() {
  document.getElementById('prev-week-btn').addEventListener('click', () => shiftWeek(-7));
  document.getElementById('next-week-btn').addEventListener('click', () => shiftWeek(7));
  document.getElementById('this-week-btn').addEventListener('click', () => {
    weekStart = getMonday(new Date());
    loadWeek();
  });
  document.getElementById('picker-cancel-btn').addEventListener('click', closePicker);
  document.getElementById('picker-search').addEventListener('input', renderPickerResults);
}

function shiftWeek(days) {
  weekStart.setDate(weekStart.getDate() + days);
  loadWeek();
}

// -------------------- Recipe picker modal --------------------
function openPicker(dateISO, mealType) {
  activeSlot = { date: dateISO, mealType };
  document.getElementById('picker-slot-label').textContent =
    `${capitalize(mealType)} · ${new Date(dateISO + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}`;
  document.getElementById('picker-search').value = '';
  renderPickerResults();

  const modal = document.getElementById('picker-modal');
  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add('modal-overlay--visible'));
}

function closePicker() {
  const modal = document.getElementById('picker-modal');
  modal.classList.remove('modal-overlay--visible');
  setTimeout(() => (modal.hidden = true), 160);
  activeSlot = null;
}

function renderPickerResults() {
  const query = document.getElementById('picker-search').value.trim().toLowerCase();
  const results = userRecipes.filter((r) => r.name.toLowerCase().includes(query));
  const container = document.getElementById('picker-results');

  if (results.length === 0) {
    container.innerHTML = `<p class="empty-state">No recipes found. <a href="recipes.html">Add one first.</a></p>`;
    return;
  }

  container.innerHTML = results.map((r) => `
    <button type="button" class="picker-result" data-recipe-id="${r.id}">
      <span>${escapeHtml(r.name)}</span>
    </button>`).join('');

  container.querySelectorAll('.picker-result').forEach((btn) =>
    btn.addEventListener('click', () => assignMeal(btn.dataset.recipeId))
  );
}

async function assignMeal(recipeId) {
  if (!activeSlot) return;

  const { error } = await supabaseClient.from('meal_plans').insert({
    user_id: currentUserId,
    recipe_id: recipeId,
    plan_date: activeSlot.date,
    meal_type: activeSlot.mealType,
  });

  if (error) {
    if (error.message.includes('duplicate key')) {
      showToast('That recipe is already scheduled for this slot.', 'error');
    } else {
      showToast(friendlySupabaseError(error), 'error');
    }
    return;
  }

  showToast('Meal added.', 'success');
  closePicker();
  await loadWeek();
}

// -------------------- Remove --------------------
async function removeMeal(mealPlanId) {
  const { error } = await supabaseClient.from('meal_plans').delete().eq('id', mealPlanId);
  if (error) return showToast(friendlySupabaseError(error), 'error');
  await loadWeek();
}