# TableAI

TableAI is a Phase 1 micro-SaaS guest flow for hotels and restaurants. Guests open a hotel menu URL, enter party size, budget, food preference, spice level, and optional allergies, then receive an AI-generated combo of starters and mains sized for the group.

The current flow is hotel-based only. There is no table entity. A hotel has name, location, owner name, mobile number, email, and menu items.

## Stack

- Frontend: Next.js 14 App Router, TypeScript, Tailwind CSS
- Backend: Supabase Postgres, RLS, Edge Functions
- AI: Anthropic Claude API
- Deployment: Vercel for `frontend`, Supabase for `backend`

## Local Setup

1. Install frontend dependencies:

```bash
cd frontend
npm install
```

2. Create Supabase resources from `backend`:

```bash
supabase db reset
supabase functions serve suggest-meal --env-file .env
```

3. Add frontend env vars in `frontend/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
```

4. Add backend function env vars in `backend/.env`:

```bash
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
ANTHROPIC_API_KEY=your-anthropic-key
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

5. Run the frontend:

```bash
cd frontend
npm run dev
```

Open guest flow:

```text
http://localhost:3000/order?hotel_id=11111111-1111-1111-1111-111111111111
```

Open dashboard:

```text
http://localhost:3000/dashboard
```

## Phase 1 Scope

Included:

- Public guest order page
- Public dashboard to add hotel details and menu items
- AI menu text scan through `parse-menu`
- Public menu reads through RLS
- Public order inserts through RLS
- Claude meal suggestion with strict menu item validation
- One corrective retry
- Rule-based fallback
- Order confirmation update
- Seed hotel and 15 Indian menu items

Not included yet:

- Admin panel
- Staff auth
- Waiter dashboard
- Payments
- Item swap orchestration
