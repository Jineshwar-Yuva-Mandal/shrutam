# Shrutam

Multi-tenant paathshala portal with parent and teacher memberships, plus a separate platform-admin console.

Each person has one Auth login. Parent and teacher roles belong to a person’s membership in a specific paathshala, so the same login can be a teacher in one space, a parent in another, or both in the same space. Login routes users with multiple spaces to `/spaces`; capabilities come from each paathshala membership.

Parents manage all their children from one account, with a separate enrollment request for each child. Teachers request access by paathshala code; an active teacher or platform administrator approves the request. Teachers can manage paathshala records and may be assigned to zero or more classes. Students do not sign in separately.

Each paathshala maintains its own course catalogue. Courses can contain nested topics, and a class can be assigned multiple courses. Parents see the class teacher and attached courses in their family view.

Teachers can create scenario trackers for selected classes and mark each learner’s status. Parents can view tracker status for their linked children but cannot edit it.

Paathshala changes are recorded in `public.audit_logs`, including the actor and before/after row data. Teachers can review the tenant activity log; platform administrators can review platform-level changes.

## Run

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3001. Add your Supabase URL and public key to `.env.local` before signing in; without them, the app shows setup guidance instead of sample records. Use `npm run lint` and `npm run build` to validate changes.

## Supabase

The desired database schema is the source of truth in `supabase/schemas/`, split by domain. `supabase/migrations/` contains the append-only SQL history that gets applied to databases; don't edit a migration after it has been applied to a shared database.

1. Edit the appropriate SQL file under `supabase/schemas/`.
2. With Supabase CLI 2.115 or newer, generate a migration with `npm run db:sync -- -f describe_the_change --no-apply`.
3. Review the generated SQL in `supabase/migrations/`, test it locally, and commit both the schema edit and migration.
4. The Supabase GitHub integration applies committed, unapplied migration files after pushes or merges to its configured production branch. Set the repository working directory to `.` and enable **Deploy to production** in the integration settings.
5. To push manually instead, link a local checkout with `supabase link --project-ref <project-ref>` and run `supabase db push`.
6. Create the first Auth user, then add its UUID to `public.platform_admins`. That account can sign in at `/platform` to provision paathshalas and approve the first teacher. New teachers can then request access by tenant code.

The GitHub integration deploys migration files, not declarative schema files. A schema edit must be synced into a reviewed migration before it can be deployed.

Never expose a Supabase service-role key in browser code. Tenant data is isolated by row-level security.