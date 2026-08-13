// ============================================================================
// static/js/dashboard.js
// ============================================================================

(async function initDashboard() {
  const session = await initAuthedNav(); // guards + fills nav + returns session
  if (!session) return;

  const { data: stats, error } = await supabaseClient.rpc('get_dashboard_stats');

  if (error) {
    showToast(friendlySupabaseError(error), 'error');
    return;
  }

  renderStatCards(stats);
  renderMealList('todays-meals', stats.todays_meals, 'No meals planned for today yet.');
  renderMealList('upcoming-meals', stats.upcoming_meals, 'Nothing scheduled for the coming week.');
  renderCategoryChart(stats.category_breakdown);
})();

function renderStatCards(stats) {
  const grid = document.getElementById('stat-grid');
  const cards = [
    { label: 'Total Recipes', value: stats.total_recipes },
    { label: 'Favorites', value: stats.total_favorites },
    { label: 'Meals This Week', value: stats.meals_planned_this_week },
    { label: 'Shopping Items Pending', value: stats.shopping_items_pending },
  ];

  grid.innerHTML = cards
    .map((c) => `
      <div class="stat-card">
        <p class="stat-card__value">${c.value}</p>
        <p class="stat-card__label">${c.label}</p>
      </div>
    `)
    .join('');
}

function renderMealList(containerId, meals, emptyMessage) {
  const container = document.getElementById(containerId);

  if (!meals || meals.length === 0) {
    container.innerHTML = `<p class="empty-state">${emptyMessage}</p>`;
    return;
  }

  container.innerHTML = meals
    .map((m) => `
      <div class="meal-list__item">
        <span class="badge badge--${m.meal_type}">${m.meal_type}</span>
        <span>${m.recipe_name || 'Unnamed meal'}</span>
        <span class="meal-list__date">${m.plan_date}</span>
      </div>
    `)
    .join('');
}

function renderCategoryChart(breakdown) {
  const canvas = document.getElementById('category-chart');
  if (!breakdown || breakdown.length === 0) {
    canvas.replaceWith(Object.assign(document.createElement('p'), {
      className: 'empty-state',
      textContent: 'Add recipes to see your category breakdown.',
    }));
    return;
  }

  new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: breakdown.map((b) => b.category),
      datasets: [{
        data: breakdown.map((b) => b.count),
        backgroundColor: ['#2F6844', '#E7A93E', '#C4462B', '#5B8C6E', '#D9B26F', '#7A9E8A'],
      }],
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
  });
}