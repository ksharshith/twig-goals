# Twig Goal

A polished, browser-first financial goal tracking dashboard with Apple-inspired visuals, smart savings projections, interactive analytics, and optional Supabase cloud sync.

Twig Goal helps users define savings goals, track deposits/withdrawals, forecast monthly pace, and monitor progress through rings, charts, and milestone celebrations.

## Highlights

- Multi-view interface: Dashboard, Goals, Analytics, Settings
- Goal lifecycle management: create, edit, delete, and categorize goals
- Contribution logging: deposits and withdrawals with per-goal history
- Smart insights engine: projected monthly and daily savings recommendations
- Visual analytics:
	- Concentric activity rings (top active goals)
	- Goal progress comparison chart
	- Savings distribution donut chart
- Theme switching: dark and light modes
- Multi-currency formatting (USD, EUR, GBP, JPY, INR, AUD, CAD)
- Data portability: JSON export/import backup
- Optional cloud sync via Supabase + device sync code linking
- Celebration effects with confetti when goals are completed

## Tech Stack

- HTML5 + CSS (modular stylesheets)
- Vanilla JavaScript (ES modules)
- Browser localStorage for offline-first persistence
- Optional Supabase client via CDN for cloud sync

No build tools or package manager are required for local development.

## Project Structure

```text
twig-goals/
├── index.html
├── README.md
└── src/
		├── css/
		│   ├── animations.css
		│   ├── components.css
		│   ├── layout.css
		│   ├── main.css
		│   ├── modals.css
		│   └── variables.css
		└── js/
				├── main.js
				├── config/
				│   └── supabase.js
				├── core/
				│   ├── insights.js
				│   └── state.js
				└── components/
						├── charts.js
						├── confetti.js
						└── rings.js
```

## How It Works

### Data Layer

- `src/js/core/state.js` is the source of truth for app state:
	- goals
	- transactions
	- theme
	- currency
	- syncCode
- State is cached in localStorage under a single storage key.
- If cloud sync is enabled, state operations upsert/delete records in Supabase and can pull remote state.

### Intelligence Layer

- `src/js/core/insights.js` computes recommendation messages such as:
	- per-goal monthly savings pace
	- per-goal daily pace
	- deadline warnings
	- aggregate monthly budget required across active goals

### Presentation Layer

- `src/js/components/rings.js`: top 3 active goals in concentric ring format.
- `src/js/components/charts.js`: comparison bars + savings distribution donut.
- `src/js/components/confetti.js`: celebration particle effect.
- `src/js/main.js`: view routing, event bindings, modal flows, and orchestration.

## Getting Started

### Option 1: Open directly in browser

1. Navigate to `twig-goals/`.
2. Open `index.html` in a modern browser.

### Option 2: Run with a local static server (recommended)

From `twig-goals/`, start any static file server, for example:

```bash
python3 -m http.server 5173
```

Then open:

```text
http://localhost:5173
```

## Cloud Sync Setup (Optional)

By default, the app runs fully offline with localStorage.

To enable Supabase sync:

1. Create a Supabase project.
2. In `src/js/config/supabase.js`, replace placeholder values:
	 - `SUPABASE_URL`
	 - `SUPABASE_ANON_KEY`
3. Create tables matching app expectations.

Suggested minimal schema:

```sql
create table if not exists goals (
	id text primary key,
	user_id text not null,
	name text not null,
	target numeric not null,
	current numeric not null,
	deadline date not null,
	category text not null,
	color text not null
);

create table if not exists transactions (
	id text primary key,
	user_id text not null,
	goal_id text not null,
	goal_name text not null,
	type text not null,
	amount numeric not null,
	timestamp timestamptz not null
);
```

The app uses a generated `syncCode` (`user_id`) to associate records per user/device context.

## Primary User Flows

1. Create a goal with target amount and deadline.
2. Log deposits/withdrawals from cards or detail modal.
3. Monitor progress on dashboard rings and analytics charts.
4. Review smart insights for savings pace recommendations.
5. Export/import backup JSON from Settings as needed.
6. Optionally link another device with a sync code.

## Browser Compatibility

- Chrome (latest)
- Edge (latest)
- Firefox (latest)
- Safari (latest)

## Troubleshooting

### Cloud sync shows local/offline status

- Confirm valid Supabase values in `src/js/config/supabase.js`.
- Verify Supabase JS CDN loads successfully.
- Confirm required tables exist and allow expected operations.

### Imported backup not applied

- Ensure imported file is valid JSON.
- Verify it contains at least a `goals` array.

### Charts appear empty

- Rings require active goals (`current < target`).
- Distribution chart requires at least one goal with `current > 0`.

## Version

Current in-app version label: `1.0.0`.

## Notes

- This is a frontend-only app with optional cloud data integration.
- No server or Node runtime is required for core usage.