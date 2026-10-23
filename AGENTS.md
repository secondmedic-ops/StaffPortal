# Working rules – speed and autonomy first

1. Work fully autonomously. Never stop to ask me questions; choose sensible defaults and note your assumptions at the end.
2. Do not wait for approval between steps. Plan briefly, then execute the whole task in one continuous run.
3. Token usage does not matter — prefer thoroughness and correctness over saving tokens.
4. After every change: run the app/build, open it in the browser, check the console and terminal for errors, and fix them yourself. Repeat until it works with zero errors.
5. Split large tasks into independent parts and handle them in parallel where possible.
6. Before starting a big task, make a git commit (or create a new branch) so changes can be rolled back.
7. Never run destructive commands (rm -rf, force push, dropping databases, deleting data, deploying to production) without asking me first.
8. Keep code clean: consistent naming, no unused code, short comments only where logic is non-obvious.
9. Only report back when the task is fully done and tested. Final report: what changed, files touched, assumptions made, anything I must do manually.

---

# Project context

### Overview
SecondMedic Staff Portal is an internal HR, Attendance, Payroll, and Operations platform for SecondMedic healthcare staff. It covers mobile & web attendance punch, multi-level leave approvals, holiday calendars, KPI reviews, asset tracking, and role-segregated payroll processing.

### Tech Stack
- **Frontend**: React 18, TypeScript, Vite
- **Styling & UI**: Tailwind CSS, Lucide React icons
- **State & Routing**: React Context (`AuthContext`, `PendingCountsContext`, `ThemeContext`), state-based view router
- **Backend / DB**: Supabase (PostgreSQL with Row Level Security, Supabase Auth, Storage)
- **Deployment**: Cloudflare Workers (Static Assets, configured via `wrangler.toml`)
- **Testing**: Node.js test runner with `tsx` (`src/lib/payrollEngine.test.ts`)

### Folder Layout
```text
StaffPortal/
├── .agent/rules/         # Agent guidelines and operating rules
├── public/               # Static assets, official branding logos, favicon
├── src/
│   ├── api/              # Supabase REST data layers (me, hr, accounts, it, ceo, lifecycle, etc.)
│   ├── components/       # Domain-specific UI modules:
│   │   ├── accounts/     # Payroll processing, salary structures, payslip generation
│   │   ├── admin/        # System users, role management, audit logs
│   │   ├── auth/         # Login screens, password recovery
│   │   ├── ceo/          # Executive dashboard, org chart, company metrics
│   │   ├── common/       # Modals, status pills, headers, skeleton loaders, branding
│   │   ├── employee/     # Dashboard, attendance register, apply leave, my assets
│   │   ├── hr/           # Staff registration, master directory, lifecycle, holidays
│   │   └── it/           # Asset register, IT hardware inventory, service requests
│   ├── config/           # Company constants, policy rules, navigation, holiday templates
│   ├── context/          # Global auth session, role permissions, notification toasts
│   ├── lib/              # Supabase client singleton, Indian payroll & tax engine
│   ├── types/            # TypeScript schemas and database type definitions
│   └── utils/            # Date formatting, Indian currency helpers, calculations
├── supabase/
│   ├── functions/        # Supabase Edge Functions (Deno): send-email, daily-jobs
│   └── migrations/       # Idempotent PostgreSQL schema definitions, RLS, seed scripts
├── wrangler.toml         # Cloudflare Workers preview & production configuration
└── AGENTS.md             # Autonomy operating instructions & project context
```

### How to Run the App
- **Install dependencies**: `npm install`
- **Start development server**: `npm run dev` (starts Vite dev server at `http://localhost:5173`)
- **Run test suite**: `npm test` (executes 48 unit tests verifying statutory PF, ESI, PT, LOP, and overtime calculations)
- **Type-check**: `npx tsc --noEmit`
- **Build production bundle**: `npm run build` (outputs optimized assets to `./dist`)
- **Preview production build locally**: `npm run preview`
- **Deploy**: Merging into branch `main` triggers automated Cloudflare Workers Builds deployment to `https://staffportal.secondmedic.workers.dev`.

### Supabase Edge Functions Secrets Setup
All outbound automated notifications and daily background jobs read credentials strictly from Supabase function secrets (never committed to Git or exposed in `.env`):

```bash
supabase secrets set \
  SMTP_HOST="smtp.gmail.com" \
  SMTP_PORT="465" \
  SMTP_SECURE="true" \
  SMTP_USER="placeholder@gmail.com" \
  SMTP_PASS="placeholder_app_password" \
  SMTP_FROM_NAME="Second Medic" \
  SMTP_FROM_EMAIL="notifications@secondmedic.com" \
  APP_BASE_URL="https://staffportal.secondmedic.workers.dev" \
  HR_EMAIL="hr@secondmedic.com" \
  SMTP_DEBUG="false"
```

Deploying functions:
```bash
supabase functions deploy send-email
supabase functions deploy daily-jobs
```
