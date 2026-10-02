# Supabase setup

The app works offline without Supabase. Add it to sync across your devices.

## 1. Create the project (free tier)
1. Go to https://supabase.com and sign in.
2. **New project** â†’ name it `timhirt`, pick a region near you, set a database password (save it in a password manager, not in this repo).
3. Wait for it to finish provisioning.

## 2. Apply the schema
In the dashboard open **SQL Editor**, paste the whole of `supabase/setup_all.sql` and run it
(choose **Run and enable RLS** if asked). That file is the two migrations combined with every
comment removed: the dashboard's RLS prompt rewrites the query and breaks a leading `--` comment.

Regenerate it after editing a migration by joining `migrations/*.sql` and stripping `--` comments.
The migrations themselves stay the source of truth (or use the Supabase CLI: `supabase link` then `supabase db push`).

## 3. Add the keys to the app
In **Project Settings â†’ API** copy the **Project URL** and the **anon public** key into a new
`.env` file (copy `.env.example`):

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Never put the **service_role** key anywhere in this project. `.env` is gitignored.

## 4. Turn on sign-in
**Authentication â†’ Providers**: Email (magic link) is on by default. For Google sign-in, add a
Google OAuth client and paste its ID/secret there. **Authentication â†’ URL Configuration**: add
your app URLs (e.g. `http://localhost:8081` for web development).

## Security model
- Every per-user table has row-level security: you can only read and write rows where `user_id` is you.
- No table has a DELETE policy: rows are soft-deleted (`deleted_at`) so deletions sync.
- Scripture and reading-plan tables are read-only for signed-in users and empty until loaded.
  The scripture text we have has unverified redistribution rights, so it is not readable by
  the anonymous key and should only be loaded into a project you own.

## Testing the rules
`npm run test:db` applies the migrations to an in-memory Postgres and checks, with two fake
users, that nobody can read or change anyone else's data. Run it after any schema change.
