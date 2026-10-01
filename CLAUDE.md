# Timhirt (á‰µáˆáˆ…áˆ­á‰µ, "teaching")

Ethiopian Orthodox Tewahedo Bible study app. Three modes: **Study**, **Devotion**, **Open**. Offline-first, Amharic + English, synced across devices.

## Stack
- Expo (React Native + web), TypeScript, Expo Router
- Supabase: auth, Postgres, row-level security, Edge Functions
- Local SQLite (IndexedDB on web) as the source of truth on-device; an outbox queue syncs to Supabase when online
- AI calls go through a Supabase Edge Function only. The Anthropic key never ships in client code.

## Canon rule (non-negotiable)
Use the full **81-book Ethiopian Orthodox Tewahedo canon**. Never trim to the 66-book Protestant canon, and never drop Enoch, Jubilees, Meqabyan, etc. Store `canon_order` and a `numbering_system` field on books/chapters because Ethiopian numbering can differ. Scripture quotes shown to the user must come from the verses table, not model memory.

## Design rules
- Palette: deep red `#7B1F1F`, gold `#C9A84C`, parchment `#F5EDD8`, ink `#1A1108`, ash `#3D2B1F`, mist `#EDE4CC`, accent `#8B3A3A`
- Serif display (Cormorant Garamond) for scripture; Inter for UI; Noto Serif Ethiopic for Ge'ez/Amharic
- Cross motifs (Ethiopian cross), parchment surfaces, gold hairline borders. Keep this identity.
- Dark ink background by default

## Rules of work
- Small phases, one commit each, clear messages
- Ask before adding paid services or deleting anything
- Secrets live in `.env` (gitignored); keep `.env.example` current
- Offline first: every feature must work with no signal, then sync
- Amharic and English from day one: no hard-coded UI strings, use i18n
- Per-user data is protected by RLS; scripture tables are read-only to all

## Folder structure (target)
```
legacy/        original single-file HTML app (reference only, do not delete)
src/
  app/         Expo Router screens (study, devotion, open)
  components/  UI components
  db/          local SQLite + sync outbox
  i18n/        en / am strings
  lib/         supabase client, helpers
  theme/       colors, fonts
supabase/
  migrations/  SQL schema + RLS policies
  functions/   Edge Functions (AI proxy)
assets/        fonts, icons
```

## Status
Phase 0 (foundation) and Phase 1 (Expo scaffold) done. See the migration plan: Expo scaffold, local data layer, scripture import, Supabase schema + RLS, sync, AI edge function, features, polish.
