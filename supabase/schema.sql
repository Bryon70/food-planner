-- ============================================================================
-- FOOD PLANNER — Supabase PostgreSQL Schema
-- Run this entire file in the Supabase SQL Editor (Project → SQL Editor → New query)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- EXTENSIONS
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- ENUM TYPES
-- ----------------------------------------------------------------------------
do $$ begin
  create type difficulty_level as enum ('easy', 'medium', 'hard');
exception when duplicate_object then null; end $$;

do $$ begin
  create type meal_type as enum ('breakfast', 'lunch', 'dinner', 'snack');
exception when duplicate_object then null; end $$;

do $$ begin
  create type shopping_category as enum (
    'produce', 'dairy', 'meat', 'seafood', 'bakery', 'pantry',
    'frozen', 'beverages', 'spices', 'other'
  );
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- TABLE: profiles
-- One row per auth.users, created automatically via trigger below.
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Public profile data for each authenticated user.';

-- ----------------------------------------------------------------------------
-- TABLE: recipes
-- ----------------------------------------------------------------------------
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 150),
  description text check (char_length(description) <= 1000),
  image_url text,
  instructions text not null check (char_length(trim(instructions)) > 0),
  prep_time_minutes integer not null default 0 check (prep_time_minutes >= 0),
  cook_time_minutes integer not null default 0 check (cook_time_minutes >= 0),
  servings integer not null default 1 check (servings > 0),
  difficulty difficulty_level not null default 'medium',
  category text not null default 'other',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recipes_user_id on public.recipes(user_id);
create index if not exists idx_recipes_category on public.recipes(category);
create index if not exists idx_recipes_difficulty on public.recipes(difficulty);
create index if not exists idx_recipes_name_trgm on public.recipes using gin (to_tsvector('english', name));
create index if not exists idx_recipes_tags on public.recipes using gin (tags);

comment on table public.recipes is 'User-owned recipes.';

-- ----------------------------------------------------------------------------
-- TABLE: recipe_ingredients
-- ----------------------------------------------------------------------------
create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  quantity numeric(10,2) not null default 0 check (quantity >= 0),
  unit text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_recipe_ingredients_recipe_id on public.recipe_ingredients(recipe_id);
create index if not exists idx_recipe_ingredients_user_id on public.recipe_ingredients(user_id);

comment on table public.recipe_ingredients is 'Ingredients belonging to a recipe (name, quantity, unit).';

-- ----------------------------------------------------------------------------
-- TABLE: meal_plans
-- One row per scheduled meal (date + meal_type + recipe).
-- ----------------------------------------------------------------------------
create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid references public.recipes(id) on delete cascade,
  plan_date date not null,
  meal_type meal_type not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plan_date, meal_type, recipe_id)
);

create index if not exists idx_meal_plans_user_id on public.meal_plans(user_id);
create index if not exists idx_meal_plans_date on public.meal_plans(plan_date);
create index if not exists idx_meal_plans_user_date on public.meal_plans(user_id, plan_date);

comment on table public.meal_plans is 'Weekly meal planner entries linking a date/meal slot to a recipe.';

-- ----------------------------------------------------------------------------
-- TABLE: favorites
-- ----------------------------------------------------------------------------
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, recipe_id)
);

create index if not exists idx_favorites_user_id on public.favorites(user_id);
create index if not exists idx_favorites_recipe_id on public.favorites(recipe_id);

comment on table public.favorites is 'Join table: which recipes a user has favorited.';

-- ----------------------------------------------------------------------------
-- TABLE: shopping_list_items
-- ----------------------------------------------------------------------------
create table if not exists public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid references public.recipes(id) on delete set null,
  name text not null check (char_length(trim(name)) > 0),
  quantity numeric(10,2) not null default 1 check (quantity >= 0),
  unit text not null default '',
  category shopping_category not null default 'other',
  is_purchased boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_shopping_items_user_id on public.shopping_list_items(user_id);
create index if not exists idx_shopping_items_purchased on public.shopping_list_items(user_id, is_purchased);
create index if not exists idx_shopping_items_category on public.shopping_list_items(category);

comment on table public.shopping_list_items is 'User shopping list, optionally generated from planned recipes.';

-- ============================================================================
-- TRIGGERS: auto-update `updated_at`
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_recipes_updated_at on public.recipes;
create trigger trg_recipes_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();

drop trigger if exists trg_meal_plans_updated_at on public.meal_plans;
create trigger trg_meal_plans_updated_at
  before update on public.meal_plans
  for each row execute function public.set_updated_at();

drop trigger if exists trg_shopping_items_updated_at on public.shopping_list_items;
create trigger trg_shopping_items_updated_at
  before update on public.shopping_list_items
  for each row execute function public.set_updated_at();

-- ============================================================================
-- TRIGGER: auto-create a profile row when a new auth user signs up
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- FUNCTION: generate shopping list items from a recipe's ingredients
-- Callable from the client via supabase.rpc('generate_shopping_list_from_recipe', ...)
-- ============================================================================
create or replace function public.generate_shopping_list_from_recipe(p_recipe_id uuid)
returns setof public.shopping_list_items
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner uuid;
begin
  select user_id into v_owner from public.recipes where id = p_recipe_id;

  if v_owner is null or v_owner <> v_user_id then
    raise exception 'Recipe not found or not owned by current user';
  end if;

  return query
  insert into public.shopping_list_items (user_id, recipe_id, name, quantity, unit, category)
  select
    v_user_id,
    p_recipe_id,
    ri.name,
    ri.quantity,
    ri.unit,
    'other'::shopping_category
  from public.recipe_ingredients ri
  where ri.recipe_id = p_recipe_id
  returning *;
end;
$$;

-- ============================================================================
-- FUNCTION: dashboard summary stats (single round trip for the dashboard)
-- Callable via supabase.rpc('get_dashboard_stats')
-- ============================================================================
create or replace function public.get_dashboard_stats()
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result json;
begin
  select json_build_object(
    'total_recipes', (select count(*) from public.recipes where user_id = v_user_id),
    'total_favorites', (select count(*) from public.favorites where user_id = v_user_id),
    'meals_planned_this_week', (
      select count(*) from public.meal_plans
      where user_id = v_user_id
        and plan_date >= date_trunc('week', current_date)::date
        and plan_date < (date_trunc('week', current_date) + interval '7 days')::date
    ),
    'shopping_items_pending', (
      select count(*) from public.shopping_list_items
      where user_id = v_user_id and is_purchased = false
    ),
    'shopping_items_purchased', (
      select count(*) from public.shopping_list_items
      where user_id = v_user_id and is_purchased = true
    ),
    'todays_meals', (
      select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
        select mp.id, mp.meal_type, mp.plan_date, r.id as recipe_id, r.name as recipe_name, r.image_url
        from public.meal_plans mp
        left join public.recipes r on r.id = mp.recipe_id
        where mp.user_id = v_user_id and mp.plan_date = current_date
        order by array_position(array['breakfast','lunch','dinner','snack'], mp.meal_type::text)
      ) t
    ),
    'upcoming_meals', (
      select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
        select mp.id, mp.meal_type, mp.plan_date, r.id as recipe_id, r.name as recipe_name, r.image_url
        from public.meal_plans mp
        left join public.recipes r on r.id = mp.recipe_id
        where mp.user_id = v_user_id
          and mp.plan_date > current_date
          and mp.plan_date <= current_date + interval '6 days'
        order by mp.plan_date, array_position(array['breakfast','lunch','dinner','snack'], mp.meal_type::text)
        limit 8
      ) t
    ),
    'category_breakdown', (
      select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
        select category, count(*) as count
        from public.recipes
        where user_id = v_user_id
        group by category
        order by count desc
      ) t
    )
  ) into v_result;

  return v_result;
end;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.meal_plans enable row level security;
alter table public.favorites enable row level security;
alter table public.shopping_list_items enable row level security;

-- profiles ---------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- recipes ------------------------------------------------------------------
drop policy if exists "recipes_select_own" on public.recipes;
create policy "recipes_select_own" on public.recipes
  for select using (auth.uid() = user_id);

drop policy if exists "recipes_insert_own" on public.recipes;
create policy "recipes_insert_own" on public.recipes
  for insert with check (auth.uid() = user_id);

drop policy if exists "recipes_update_own" on public.recipes;
create policy "recipes_update_own" on public.recipes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "recipes_delete_own" on public.recipes;
create policy "recipes_delete_own" on public.recipes
  for delete using (auth.uid() = user_id);

-- recipe_ingredients ---------------------------------------------------------
drop policy if exists "ingredients_select_own" on public.recipe_ingredients;
create policy "ingredients_select_own" on public.recipe_ingredients
  for select using (auth.uid() = user_id);

drop policy if exists "ingredients_insert_own" on public.recipe_ingredients;
create policy "ingredients_insert_own" on public.recipe_ingredients
  for insert with check (auth.uid() = user_id);

drop policy if exists "ingredients_update_own" on public.recipe_ingredients;
create policy "ingredients_update_own" on public.recipe_ingredients
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "ingredients_delete_own" on public.recipe_ingredients;
create policy "ingredients_delete_own" on public.recipe_ingredients
  for delete using (auth.uid() = user_id);

-- meal_plans -----------------------------------------------------------------
drop policy if exists "meal_plans_select_own" on public.meal_plans;
create policy "meal_plans_select_own" on public.meal_plans
  for select using (auth.uid() = user_id);

drop policy if exists "meal_plans_insert_own" on public.meal_plans;
create policy "meal_plans_insert_own" on public.meal_plans
  for insert with check (auth.uid() = user_id);

drop policy if exists "meal_plans_update_own" on public.meal_plans;
create policy "meal_plans_update_own" on public.meal_plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "meal_plans_delete_own" on public.meal_plans;
create policy "meal_plans_delete_own" on public.meal_plans
  for delete using (auth.uid() = user_id);

-- favorites --------------------------------------------------------------
drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own" on public.favorites
  for select using (auth.uid() = user_id);

drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own" on public.favorites
  for insert with check (auth.uid() = user_id);

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own" on public.favorites
  for delete using (auth.uid() = user_id);

-- shopping_list_items ------------------------------------------------------
drop policy if exists "shopping_items_select_own" on public.shopping_list_items;
create policy "shopping_items_select_own" on public.shopping_list_items
  for select using (auth.uid() = user_id);

drop policy if exists "shopping_items_insert_own" on public.shopping_list_items;
create policy "shopping_items_insert_own" on public.shopping_list_items
  for insert with check (auth.uid() = user_id);

drop policy if exists "shopping_items_update_own" on public.shopping_list_items;
create policy "shopping_items_update_own" on public.shopping_list_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "shopping_items_delete_own" on public.shopping_list_items;
create policy "shopping_items_delete_own" on public.shopping_list_items
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
