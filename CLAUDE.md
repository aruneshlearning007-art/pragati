# Pragati

Personalized learning platform for Class 3-8 students in India. The founder
(user) is non-technical (`arunesh.consult@gmail.com`, communicates in
Hindi/English mix) and wants Claude to own all technical work — only ask
them for account creation, business decisions, and hands-on testing/feedback
in plain language, not jargon.

**Core differentiator**: teachers upload a chapter for *any* subject (not
just Science), and AI agents auto-generate the full material bundle (notes,
explanations in 4 modes, quiz) — subject-agnostic pipeline, not hardcoded to
one subject.

## Session bootstrap (do this before asking the user for anything)

This machine's OS user profile (C: drive — where `gh`/`vercel` CLI logins and
Windows Credential Manager entries live) resets between sessions, but this
project directory (D:\...\Pragati) persists. **Any credential found in the
ambient OS login state (`vercel whoami`, saved GitHub credential manager
entries, etc.) belongs to an unrelated account from machine provisioning —
never assume it's the user's own `pragati20`/`aruneshlearning007-art`
account without checking `.secrets/`.**

At the start of a session, check `.secrets/` (gitignored, see
`.secrets/README.md`) for `github_token.md` and `vercel_token.md` first. If
present, use them directly (repo-local git credential; `--token` flag on
every `vercel` call) — do not ask the user to regenerate tokens. Only ask if
the folder is empty or a token has stopped working (e.g. `vercel whoami
--token=...` fails). Also check `apps/web/.env.local` — if missing, `vercel
env pull --cwd apps/web` using the stored Vercel token to restore local
`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `GEMINI_API_KEY` before doing
local dev/testing.

**Status as of 2026-08-18 — fully wired, both confirmed full access:**
GitHub token has `admin: true` on the repo (not just push); Vercel token's
team role on `pragati20` is `OWNER`. Both can be used freely for anything
needed going forward (env var changes, deployment management, repo
settings) without re-asking the user for permission scope. `apps/web` is
`vercel link`-ed to `pragati20/pragati-web`, and `apps/web/.env.local` has
the pulled production env vars.

**Gotcha**: `git config --local credential.helper "store --file=..."` alone
is not enough — the global Windows credential manager (`credential.helper =
manager`, cached with an unrelated account) runs *before* it and wins,
causing `push` to 403 with the wrong username even though `fetch`/`ls-remote`
succeed. Fix: `git config --local --unset-all credential.helper && git
config --local credential.helper "" && git config --local --add
credential.helper "store --file=.secrets/git-credentials"` — the empty
entry resets the inherited chain so only the local file-based helper
applies in this repo.

## Product philosophy (must be baked into every agent prompt, not bolted on)

1. **Subject-agnostic pipeline** — Notes → Verifier → Pedagogy → Practice →
   Video Curator agents take subject/topic as parameters, never hardcode
   Science. Video Curator (built 2026-08-18) is deterministic — no LLM call,
   just a real YouTube Data API v3 search cached in the `Video` table — since
   there's no way to generate real video and a hallucinated link would be
   worse than none.
2. **Teach, don't rote** — every agent's system prompt must build genuine
   conceptual understanding (the *why*, multiple framings), never just facts
   to memorize. This is the investor-facing differentiator.
3. **Real diagnosis, not just scoring** — the Diagnostic Engine should
   eventually classify *why* a student got something wrong (misconception
   tagging), not just log right/wrong. (Full misconception layer is Phase 4,
   not yet built.)
4. **Cheap personalization** — core content stays generic/cached per scope;
   personalization is a thin nudge layer on top, not per-student regeneration.
5. **Child safety is structural** — every agent output must be age-appropriate
   (audience is 8-14 year olds); doubt-chat's moderation layer (built
   2026-08-18, see Phase 2 below) logs a `SafetyIncident` and auto-disables
   after repeated incidents. The teacher/parent in-app dashboard alert on
   those incidents is not built yet — that's Phase 3/5 territory, once those
   dashboards exist at all.
6. **India-specific curriculum scoping**: Class 3-5 content is
   **school-scoped** (no national-standard book — every school uses a
   different one); Class 6-12 content is **board-scoped**
   (NCERT-standard, shared across schools on that board). This single rule
   lives in `packages/shared/src/contentScope.ts` (`getContentScope()`) and
   must be used everywhere content is cached or queried — never let this
   logic drift to a second implementation.

## Architecture

- **Monorepo**, pnpm workspaces. No separate backend — Next.js API routes
  under `apps/web/app/api/**/route.ts` are the entire backend.
  - `apps/web` — Next.js 15 App Router + TypeScript + Tailwind. Deployed to
    Vercel (frontend AND backend).
  - `packages/db` — Prisma schema/client, Postgres on Supabase free tier.
  - `packages/shared` — LLM provider abstraction, content-scope helper, base
    agent prompt instructions, stub session/auth helpers.
  - `project/` — the original Claude Design prototype (.dc.html files) kept
    as visual/UX reference only, not part of the running app.
- **LLM provider**: Gemini (`gemini-3.6-flash`, free tier — cost-driven
  choice, user explicitly cannot pay). All calls go through the single
  `generate()` function in `packages/shared/src/llm.ts` so swapping to Claude
  later is a one-file change (prompts will need re-tuning at that point,
  expected not hidden).
- **Auth**: stubbed for the pilot — no OAuth/password. `packages/shared/src/session.ts`
  issues an HMAC-signed cookie token on onboarding. Explicitly flagged as a
  stand-in to replace before real launch.
- **Payments**: stubbed (`subscriptionStatus` field only), not built yet.

## Deployment

GitHub (`aruneshlearning007-art/pragati`) → Vercel (project `pragati-web`,
team `pragati20`) auto-deploys `apps/web` on every push to `main`. Postgres
is Supabase (project ref `omdrsjlfgipgylcqcooc`, region ap-south-1).

`apps/web/package.json` build script runs migrations before building:
`pnpm --filter @pragati/db generate && pnpm --filter @pragati/db migrate:deploy && next build`
— so every deploy applies any pending Prisma migration automatically. There
is no separate "run this manually" migration step.

**Required Vercel env vars** (names only, values are in Vercel's dashboard,
never commit them):
- `DATABASE_URL` — Supabase **transaction pooler**, port 6543 (runtime queries)
- `DIRECT_URL` — Supabase **session pooler**, port 5432 (migrations only —
  the transaction pooler doesn't support the session state `prisma migrate
  deploy` needs)
- `JWT_SECRET` — any long random string, signs the stub session cookie
- `GEMINI_API_KEY` — Gemini API key

## Known infra gotchas already hit once (don't re-debug from scratch)

- **Prisma query engine missing on Vercel** ("Query Engine for runtime
  rhel-openssl-3.0.x not found"): a custom Prisma `output` path breaks
  Next.js's file tracer in a pnpm monorepo — it silently drops the engine
  binary from the deployed function. Fixed by (a) using Prisma's **default**
  client location (no `output` override in the `generator client` block,
  just `@prisma/client`), (b) adding `binaryTargets = ["native",
  "rhel-openssl-3.0.x"]`, and (c) an explicit `outputFileTracingIncludes` in
  `apps/web/next.config.mjs` pointing at
  `../../node_modules/.pnpm/**/node_modules/.prisma/client/*.node` (glob
  survives pnpm's hashed store directory names). **To verify this kind of
  fix without waiting on a Vercel deploy**: run `next build` locally, then
  inspect `.next/server/app/**/route.js.nft.json` (or `page.js.nft.json`) —
  grep for `rhel-openssl` — this is the same file list Vercel's builder uses
  to decide what ships in the serverless function, so it's a fast, honest
  local proxy for whether the fix actually works.

## Sandbox network limitations that no longer apply once running locally

The cloud/web session this was originally built in has an egress allowlist:
Vercel's API (`api.vercel.com`) and raw Postgres ports (5432/6543) were
unreachable, and Supabase MCP OAuth couldn't complete (needs a real browser
popup). That's why migrations were hand-written as SQL files instead of run
live, and why Vercel CLI/MCP weren't used for deploys. **None of this
applies when running locally** — Vercel CLI, `prisma migrate dev` against
the live DB, and Supabase MCP OAuth should all just work from a real
machine. Feel free to use them normally instead of the workarounds above.

## Build sequence (phased, each phase ends with something live to click through)

- **Phase 0 — Foundation** ✅ done: monorepo, Prisma schema, GitHub→Vercel→Supabase wired.
- **Phase 1 — Student core loop** ✅ done (verified live 2026-08-18): the
  ErrorCard work from the previous session (`apps/web/components/ErrorCard.tsx`,
  wired into `apps/web/app/page.tsx`, `student/layout.tsx`, `student/page.tsx`,
  `student/topics/[topicId]/page.tsx`) surfaced the real production error on
  first live test — `prisma.user.findUnique()` failing with Postgres 42P05
  "prepared statement already exists". Root cause: `DATABASE_URL` targets
  Supabase's PgBouncer transaction pooler, which doesn't support prepared
  statements; concurrent serverless invocations collided. Fixed in
  `packages/db/src/index.ts` by appending `?pgbouncer=true` to the URL at
  runtime (see https://pris.ly/d/pgbouncer) rather than editing the secret
  value itself. Deployed and walked the full flow live on
  https://pragati-web-swart.vercel.app: onboarding → home → Notes → Explain
  (all 4 modes) → Practice quiz → submit → score (3/4) all worked with real
  Gemini-generated content, no errors.
  **Known gap (not a regression, never built)**: the "Progress" nav link
  points at `/student/progress`, which 404s — no `page.tsx` exists under
  `apps/web/app/student/progress/`. Low priority, separate from Phase 1's
  scope; build when the user wants a progress view.
- **Phase 2 — Doubt-chat + safety moderation** ✅ core loop done (verified
  live 2026-08-18): topic-scoped chat widget (`apps/web/components/DoubtChat.tsx`,
  floating button + panel matching the Claude Design prototype) backed by
  `apps/web/lib/agents/doubt.ts`. One Gemini call per turn both answers the
  question and classifies it (self-harm, abuse, bullying, sexual content,
  violence) via `SAFETY_MODERATION_INSTRUCTION` in
  `packages/shared/src/prompts.ts`. Tested live on production with a normal
  question (answered helpfully) and three different flagged scenarios
  (bullying, hopelessness, online grooming) — each got a caring redirect-to-
  a-trusted-adult reply instead of a normal answer, each logged a
  `SafetyIncident` row, and after the 3rd incident the chat auto-disabled
  (confirmed the input/button are actually `disabled` in the DOM, and the
  4th message returned instantly without an LLM call).
  **Known gap**: `SafetyIncident` rows are logged but nothing surfaces
  them yet — no teacher or parent UI exists at all in this app so far, so
  "alerts teacher+parent via in-app dashboard notification" from the product
  philosophy above is not implemented. That lands naturally once Phase 3
  (teacher panel) and Phase 5 (parent dashboard) exist; the data is already
  there for them to query.
- **Video Curator + Explain picture-mode caption fix** ✅ done (verified live
  2026-08-18), added mid-Phase-2 after the user noticed Explain's "Picture"
  mode was a placeholder-only box with no real image/video anywhere. Decided
  (with user): no paid image-gen API (breaks the no-paid-API cost
  constraint) and no per-topic custom diagrams (breaks subject-agnosticism)
  — Picture mode keeps its text-placeholder box, but the caption is now
  topic-specific (was hardcoded to the same generic string for every topic).
  New: `apps/web/lib/agents/video.ts` searches YouTube Data API v3
  (`YOUTUBE_API_KEY` in Vercel + `.secrets/youtube_api_key.md`) for up to 3
  real videos per topic, caches them in the existing `Video` table, and a
  new Videos tab (`apps/web/components/VideosTab.tsx`) embeds them.
  Confirmed live: 3 real, relevant videos with correct durations for the
  seed Light topic, playable embeds, and HTML-entity-decoded titles (fixed
  a "BYJU&#39;S" → "BYJU'S" display bug, self-healing for already-cached
  rows too, no migration needed).
- **Phase 3 — Teacher Content Panel** — not started. Also needs to resolve a
  known schema gap: `Chapter` currently has no `schoolId`, needed for the
  class 3-5 school-scoped upload path.
- **Phase 4 — Personalization/misconception layer** — not started.
- **Phase 5 — Parent dashboard** — not started.
- **Phase 6 — Landing page + paywall stub** — not started.
- **Phase 7 — Responsive polish + full manual QA** — not started.

## Data model

Full schema in `packages/db/prisma/schema.prisma`. Key models: `School`,
`User` (role: student/parent/teacher), `Subject`/`Chapter`/`Topic`/`SubConcept`
(generic across subjects), `UploadedSource`, `Notes`/`Explanation`/`QuizQuestion`
(all scoped via `getContentScope()`), `QuizAttempt`, `MasteryScore` (source of
truth for mastered/revision/not-started status, thresholds: ≥80%→100,
≥40%→60, else→30), `MisconceptionTag` (Phase 4), `DoubtMessage`/`SafetyIncident`
(Phase 2).

## Verification expectations

- Typecheck (`pnpm --filter <pkg> typecheck`) and a full `next build` before
  considering any change done — both are fast and catch most issues without
  needing a live deploy.
- For anything Prisma/Vercel-bundling related, use the local `.nft.json`
  trace-file check described above before pushing.
- End of each phase: walk the actual feature in a browser (or ask the user
  to, since they're non-technical and want to see things work) before
  starting the next phase.
