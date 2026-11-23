# Shrutam

Multi-tenant paathshala portal with Student and Teacher memberships, plus a separate platform-admin console.

Each person has one Auth login. Student and Teacher roles belong to a person’s membership in a specific paathshala, so the same login can hold either or both roles in multiple spaces. After login, users choose a role-specific view from `/spaces` when they have more than one option.

Students request access using a paathshala code; an active teacher or platform administrator approves the membership and creates the student profile linked to that Auth user. Teachers can request access the same way and may be assigned to zero or more classes. Student access is limited to the student's own profile, enrolled classes, and attendance history.

Each paathshala maintains its own course catalogue. Courses can contain nested topics, and a class can be assigned multiple courses. Students see the classes and courses assigned to their enrollment.

Classes can meet on multiple weekdays. Attendance is stored by class and actual session date, so changing a recurring schedule does not rewrite recorded sessions. Events have a paid/free flag; payment collection is not implemented.

Teachers can create scenario trackers for selected classes and mark each learner’s status. Students can view tracker status for their enrolled classes but cannot edit it.

Paathshala changes are recorded in `public.audit_logs`, including the actor and before/after row data. Teachers can review the tenant activity log; platform administrators can review platform-level changes.

## Run

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3001. Add your Supabase URL and public key to `.env.local` before signing in; without them, the app shows setup guidance instead of sample records. Use `npm run lint` and `npm run build` to validate changes.

The app reads `NEXT_PUBLIC_SUPABASE_URL` and either `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Use a public/anon key only; never expose a service-role key to browser code.

## Supabase

The desired database schema is the source of truth in `supabase/schemas/`, split by domain. `supabase/migrations/` contains the append-only SQL history that gets applied to databases; don't edit a migration after it has been applied to a shared database.

1. Edit the appropriate SQL file under `supabase/schemas/`.
2. With Supabase CLI 2.115 or newer, generate a migration with `npm run db:sync -- -f describe_the_change --no-apply`.
3. Review the generated SQL in `supabase/migrations/`, test it locally, and commit both the schema edit and migration.
4. The Supabase GitHub integration applies committed, unapplied migration files after pushes or merges to its configured production branch. Set the repository working directory to `.` and enable **Deploy to production** in the integration settings.
5. To push manually instead, authenticate with `supabase login`, link a local checkout with `supabase link --project-ref <project-ref>`, and run `supabase db push`. Verify local and remote migration history with `supabase migration list`.
6. Create the first Auth user, then add its UUID to `public.platform_admins` in the SQL Editor:

	```sql
	insert into public.platform_admins (user_id)
	values ('<auth-user-uuid>');
	```

	That account can sign in at `/platform` to provision paathshalas and approve Teacher or Student memberships. New members can request access by tenant code.

The GitHub integration deploys migration files, not declarative schema files. A schema edit must be synced into a reviewed migration before it can be deployed.

For Vercel, use the repository root (`.`) as the Root Directory and the Next.js preset. If syncing credentials through the Supabase/Vercel integration, use the `NEXT_PUBLIC_` prefix and enable Production sync. Confirm the environment variable names above appear in Vercel, then redeploy the app. Vercel deploys the UI; Supabase applies the database migrations.

Never expose a Supabase service-role key in browser code. Tenant data is isolated by row-level security.