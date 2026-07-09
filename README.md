# DARMS — Department Academic Resource Management System

CIS Department academic archive for Covenant University. See
`DARMS-architecture-specification.md` for the full design rationale.

## Project structure (why files are split this way)

```
supabase/migrations/     One numbered SQL file per schema concern — run in
                         order. Never one giant schema file: this way you can
                         see exactly which migration introduced which table,
                         and re-run/rollback individual pieces later.
src/lib/supabase/        Two separate clients (client.ts vs server.ts) because
                         Supabase's browser and server auth handling differ —
                         mixing them causes subtle auth bugs.
src/lib/validation/      One Zod schema file per resource (uploads, courses).
                         Add a new file here, don't grow an existing one, when
                         you add a new form.
src/lib/naming/          The filename-generation logic, isolated so it can be
                         unit-tested on its own.
src/lib/permissions/     UI-only permission checks. Real enforcement is always
                         in supabase/migrations/0010_rls_policies.sql.
src/app/api/<resource>/  One route.ts per resource — add /api/uploads/[id]/
                         approve/route.ts etc. as new actions are needed,
                         rather than branching on an action param in one file.
src/app/(public|auth|dashboard)/  Route groups keep public pages, auth pages,
                         and the logged-in dashboard visually and logically
                         separate without affecting the URL structure.
```

## 1. Local setup

```bash
git clone <your-repo-url>
cd darms
npm install
cp .env.example .env.local
# now paste your real Supabase URL + anon key into .env.local
```

## 2. Set up the database

Install the Supabase CLI (one-time):

```bash
npm install -g supabase
```

Link to your project (find `<project-ref>` in your Supabase project URL):

```bash
supabase link --project-ref <project-ref>
```

Push all migrations in order:

```bash
supabase db push
```

This runs every file in `supabase/migrations/` in numeric order — that's why
they're numbered `0001`, `0002`, etc. Never rename them out of order.

## 3. Create your first Super Administrator

Sign up once through the app (so a `profiles` row exists for you), then run
this once in the Supabase SQL Editor, replacing the email:

```sql
insert into permission_assignments (profile_id, permission_id, granted_by)
select p.id, perm.id, p.id
from profiles p
cross join permissions perm
where p.email = 'you@cu.edu.ng';
-- This grants every permission with no scope restriction (null scope = all).
-- That is what "Super Administrator" means in this system — see §6 of the
-- architecture doc. There is no special-cased "super admin" code path.
```

## 4. Run locally

```bash
npm run dev
```

Visit http://localhost:3000.

## 5. Deploy

Push this repo to GitHub, then in Vercel: "Add New Project" → import the repo
→ add the same three environment variables from `.env.local` under
Project Settings → Environment Variables → deploy.

## 6. What's built so far vs. what's next

**Built:** full schema + RLS (migrations 0001–0010), auth with CU-domain
enforcement, naming service, upload creation API, course listing/request API,
landing page, sign-in page.

**Not yet built (see the roadmap in the architecture doc, §13):** admin review
dashboard UI, course browsing/detail pages, file upload-to-storage wiring,
notifications UI, AI pipeline edge functions. Build these next, one route
group / one API resource at a time, following the same "one file per
responsibility" pattern used so far.
