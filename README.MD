# Food Planner

A full-stack meal planning web app — schedule weekly meals, manage recipes,
generate shopping lists, and track favorites — built entirely on Supabase
(PostgreSQL + Auth) with a vanilla HTML/CSS/JS frontend, deployable to
GitHub Pages with zero backend server.

## Features

- **Auth**: Secure registration, login, logout, persistent sessions via Supabase Auth
- **Dashboard**: Today's meals, upcoming meals, stats, and a category breakdown chart
- **Meal Planner**: Weekly grid (breakfast/lunch/dinner/snack), week navigation, add/remove meals
- **Recipes**: Full CRUD, search, filter (category/difficulty/time/tags), sort, favoriting
- **Ingredients**: Relational per-recipe ingredients (name, quantity, unit)
- **Favorites**: Dedicated favorites view backed by a join table
- **Shopping List**: Manual CRUD, category grouping, purchased toggle, and one-click
  "generate from recipe" using a Postgres RPC function
- **Security**: Row Level Security on every table — users can only ever see and modify
  their own data
- **Responsive**: Full desktop, tablet, and mobile support

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (no framework, no build step)
- **Backend**: Supabase (PostgreSQL, Auth, Row Level Security, RPC functions)
- **Hosting**: GitHub Pages (static frontend), Supabase (managed backend)
- **Charts**: Chart.js (CDN)

## Project Structure

\`\`\`
food-planner/
├── index.html
├── login.html
├── register.html
├── dashboard.html
├── planner.html
├── recipes.html
├── favorites.html
├── shopping-list.html
├── profile.html
├── static/
│   ├── css/style.css
│   ├── js/
│   │   ├── supabaseClient.js
│   │   ├── notifications.js
│   │   ├── auth.js
│   │   ├── dashboard.js
│   │   ├── recipes.js
│   │   ├── planner.js
│   │   ├── favorites.js
│   │   ├── shopping-list.js
│   │   └── profile.js
│   └── img/
└── supabase/
    └── schema.sql
\`\`\`

## Supabase Setup

1. Create a project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor → New query**, paste the entire contents of
   \`supabase/schema.sql\`, and run it. This creates all tables, indexes,
   triggers, RPC functions, and Row Level Security policies.
3. Go to **Table Editor** and confirm six tables exist: \`profiles\`,
   \`recipes\`, \`recipe_ingredients\`, \`meal_plans\`, \`favorites\`,
   \`shopping_list_items\`.

## Configuration

Go to **Settings → API** in your Supabase dashboard and copy:
- **Project URL**
- **anon / publishable key**

Paste both into \`static/js/supabaseClient.js\`:

\`\`\`javascript
const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-PUBLIC-ANON-KEY';
\`\`\`

**Never use the \`service_role\` key here** — it bypasses Row Level Security
entirely and must never appear in frontend code.

## Authentication Setup

Supabase Auth is enabled by default with email/password sign-up. No extra
configuration is required. Optionally, in **Authentication → Settings**,
toggle "Confirm email" on or off depending on whether you want new users to
verify their email before signing in.

## Local Development

1. Clone this repo.
2. Complete the Supabase Setup and Configuration steps above.
3. Open the project folder in VS Code.
4. Install the **Live Server** extension.
5. Right-click \`index.html\` → **Open with Live Server**.
6. The app opens at \`http://127.0.0.1:5500\`.

No build step, no \`npm install\` — it's plain static files.

## GitHub Setup

\`\`\`bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/food-planner.git
git push -u origin main
\`\`\`

## GitHub Pages Deployment

1. In your GitHub repo, go to **Settings → Pages**.
2. Under **Source**, select **Deploy from a branch**.
3. Choose the **main** branch and **/ (root)** folder.
4. Click **Save**.
5. Your app will be live at \`https://YOUR-USERNAME.github.io/food-planner/\`.

## Security

- Every table has Row Level Security enabled — policies restrict all
  select/insert/update/delete operations to rows where \`user_id = auth.uid()\`.
- The Supabase anon/publishable key is safe to expose publicly; it has no
  power beyond what RLS policies allow.
- The \`service_role\` key is never used in this project's frontend.
- All user input is validated client-side (see \`static/js/auth.js\`) and
  constrained server-side via SQL \`check\` constraints in \`schema.sql\`.

## Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| `Failed to fetch` in console | Wrong Supabase URL, or not running via Live Server | Confirm `SUPABASE_URL`, confirm address bar shows `127.0.0.1` not `file://` |
| `Invalid API key` | Wrong/mistyped anon key | Re-copy from Supabase Settings → API |
| `relation "public.recipes" does not exist` | Schema not yet run | Re-run `supabase/schema.sql` in the SQL Editor |
| `new row violates row-level security policy` | Action attempted while logged out, or wrong `user_id` | Confirm session is active; check RLS policies match `auth.uid()` |
| Page loads unstyled | `static/css/style.css` not linked or empty | Confirm the `<link rel="stylesheet">` tag path is correct |

## License

[Choose a license, e.g. MIT — add a LICENSE file if you want this to be reusable by others]