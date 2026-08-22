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
6. **India-specific curriculum scoping**: every class (3-8) is
   **school-scoped** — a student only ever sees subjects/chapters uploaded
   by a teacher at their *own* school, regardless of class or board
   standardization. (Changed 2026-08-21, founder-requested: originally
   Class 6-12 was board-scoped/shared board-wide on the reasoning that
   NCERT is standardized past Class 5, but the founder wants each school to
   own and curate its own content, full stop — see the landing page/auth
   entry in Build sequence below.) This single rule lives in
   `packages/shared/src/contentScope.ts` (`getContentScope()`) and must be
   used everywhere content is cached or queried — never let this logic
   drift to a second implementation.

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
- **LLM provider**: Gemini (`gemini-3.5-flash-lite`, free tier — cost-driven
  choice, user explicitly cannot pay). All calls go through the single
  `generate()` function in `packages/shared/src/llm.ts` so swapping to Claude
  later is a one-file change (prompts will need re-tuning at that point,
  expected not hidden).
  **Model choice matters a lot here — don't casually bump to the newest
  model.** Originally used `gemini-3.6-flash` (the newest at the time); its
  free tier turned out to be a hard **20 requests/DAY** ceiling (confirmed
  from the literal 429 error body — `generate_content_free_tier_requests`,
  `limit: 20`) that doesn't reset until the next day and is trivially
  exhausted by normal use across Notes/Explain/Practice/Doubt-chat, let
  alone real students. Switched to `gemini-3.5-flash-lite` (2026-08-19,
  live-verified): its free tier is **15 requests/MINUTE** instead — recovers
  continuously rather than resetting once a day, confirmed by hammering it
  with 25 rapid calls (15 succeeded, then 429s citing the per-minute quota)
  — and reply quality held up on real doubt-chat questions. **The general
  pattern, worth rechecking if quota errors show up again**: a provider's
  newest/flagship model tends to get a much stingier free-tier quota than
  its own "-lite" or older sibling models — check the actual 429 error
  body's quota metric/limit before assuming a model swap fixed anything,
  since some limits are per-day (hard wall) and others are per-minute
  (self-recovering, much more usable even at a lower number).
- **Auth**: stubbed for the pilot — no OAuth/password, just email lookup
  (see the landing page/auth entry in Build sequence below).
  `packages/shared/src/session.ts` issues an HMAC-signed cookie token on
  signup or login. Explicitly flagged as a stand-in to replace before real
  launch — anyone who knows a registered email can log in as that person.
- **Payments**: stubbed (`subscriptionStatus` field only), not built yet.

## Deployment

GitHub (`aruneshlearning007-art/pragati`) → Vercel (project `pragati-web`,
team `pragati20`) auto-deploys `apps/web` on every push to `main`. Postgres
is Supabase (project ref `omdrsjlfgipgylcqcooc`, region ap-south-1).
**Vercel serverless function region is pinned to `bom1` (Mumbai)** — see
gotcha below, this must stay matched to Supabase's region or every DB-
touching request pays a cross-continent round trip.

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

- **Every DB-touching page took 4.5-8 seconds, even simple cached reads**
  (reported by user 2026-08-20, "kisi bhi tab ko click karne pe time le
  raha hai"): live-tested by timing `fetch()` calls from the browser —
  `/api/health` (no DB) was ~250-370ms, but any page touching Prisma was
  consistently 4.5-8s **even on repeat requests to the same cached data**,
  which ruled out cold-start as the sole explanation. Root cause found via
  `curl https://api.vercel.com/v9/projects/pragati-web`: **Vercel's
  serverless functions were running in `iad1` (US East) while Supabase is
  in `ap-south-1` (Mumbai)** — a cross-continent round trip (TCP+TLS+
  Postgres-auth handshake through PgBouncer, several round trips) on every
  single query. Fixed by `PATCH`-ing the project's `serverlessFunctionRegion`
  to `bom1` (Mumbai) via the Vercel API (matches `defaultResourceConfig.
  functionDefaultRegions` on the project, which was already `["bom1"]` —
  only `serverlessFunctionRegion` itself was still on the old default).
  Confirmed live after redeploy: the same pages dropped to 130-400ms.
  **If page loads ever feel slow again, check this first** — a Vercel
  project/team change or a fresh project recreation could silently reset
  it back to a default region again.
  **A real, smaller bug found and fixed alongside this**: `getChapterStatus`/
  `getTopicStatus` (`diagnostic.ts`) did 2 sequential DB queries **per
  topic**, called in a `Promise.all` loop per chapter/topic — an N+1
  pattern that was mostly harmless when every chapter had exactly one
  topic, but got meaningfully worse once concept segmentation made 5-6
  topics per chapter normal. Replaced with `getChapterStatusesByIds`/
  `getTopicStatusesByChapter`, which batch-fetch topics + sub-concepts +
  mastery scores for an entire chapter or chapter list in a fixed 3
  queries total. Kept for correctness even though the region fix alone
  accounted for most of the actual slowdown.
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
- **`DATABASE_URL`/`DIRECT_URL`/etc. show as `[SENSITIVE]` (or similarly
  blank/placeholder) no matter how you read them locally — this is not
  corruption.** Discovered 2026-08-21 while debugging a local `next build`
  failure (`P1013: scheme not recognized`): every local method of reading
  `apps/web/.env.local` — raw byte dump, a fresh Node process, `dotenv-cli`,
  even with the sandbox explicitly disabled — showed the same 11-character
  placeholder for these vars, which looked exactly like the values had been
  overwritten with garbage. They hadn't. Checking the Vercel dashboard
  (Settings → Environment Variables) showed these vars are marked
  **"Sensitive"** — a real Vercel feature that makes a variable *write-only
  forever*: once saved, nobody (not the dashboard, not `vercel env pull`,
  not the API) can ever read the real value back out again, by design.
  Confirmed production itself is completely unaffected — Vercel still
  injects the real value at build/runtime regardless of the Sensitive flag
  (proven by watching a real deploy's build log actually connect to and
  migrate the live Supabase DB). **If you need the real value locally
  again** (e.g. to run `prisma migrate deploy` from this machine), the only
  ways are: ask the founder for the real Supabase connection string
  directly, or have them un-check "Sensitive" on that variable in the
  Vercel dashboard (Environment Variables → the var's `...` menu → Edit)
  so `vercel env pull` can fetch it normally again. Don't waste time
  re-debugging this as file corruption — check the dashboard's Sensitive
  flag first. For a local `next build` that doesn't need a real DB
  connection (nothing in this app queries the DB at build time — every
  route is dynamic), a harmless placeholder URL like
  `postgresql://placeholder:placeholder@localhost:5432/placeholder` is
  enough to satisfy Prisma's schema validation.

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
- **Video Curator + Explain picture-mode visuals** ✅ done (verified live
  2026-08-19), added mid-Phase-2 after the user noticed Explain's "Picture"
  mode was a placeholder-only box with no real image/video anywhere.
  **Video**: `apps/web/lib/agents/video.ts` searches YouTube Data API v3
  (`YOUTUBE_API_KEY` in Vercel + `.secrets/youtube_api_key.md`) for up to 3
  real videos per topic, caches them in the `Video` table, and a Videos tab
  (`apps/web/components/VideosTab.tsx`) embeds them. Confirmed live: 3 real,
  relevant videos with correct durations for the seed Light topic, playable
  embeds, HTML-entity-decoded titles.
  **Picture mode**: two failed attempts before landing on the real fix.
  (1) A generic hardcoded caption for every topic — made it topic-specific
  instead. (2) Sourcing a real image from Wikimedia Commons
  (`TopicImage` table + `image.ts` agent) — abandoned after live testing
  showed Commons' full-text search matches keywords anywhere in a file's
  prose description, not just its title: a query for "Shadows and
  Reflections Science" returned an Apollo moon-landing photo (caption
  mentioned "reflection" and "shadow" in passing); tightening to a
  title-only match still surfaced a landscape photo an artist happened to
  title "Shadows and Reflections" — real and on-theme, but not an actual
  teaching diagram. (3) A grid of cards (icon+title+description) — accurate
  but had no spatial/relational meaning between cards, so it didn't actually
  read as a "picture." **Landed on**: the Pedagogy agent (`pedagogy.ts`) now
  writes an ordered sequence of 2-5 steps (icon + label + one-sentence
  description) with a short label on each arrow between them, rendered by
  `ExplainTab.tsx`'s `DiagramView` as real boxes connected by labeled
  arrows — an actual flow diagram. Always accurate since it's exactly what
  the model intends to teach, not a search result gambled on keyword
  overlap — and stays free and subject-agnostic (the same
  step-sequence-with-arrows shape covers comparisons, cause/effect, and
  process flows across any subject). The `TopicImage` table and `image.ts`
  were dropped; `Explanation.panels` was renamed to `.diagram` (JSONB).
  Confirmed live at both narrow and desktop widths: a correct 5-step
  diagram (🔦 Light Source → 🧍 Opaque Object → 👥 Dark Shadow → 🪞 Shiny
  Mirror → 🖼️ Clear Reflection, each arrow labeled) for the seed topic,
  wrapping cleanly to multiple rows on narrow viewports.
  **Still open**: once Phase 3 extracts images from teacher uploads, show
  those alongside this generated diagram, not as a replacement (see Phase 3
  note below) — not yet implemented, Phase 3 hasn't started.
- **Phase 3 — Teacher Content Panel** ✅ core loop done (verified live
  2026-08-19): teacher signup (`/teacher-onboarding`, role=teacher, own
  `School` like a student), a content panel (`/teacher`) listing uploaded
  chapters with review status, an upload flow (`/teacher/upload` — pick or
  name a `Subject`, class, board, chapter title, paste source text) that
  runs Notes/Pedagogy/Practice generation concurrently grounded in that
  text, and a review page (`/teacher/chapters/[id]`) where the teacher reads
  the draft before publishing.
  Tested live end-to-end with a **brand-new subject** ("Social Studies",
  never used before — Science was the only subject that existed) and a
  chapter on the Indian freedom struggle, deliberately picked to prove the
  pipeline is genuinely subject-agnostic, not just tuned for Science: every
  fact in the generated Notes/Explain/Practice/Picture-diagram output
  traced back to the pasted source (Congress 1885, Satyagraha 1915, Salt
  March 1930, Quit India 1942, independence 1947) with nothing invented,
  and the Picture-mode diagram
  (🏛️ Congress → 🌿 Satyagraha → 🧂 Salt March → ✊ Quit India → 🇮🇳
  Independence) worked as well for a history timeline as it did for the
  Light/physics topic. After publish, confirmed the new subject and
  chapter appeared correctly in a student's sidebar and all four tabs.
  **Two real bugs found and fixed while wiring this up**: (1) the
  Explain/Practice agents' "does this already exist" cache lookups had no
  `status` filter at all —
  an `awaiting_review` teacher draft could have been served to any student
  browsing the same topic/scope before approval. Notes already filtered
  correctly; Explanation and QuizQuestion didn't even have a `status`
  column until this phase added one. (2) the student subject page's
  chapter listing had no `status` filter and no school-scoping either —
  same leak, plus a class 3-5 chapter from one school could have shown up
  to students at a different school. Schema: `Chapter` gained `schoolId`
  (sourced from the uploading teacher's own school via `getContentScope`)
  + `teacherId` + `status`.
  **PDF/photo upload** ✅ added 2026-08-19, verified live with a real
  file: the teacher upload form (`UploadChapterForm.tsx`) initially only
  took pasted text; the user pointed out real teachers will upload a PDF or
  photo of the chapter, not retype it. First implementation (multipart
  upload straight through a Next.js route, 4MB cap in app code) was wrong —
  live-tested with a real 8.9MB/91-page Class 5 Science chapter PDF and hit
  Vercel's **hard 4.5MB serverless request-body ceiling**, which isn't
  configurable and isn't the same thing as any size check in our own code.
  Fixed by moving to **client-side direct upload to Vercel Blob**
  (`@vercel/blob`): the browser uploads straight to Blob storage via a
  short-lived token (`/api/teacher/upload-token`, `onBeforeGenerateToken`
  gated on `getCurrentTeacher()`), the file never passes through a route
  handler body at all, then `/api/teacher/extract-source` fetches the blob
  server-side and hands it to Gemini's native multimodal input (inline
  base64, no separate OCR library) via `extractSourceText()` in
  `lib/agents/extractor.ts` — a transcribe-only prompt that returns the
  literal string `"EXTRACTION_FAILED"` rather than inventing text if a file
  is unreadable. Confirmed live end-to-end with that real 91-page PDF:
  extraction produced ~19,000 characters of clean, accurate, structured
  text (matched the real chapter content — aquatic plants, vegetative
  propagation, seed germination, seed dispersal, crops), which then fed the
  normal Notes/Explain/Practice generation and Verifier pass — the Verifier
  caught and fixed two real issues grounded in that source text (an
  overcomplicated story analogy, a Practice question tightened to the
  source's own crop/agriculture vocabulary). Image extraction *alongside*
  the generated Picture-mode diagram (rather than as its replacement) is
  still not built — `UploadedSource` only stores the extracted `sourceText`
  string, no image itself.
  **Verifier Agent** ✅ added same day, user-requested: checks Notes/Explain/
  Practice against the source text (hallucination) and the target class
  level (age-appropriateness) after generation, *auto-corrects* anything
  wrong, and logs each fix as a `VerifierFlag` (redesigned chapter-scoped
  with a `section` field — it was schema-only before, notesId-linked, never
  written to by any code) so the review page shows the teacher exactly what
  the AI caught and changed. Tested live with a deliberately mismatched
  case: a Class 3 chapter ("How Plants Make Food") sourced from
  college-level biochemistry text (chlorophyll, thylakoid membranes,
  stoichiometric equations, trophic structure). The first-pass Notes
  generation already simplified well on its own (the base child-audience
  instruction earns its keep) — the Verifier still found and fixed one real
  issue in a Practice question (reworded to match the source's own
  "by-product" phrasing) rather than inventing flags to have something to
  show, matching the instruction to report nothing when nothing's wrong.
  Only ever runs for the teacher-upload path — system auto-generated
  content is never verified (no source text to check against).
  **Concept segmentation + Key Terms glossary** ✅ added 2026-08-20,
  user-requested: a chapter always became exactly one `Topic` with
  Notes/Explain/Practice generated as one undifferentiated blob, even
  though a real chapter (e.g. the "Growing Plants" test PDF) clearly covers
  several distinct concepts (aquatic plants, vegetative propagation, seed
  germination, seed dispersal, crops). The schema already supported many
  `Topic` rows per `Chapter` — `getChapterStatus`/`getTopicStatus`
  (`diagnostic.ts`) and the publish route already looped over
  `chapter.topics` generically — it had just never been exercised as more
  than one. New `lib/agents/segmentation.ts` (`segmentIntoConcepts`) makes
  one Gemini call over the full source text and returns 2-6 concept titles
  + 2-4 sub-concept names each (names only, never reproduced excerpts —
  cheap and reliable vs. expensive/error-prone verbatim quoting); each
  per-concept Notes/Explain/Practice call gets the *full* source text again
  plus a "focus on this concept" instruction rather than a hand-built
  excerpt. Also fixed a real adjacent bug this surfaced: the teacher-upload
  path never created `SubConcept` rows, so `practice.ts`'s existing
  name-based subConcept-linking silently always produced
  `subConceptId: null` and `getTopicStatus`'s mastery calc (keyed on
  `SubConcept`) could never score teacher-uploaded content — segmentation
  now populates real `SubConcept` rows per concept, closing that gap.
  Every `Notes` row also gets a `keyTerms Json?` glossary (3-6
  `{term, meaning}` pairs, generated in the same Gemini call as the notes
  sections, not source-grounding-gated — useful for any topic) rendered as
  a "Key Terms" card on the Notes tab; `ExplainTab.tsx` tooltips matching
  terms inline in Explain body text via a client-side, case-insensitive,
  whole-word regex match (native `title` attribute, dotted-underline span
  — no new markup format for the model to get wrong). New student
  `/student/chapters/[chapterId]` overview page lists a multi-concept
  chapter's concepts with per-concept mastery status (single-topic chapters
  redirect straight through, unchanged); the topic page gained a
  concept-switcher pill row; the teacher review page groups Notes/Explain/
  Practice/Verifier flags per concept (`VerifierFlag` gained a `topicId`
  column, backfilled via migration, so flags are attributable to their
  concept instead of dumped in one flat chapter-wide list).
  **Two real bugs found via live testing with the actual 91-page PDF, both
  fixed same day:**
  (1) **Architecture bug — whole chapter in one request doesn't survive
  contact with reality.** First implementation ran segmentation + every
  concept's generation sequentially inside one POST request
  (`maxDuration = 300`). Live-tested with the real 5-concept chapter: each
  concept's Notes+Explain+Practice+Verifier sequence took ~2.5+ minutes
  (not the ~30-45s assumed), so the whole request silently stalled past any
  reasonable serverless timeout — confirmed via `vercel logs` and repeated
  no-progress checks against the review page, with the client `fetch`
  simply hanging with no error. Fixed by splitting into two endpoints:
  `POST /api/teacher/chapters` now only creates the Chapter/UploadedSource
  and runs segmentation (one fast call), returning the concept list; a new
  `POST /api/teacher/chapters/[chapterId]/concepts` generates+verifies
  exactly one concept per call. `UploadChapterForm.tsx` calls the second
  endpoint once per concept in a loop, showing real "Generating concept 2
  of 5" progress. Re-tested: each concept call now takes ~20s, whole
  5-concept chapter finishes in under 2 minutes.
  (2) **Verifier crash on malformed model output, discarding good content.**
  `verifyAndCorrectChapter` had no error handling around any of its three
  verify calls — live testing hit a real Gemini JSON-formatting slip (an
  over-escaped response that failed `JSON.parse`) on the Explain
  verification step, which crashed the *entire* concept-generation request,
  discarding that concept's already-successfully-generated Notes/Explain/
  Practice along with it, even though only the optional verification step
  failed. Also hit a related null-body crash: the model occasionally omits
  `body` for the picture-mode variant when it only had a diagram fix to
  make, which Prisma rejected outright. Fixed by wrapping each of the three
  verify calls (notes/explain/practice) independently in try/catch —
  logged, not thrown — and falling back to the original body instead of
  writing null. Verification is now genuinely best-effort per section:
  base content generated before the Verifier ever runs is never lost to an
  optional QA step's failure.
  Confirmed live end-to-end with the real 91-page PDF: 5 accurate concepts
  (Aquatic Plants, Vegetative Propagation, Seeds & Germination, Seed
  Dispersal, Crops & Agriculture), each with its own correct Notes + Key
  Terms glossary + Explain (4 modes) + Practice, Verifier catching and
  fixing real issues in some concepts (e.g. a hallucinated carrot detail
  not in the source, imprecise vocabulary) and correctly reporting "no
  issues" in others; published, then confirmed as a student: the concept
  overview page, concept-switcher navigation, and Explain-tab tooltips
  (including matching the plural "cotyledons" against the singular
  glossary entry "Cotyledon" — required a follow-up regex fix to allow a
  trailing "s", since Explain text almost never reuses a term's *exact*
  singular form) all worked correctly.
- **Phase 4 — Personalization/misconception layer** — first slice ✅ done
  (verified live 2026-08-20). Until now the Diagnostic Engine was pure
  right/wrong scoring — `MisconceptionTag`/`PedagogyPreference` existed in
  the schema (Phase 0) but zero code touched either. Researched question-
  design best practice first (two-tier/multi-tier diagnostic questions are
  the standard way to tell a real misconception from a guess — Pragati's
  existing `assertion_reason` question kind is structurally exactly that,
  just never used diagnostically) before building anything.
  Practice Agent (`practice.ts`) now generates 6-8 questions per concept
  (was 4-5) with explicit type/difficulty mix (~50% `mcq`, ~25-30%
  `assertion_reason`, at least one pure-recall and one application-level
  question), and labels every wrong option at generation time with the
  specific misunderstanding a student holds if they pick it
  (`QuizQuestion.optionMisconceptions`, parallel array to `options`) — free
  at grading time, no second LLM call. `submitQuizAnswers`
  (`diagnostic.ts`) upserts a `MisconceptionTag` when a labeled wrong
  option is picked (`count` + unique constraint, so repeats bump a counter
  instead of growing rows — "recurring" is just `count >= 2`) and returns
  per-question feedback (correct answer + misconception) to the client.
  `PracticeTab.tsx` shows a "What you got wrong" review after submitting.
  **Personalization deliberately does NOT touch Notes/Explain content**:
  those are cached per scope (`topicId+board+class+schoolId+language`) and
  shared across every student in that cohort ("Never per student" per the
  schema comment) — splicing a per-student hint into that generation
  prompt would leak one student's hint into every other student's cached
  copy. The two genuinely per-student surfaces are the Practice review
  screen (above) and Doubt-chat: `answerDoubt` (`doubt.ts`) now pulls
  recurring (`count >= 2`) misconceptions for the topic via new
  `getActiveMisconceptions()` and splices a one-line nudge into its system
  prompt. `PedagogyPreference` (personalizing which Explain mode shows by
  default) stays unused — no clean signal exists yet for which mode a
  student actually read before a quiz attempt; revisit once that signal
  exists rather than building on a guess.
  Verified live end-to-end with a real "Water Cycle" test chapter: Practice
  generated 6 questions (3 `mcq` + 2 `assertion_reason` + 1 application-
  style) with genuinely specific per-option misconception labels (e.g.
  "Thinks wind causes water to heat up and turn into vapor", "Confuses
  evaporation with condensation"); submitting the same wrong answers twice
  correctly triggered the `count >= 2` threshold; the Practice review
  screen showed the right/wrong breakdown with mix-up labels; and asking
  Doubt-chat an unrelated "explain evaporation simply" question produced a
  reply that organically corrected the tagged wind-vs-sun misconception
  ("Even though wind helps move the air around, it's really the sun's
  cozy heat doing the main job...") — confirming the nudge actually
  changes the model's behavior, not just that the code path executes.
- **Math-specific learning features** ✅ done (verified live 2026-08-20),
  requested after a live test with a real NCERT Class 5 Math PDF exposed
  gaps Science/Social Studies never hit: math is procedural not just
  conceptual, plain text can't show equations, MCQ under-tests real
  calculation ability, and LLMs make real arithmetic mistakes. Researched
  math pedagogy first (Concrete-Pictorial-Abstract/Singapore Math, the
  worked-example effect, retrieval practice for fact fluency) before
  building. Five pieces, kept subject-agnostic wherever possible:
  1. **Math notation (KaTeX)** — `apps/web/components/RichText.tsx`
     consolidated 5 duplicate `whitespace-pre-wrap` render sites into one
     component that renders `$...$`/`$$...$$` LaTeX via `katex.renderToString`
     (`trust:false`, safe even though the TeX is LLM-authored) composed with
     the existing key-term tooltip logic (moved to `lib/richtext.tsx`).
  2. **Worked examples** — a 5th `ExplainMode` (`worked`), generated
     unconditionally every call like `Notes.keyTerms` — a fully solved,
     step-by-step example with a "Show next step" reveal toggle (the
     faded-worked-example effect) in `WorkedExampleView.tsx`.
  3. **Numeric-answer questions** — a 4th `QuestionKind` (`numeric`);
     `QuizQuestion` gained `correctValue`/`tolerance`, `QuizAttempt` gained
     `numericResponse`; grading in `diagnostic.ts` branches on kind.
  4. **Deterministic arithmetic checker** — `arithmetic-checker.ts`, a
     narrow regex `A op B = C` detector (no LLM cost) wired into the
     Verifier as an extra pass after the LLM check — a real safety net,
     not just theoretical: the Verifier had already live-caught one Gemini
     arithmetic mistake earlier the same day.
  5. **Fact-fluency drill** — a stateless v1 (`lib/drill.ts` +
     `DrillFlashcard.tsx`, no persistence, no spaced-repetition scheduling
     — that's an explicit v2) nested as a "Quick Drill" toggle inside
     `PracticeTab.tsx`, shown only when the topic's subject is Math.
  **Three real bugs found and fixed via live testing, in order**: (a) the
  Verifier's final `VerifierFlag.createMany` bulk insert crashed on a
  flag entry missing `quote`/`reason` — now filtered out before the write,
  wrapped in try/catch as a last-resort safety net. (b) The big one:
  `$\frac{1}{2}$` rendered as literal "rac{1}{2}" — `\f` (and `\b`, `\t`)
  are valid single-character JSON escapes (form-feed, backspace, tab), so
  when the model wrote an under-escaped single backslash instead of `\\`,
  `JSON.parse` silently "succeeded" while eating the backslash and the
  letter that made it a valid escape (`\times` → tab + "imes"). Fixed at
  the shared `extractJson` layer (`packages/shared/src/llm.ts`) — repairs
  `\f`/`\b`/`\t` into `\\f`/`\\b`/`\\t` before parsing, since none of those
  three control characters is ever intentionally produced by any agent in
  this app. (c) A narrower residual case: the model reliably wraps math in
  `$...$` inside prose, but was inconsistent when an entire short string
  (like a quiz option) IS the math, sometimes omitting the dollar signs
  entirely — `RichText` now also treats a whole trimmed string as math if
  it looks like nothing but a bare LaTeX command, rather than depending
  solely on prompt compliance. **Known remaining gap**: bare LaTeX
  *embedded mid-sentence* (not the whole string) in old cached content
  generated before this fix still renders as raw text — narrower and more
  inconsistent than the other two, not yet worth the false-positive risk
  of a more aggressive mid-string regex.
  Verified live end-to-end on a real "Simple Fractions" Class 5 chapter:
  correct stacked-fraction rendering (confirmed via actual KaTeX-generated
  `<mfrac>` markup, not just visual inspection) in Notes/Explain/Practice;
  a Worked Example with working step-reveal; numeric questions graded
  correctly with tolerance and shown without leaking `correctValue` to the
  client pre-submission; the Quick Drill toggle appearing only for Math
  topics and a live multiplication problem graded correctly with a
  streak counter.
- **Landing page + student/teacher signup and login** ✅ done (verified
  live 2026-08-21), user-requested: previously `/` was purely a
  session-redirect router that sent anyone without a session straight into
  `/onboarding`, which always created a **brand-new** User with a fake
  generated email — there was no way for a returning student/teacher to get
  back into their existing account after clearing cookies. Now `/`
  (`apps/web/app/page.tsx`) renders a real `LandingPage.tsx` (hero + two
  role cards) when there's no session; `/onboarding` and
  `/teacher-onboarding` gained a `AuthModeToggle.tsx` signup/login tab
  switcher. **Auth approach — explicitly chosen by the founder after being
  told the tradeoff**: simple email lookup, no password (`User.email` was
  already `@unique`) — sign-up now collects a real email, log-in is "enter
  your email, we find your account, you're in." New
  `/api/login`/`/api/logout` routes; a `LogoutButton.tsx` sits next to the
  language toggle in both student/teacher layout headers.
  **Alongside this, changed the content-scoping rule** (see product
  philosophy #6 above): every class (3-8) is now school-scoped, not just
  Class 3-5 — the founder wants each school to own and curate its own
  content even where the curriculum (NCERT) happens to be standardized.
  `packages/shared/src/contentScope.ts` simplified to an unconditional
  passthrough; a backfill migration
  (`20260820030000_school_scope_all_classes`) set `schoolId` on existing
  Class 6-8 teacher-uploaded chapters that had it `null` under the old
  rule. **Known, accepted side effect**: the system-seeded "Light" demo
  chapter (no `teacherId`, so nothing to backfill `schoolId` from) stopped
  appearing to real students, since content with no owning school can't
  match any student's school anymore — consistent with the new rule, not a
  bug.
  Verified live end-to-end on production: landing page renders for a
  no-session visitor with both entry cards working; signed up a fresh
  Class 6 test student at a new school ("Auth Test School A") and confirmed
  zero chapters visible (correct — brand-new school, nothing uploaded);
  logged out via the new button, then logged back in with the same email
  and landed on the *same* account (not a fresh one); tried signing up
  again with that email — got the friendly "already registered, please log
  in" message, not a raw DB error; tried logging in on the teacher page
  with that student's email — got the friendly role-mismatch message;
  tried logging in with a never-registered email — got the friendly
  "no account found" message; signed up a second teacher at a *different*
  new school ("Auth Test School B") and confirmed their content panel is
  also empty and independent; signed up a fresh Class 5 student at the
  *same* "Auth Test School A" and confirmed Class 5's pre-existing
  school-scoping still behaves identically (no regression from the rule
  change). The backfill migration itself was confirmed applied cleanly
  against the live Supabase DB via the deploy's build log ("All migrations
  have been successfully applied") — the pre-existing "Growing Plants"/
  "Simple Fractions" Class 6 test chapters from earlier sessions weren't
  re-checked live in-browser (their teacher accounts used the old
  auto-generated pending email format, now unknown/unrecoverable for
  login), but the backfill SQL is a simple, deterministic, unconditional
  `UPDATE ... WHERE schoolId IS NULL` reviewed as safe.
- **Chapter generation reliability hardening + teacher delete-chapter**
  ✅ done (verified live 2026-08-22), triggered by the founder reporting
  "Gemini API is failing to generate content when teacher upload chapter."
  Investigation turned into four distinct, real bugs found one after
  another via repeated live re-testing on production — each fix uncovered
  the next failure, all from the same root cause family: `generate()`/
  `extractJson()` in `packages/shared/src/llm.ts` trusting the model's raw
  response far more than an LLM's output actually deserves.
  1. **No retry on Gemini's 429 rate limit** — a single concept's
     generation already fires 3-6 calls back to back (Notes+Explain+
     Practice concurrently, then the Verifier's follow-up calls), enough on
     its own to trip the free tier's 15-requests/minute cap; any 429 just
     crashed the whole concept. `generate()` now retries up to 3 times on
     a 429, waiting the API's own suggested `retryDelay`.
  2. **`extractJson` took the LAST "}" in the whole raw string, not the one
     that actually closes the JSON object** — the moment the model added
     anything after the JSON (a stray note, a code-fence artifact) that
     itself contained a "}", the slice pulled in that trailing text too and
     `JSON.parse` choked ("Unexpected non-whitespace character after
     JSON"). Replaced with a proper string-aware brace-balance scan that
     tracks quote state so it stops at the real end of the object
     regardless of what the model appends afterward, tested against 6
     synthetic edge cases (trailing prose with a brace, LaTeX braces inside
     string values, markdown-fenced JSON, nested objects) before deploying.
  3. **No `maxOutputTokens` set at all** — re-testing immediately surfaced
     a different error from the same family ("Expected ',' or ']' after
     array element"), a genuinely truncated response cut off mid-array by
     Gemini's undocumented default output budget. Set `maxOutputTokens:
     8192` (generous headroom for anything this app generates) and check
     `candidate.finishReason === "MAX_TOKENS"`, throwing a clear
     "response was truncated" error instead of a cryptic parse failure.
  4. **Several `extractJson<T>()` call sites assumed the model's JSON
     always included every expected top-level key** — re-testing again
     surfaced a fourth, different crash ("Cannot read properties of
     undefined (reading 'map')") on `practice.ts`'s `parsed.questions.map()`
     when the model's JSON, while syntactically valid, omitted the
     `questions` key. The same unguarded pattern existed in
     `segmentation.ts` (`parsed.concepts`), `notes.ts` (`parsed.sections`),
     and `pedagogy.ts` (several body/diagram/worked-example fields) — all
     four now fall back to an empty array/string instead of crashing,
     degrading that section to thin content rather than discarding a
     concept's already-successful generation over one missing key
     (consistent with how the Verifier's own per-section try/catch already
     treats a bad response as best-effort, not fatal).
  **Also added, same session, directly requested**: teachers can now
  delete any chapter they created — draft (`awaiting_review`) or already
  `published` — to redo a botched or stuck upload from scratch. New
  `DELETE /api/teacher/chapters/[chapterId]` walks the full dependency
  tree by hand in one transaction (quiz attempts → mastery scores →
  misconception tags → questions → sub-concepts → explanations → notes →
  videos → doubt messages → verifier flags → the uploaded source →
  topics → the chapter itself), since no relation in the schema cascades
  on delete. `DeleteChapterButton.tsx` adds an inline confirm step
  ("Delete this chapter and everything in it? This cannot be undone.")
  before calling it, wired into both the Content Panel's chapter list and
  the chapter review page.
  Verified live end-to-end on production, repeatedly, across all of the
  above: uploaded the same small real test chapter (addition/subtraction)
  four times in a row as each fix landed, watching a new distinct error
  surface each time until the final pass generated **both concepts
  completely clean** — Notes, all 5 Explain modes (including a full
  Worked Example with step-reveal), Practice (mixed mcq/assertion_reason/
  numeric questions) — with the Verifier genuinely catching and fixing
  real issues along the way (a hallucinated detail removed, a missing
  subtraction section restored from source, and three real arithmetic
  errors in draft practice questions corrected). Also verified deleting a
  chapter that was still mid-generation (stuck partway through, the exact
  real-world scenario that motivated the feature) cleanly removed it with
  no orphaned rows. All four test chapters created during this session
  were deleted afterward via the new feature itself, leaving the teacher
  account clean.
- **Socratic Doubt-chat mode + interactive Math graph widget** ✅ done
  (verified live 2026-08-22), following an investigation the founder
  requested into a YouTube video ("This AI Taught Me Calculus in 5
  Minutes") and its open-source project (github.com/llSourcell/mathvoice).
  Its voice feature was explicitly ruled out (desktop Chrome/Edge-only Web
  Speech API — unreliable for this app's actual Indian-school Android
  userbase), but two pieces were adopted:
  1. **Socratic "Guide me" mode** — Doubt-chat (`apps/web/lib/agents/doubt.ts`)
     gained an opt-in `mode: "direct" | "guide"` parameter (defaults to
     `"direct"`, today's unchanged behavior, per explicit founder decision —
     not a default-behavior change). In `"guide"` mode the system prompt
     instructs the model to ask exactly one guiding question instead of
     answering, only giving the direct answer if the student explicitly
     asks or is still stuck after a genuine attempt. No schema change, no
     new structured response fields — reuses the existing `{flagged,
     category, reply}` shape and safety moderation unconditionally. A
     small pill toggle in `DoubtChat.tsx`'s header switches modes
     (session-only state, resets on reopen). Confirmed live: asking "what's
     the y-intercept of y=2x+1" in Guide mode got a guiding question back
     ("What is the value of x at that exact spot on the graph?"), a
     half-right follow-up got an encouraging nudge toward the final step,
     and the same question in Direct mode got a normal, correct answer —
     switching modes mid-conversation works, and moderation is unaffected
     by mode.
  2. **Interactive Math graph** — a new `"graph"` `ExplainMode` (two
     migrations: `ALTER TYPE ... ADD VALUE` in its own transaction per the
     established Postgres gotcha, then the `Explanation.graph Json?`
     column) rendered via `mafs` (verified live against mafs.dev's actual
     docs before committing to its API — `Mafs`/`Coordinates.Cartesian`/
     `Plot.OfX`/`Point`) and `mathjs` for safe expression evaluation (no
     `eval()`/`new Function()`). `pedagogy.ts` only asks for a graph at all
     when the topic's subject is Math (same `isMath` check as
     `practice.ts`), and even then only if the model judges this specific
     topic has a function/equation genuinely worth plotting — `ExplainTab.tsx`
     hides the Graph tab entirely otherwise (no variant row exists for
     non-Math subjects; a `null` graph on a Math topic just filters out of
     `displayVariants`), same content-gating precedent as the existing
     picture-mode diagram. `MathGraphView.tsx` is lazy-loaded via
     `next/dynamic` — mafs+mathjs added ~200kB to the page bundle
     (`/student/topics/[topicId]` went from ~192kB to ~391kB First Load JS
     when statically imported), real weight to avoid shipping on every
     topic page for students on likely data-constrained Android devices;
     dynamic-importing it brought the base page back to ~194kB, only
     paying the cost when a graph actually renders.
     **One real bug found live-testing this**: the point-label legend
     showed each coordinate twice (e.g. "(0, 1) (0, 1)") — the model put
     the coordinate text itself into the `label` field, which
     `MathGraphView` then suffixed with `(x, y)` a second time. Fixed by
     clarifying the prompt that `label` must be a short descriptive name
     ("y-intercept"), never the coordinates, since those are already shown
     separately.
     Confirmed live end-to-end: uploaded a real "Linear Equations" Class 7
     Math chapter (`y = 2x + 1`), published it, and viewed it as a student
     — the Graph tab rendered a correct, correctly-scaled straight line
     with the right highlighted points at (0,1)/(1,3)/(2,5); a Science
     topic in the same session correctly showed no Graph tab at all.
- **Number line + fraction bar visuals** ✅ done (verified live 2026-08-22),
  same day as the function-graph widget above, after the founder asked
  whether Pragati could replicate how a real classroom teacher visually
  demonstrates *any* math concept on a whiteboard — decimals, fractions,
  algebra, geometry — not just the one example (column-method arithmetic)
  first discussed. Phased, highest-value-first: **number line** (decimals,
  fractions, integers, comparisons) and **fraction/area bar model**
  (parts-of-a-whole, equivalence, comparison) cover the broadest range of
  Class 3-8 NCERT topics for the least engineering. Algebra step-by-step
  stays served by the existing Worked Example (already subject-agnostic,
  progressive step reveal); geometry (real labeled shapes) is deliberately
  deferred — it needs its own shape-drawing system and is meaningfully
  harder than these two.
  **Architecture**: rather than adding two more `ExplainMode` enum values
  + two more migrations + two more `Explanation` columns (the pattern the
  function-graph itself used), generalized the *existing* `"graph"`
  mode/column into a discriminated union — `{kind: "function" |
  "numberline" | "fractionbar", ...}` — stored in the same
  `Explanation.graph Json?` column. Safe to do the day after: that shape
  had zero production data yet (the one test chapter was deleted), the
  cheapest possible moment to broaden it before real content accumulates
  against the old shape. **Zero new migrations.** `pedagogy.ts` now asks
  the model to pick the single best-fit visual (or null, if the topic is
  plain arithmetic/place-value the Worked Example already covers) instead
  of only ever considering a function graph. `NumberLineView.tsx`
  (proportional SVG line, labeled points, optional highlighted range) and
  `FractionBarView.tsx` (flex-row segment bars, a second bar at the same
  total pixel width for meaningful side-by-side comparison) are both
  plain SVG/flex — no new dependency, statically imported, unlike the
  Mafs-based function graph which stays behind its `next/dynamic` lazy
  chunk (confirmed via a fresh build: `/student/topics/[topicId]` grew by
  only ~1kB, from 194kB to 195kB, so the two new visuals add essentially
  zero bundle weight for any topic that doesn't render an actual
  function). The tab label changed from "Graph" to **"Visual"/"दृश्य"**
  (it can now show more than a function plot) — the underlying `mode`
  string stays `"graph"`, so this is a pure display-label change, no data
  implication (same precedent as `"worked"` displaying as "Worked
  example").
  Verified live end-to-end: uploaded a real "Fractions and Decimals"
  Class 5 chapter with two concepts — "Understanding Fractions" (3/4,
  equivalence to 2/4) correctly rendered a fraction bar with both 3/4 and
  2/4 shown at the same total width for meaningful comparison; "Comparing
  Decimals" (0.3 vs 0.7) correctly rendered a proportionally-accurate
  number line with both points positioned correctly, distinct labels
  ("First decimal"/"Second decimal") shown separately from their numeric
  values (0.3/0.7) with no duplication, and the range between them
  highlighted. Test chapter deleted afterward via the existing
  delete-chapter feature.
- **Geometry shapes (triangles, squares, circles) visual** ✅ done
  (verified live 2026-08-22), the fourth kind added to the Math `Visual`
  tab's discriminated union same day as the previous three, after the
  founder asked to go ahead and build the geometry piece explicitly
  deferred earlier. Covers identifying shapes, labeling sides/angles,
  perimeter/area, types of triangles (equilateral/isosceles/scalene/right),
  and parts of a circle.
  **Deliberately different design principle from the other three kinds**:
  a number line or fraction bar is hard for a model to get wrong (simple
  proportional layouts), but raw shape *coordinates* are exactly the kind
  of precise math an LLM shouldn't be trusted to invent freehand — a
  "square" that isn't quite square, an "equilateral triangle" that isn't
  equilateral. So the model here only ever picks a shape/subtype and
  supplies text labels; every shape's actual vertex geometry is a fixed,
  hand-verified layout in `GeometryView.tsx` (e.g. the equilateral
  triangle's three vertices are checked to actually be equidistant) —
  same principle as `arithmetic-checker.ts`. Side/angle label placement
  (midpoint + outward-normal offset for sides; angle bisector + a small
  SVG arc for angles) is one shared function reused across triangle/
  square/rectangle/parallelogram. Plain SVG, no new dependency — bundle
  size unchanged. Scope: trapezoid/pentagon/hexagon, parallel-line/
  transversal diagrams, congruence/similarity, and 3D shapes are
  deliberately out, each a separate future piece.
  **Two real bugs found live-testing, both fixed same session**: (1) for
  a `"right"` triangle, the model put its "90°" label on the wrong vertex
  — it has no way to know which array index is the actual right-angle
  vertex in the fixed layout, since that's an internal implementation
  detail it never sees. Fixed by having `GeometryView.tsx` always draw
  the conventional small square right-angle marker at the known vertex in
  code, ignoring the model's `angleLabels` entry there entirely rather
  than trusting it to guess correctly. (2) Re-testing that fix with fresh
  (non-cached) generation showed the prompt update alone ("the right
  angle is drawn automatically, don't label it") wasn't reliably
  followed — the model still added a stray, wrong "90" at a different
  vertex. Since a right triangle can only have one 90° corner and the
  real one is already guaranteed correct by the deterministic marker,
  fixed by having the code defensively drop any *other* vertex's label if
  it contains "90", rather than depending on prompt compliance for a fact
  the code can already verify — the general lesson (consistent with the
  chapter-generation reliability work two sessions earlier): where
  something is deterministically checkable, verify/enforce it in code
  rather than trusting the model to comply with an instruction about it.
  Confirmed live end-to-end: a rectangle rendered with all 4 sides
  correctly labeled (8 cm/8 cm/5 cm/5 cm) and neutral corner arcs (no
  angle labels, correctly not forced); a circle rendered with a correctly
  positioned/labeled radius line and center dot; a right triangle
  rendered with the right-angle marker at the true vertex, "Hypotenuse"
  correctly labeling the longest side, and "50°" correctly labeling the
  other acute angle, with no stray/misleading text anywhere. Test
  chapters deleted afterward via the existing delete-chapter feature.
- **Student Progress page** ✅ done (verified live 2026-08-22), first of
  six "modern learning features" the founder asked to brainstorm and then
  build (in order: Progress page, gamification/streaks, spaced-repetition
  reminders, concept map, self-explain/Feynman feedback, photo-based doubt
  solving). Fills a gap flagged since Phase 1: the sidebar already linked
  to `/student/progress`, but no page existed there (404).
  New in `apps/web/lib/agents/diagnostic.ts`, reusing the existing batched
  status functions rather than duplicating aggregation logic:
  `getProgressOverview` (every published chapter across all subjects in
  scope, rolled up per-subject via the newly-exported
  `combineTopicStatuses` — the same rollup already used chapter→topic),
  `getWeakAreasForStudent` (recurring misconceptions, `count >= 2`, across
  the student's *whole* history — the existing `getActiveMisconceptions`
  stays topic-scoped for Doubt-chat's nudge), and `getStudentStreak`
  (consecutive-day practice streak derived from `QuizAttempt.timestamp`,
  no new column — calendar days computed in IST since the product is
  India-only, so a streak doesn't look broken at 5:30am local time).
  The page itself (`apps/web/app/student/progress/page.tsx`) reuses the
  existing `STATUS_STYLES`/status-pill/card-shell conventions from
  `student/page.tsx` and stays a summary — it links out to the existing
  subject page for chapter-level detail rather than duplicating it.
  **Two real layout bugs found live-testing, both fixed same session**:
  (1) the status pill wrapped to two lines and visually overlapped the
  "View" button at normal card widths — fixed by adding
  `whitespace-nowrap` to the pill. (2) That fix's first attempt (giving
  the subject name `flex-1 min-w-0 truncate`) worked at normal widths but
  collapsed the name to *zero width* under real space pressure (caught by
  testing at the actual 375px mobile preset, not just desktop) —
  `flex-basis:0%`+`flex-grow:1` has nothing to fall back on once a
  `flex-none` sibling already claims the available space. Fixed by
  switching to `flex-wrap` with no `justify-between`: the name always
  keeps its natural width, and the pill drops to its own line if there's
  not enough room, instead of ever disappearing — a good general lesson
  reinforced here: verify a responsive fix at an actual narrow-device
  preset, not just by eyeballing one width.
  Verified live end-to-end: uploaded two real chapters (Math + Science)
  to the same school, answered practice questions as a Class 6 student —
  including deliberately repeating the same wrong MCQ option twice to
  trigger the `count >= 2` recurring threshold — then confirmed
  `/student/progress` showed a real "1 day streak," both subjects
  correctly as "Needs revision" (one mastered concept + one not-started
  concept per subject, matching `combineTopicStatuses`'s rollup rule),
  and the deliberately-repeated misconception ("Adding the numbers
  instead of multiplying equal groups") listed under "Areas to focus on"
  with a working link to that topic's Practice tab. Test chapters deleted
  afterward via the existing delete-chapter feature.
- **Gamification badges** ✅ done (verified live 2026-08-22), second of
  six "modern learning features," building directly on the Progress
  page's streak calculation from the first. Six badges on the Progress
  page covering different engagement angles: 🔥 3-Day Streak, 🔥 7-Day
  Streak, 🌟 First Topic Mastered, 🏆 5 Topics Mastered, 📚 Subject
  Master, ✍️ Practice Pro (50 quiz attempts). Computed live from existing
  data every page load — same "derive, don't cache" pattern as the rest
  of the diagnostic engine — deliberately not written to a new "earned
  badges" table, so there's no "earned on this date" timestamp and no
  celebratory unlock toast (would need a before/after comparison at
  submission time); worth revisiting later, out of scope for this pass.
  New in `diagnostic.ts`: `getLongestStreak` (the longest-ever run of
  consecutive practice days — deliberately distinct from
  `getStudentStreak`'s *current* run, since a badge must stay earned even
  after a missed day breaks the current streak, so it can't reuse that
  function's backward-from-today logic), `getMasteredTopicCount`
  (topic-level mastery count across all subjects in scope, mirroring
  `getChapterStatusesByIds`'s query shape but returning a count instead
  of the chapter rollup), and `getTotalQuizAttempts`. Subject-mastery
  count needed no new query — it's free from the `SubjectProgress[]` the
  page already fetches.
  Verified live end-to-end: mastered one Math topic (only chapter in that
  subject) as a fresh test student and confirmed exactly the right
  badges lit up — "First Topic Mastered" and "Subject Master" earned
  (green), "5 Topics Mastered"/both streak badges/"Practice Pro" still
  correctly locked (dimmed) since none of those thresholds were actually
  met yet — the streak-badge distinction in particular (locked despite a
  live "1 day streak" banner right above it) confirms `getLongestStreak`
  isn't accidentally reusing the current-streak logic. Also re-checked
  the badge grid at the 375px mobile preset per the lesson from the
  Progress page's own layout bugs — each tile is a self-contained
  icon+text stack (not competing for horizontal space with a sibling
  element the way the subject cards did), so it wrapped to a single
  column cleanly with no overlap or disappearing text. Test chapter
  deleted afterward via the existing delete-chapter feature.
- **Phase 5 — Parent dashboard** — not started.
- **Phase 6 — Landing page + paywall stub** — not started.
- **Phase 7 — Responsive polish + full manual QA** — not started.
- **Phase 8 — Admin / AI Ops Panel** — not started, requested by user
  2026-08-19 (not yet prioritized against Phases 3-7). Two things in one
  panel:
  1. **Model switcher** — pick which LLM (currently: `gemini-3.5-flash-lite`
     vs Groq's `openai/gpt-oss-120b`, both free-tier, see the live
     comparison run 2026-08-19) powers `generate()` in
     `packages/shared/src/llm.ts`, without a code deploy. Needs the model
     choice stored somewhere `generate()` reads at runtime (DB-backed config
     row, not just the `GEMINI_MODEL` env var it falls back to today) —
     also needs a matching Groq code path added to `llm.ts`, which today
     only calls the Gemini endpoint.
  2. **Agent instruction visibility/control** — surface and let the founder
     edit the system prompts that (a) generate study material (Notes,
     Pedagogy/Explain, Practice, Video/Image curation) and (b) enforce child
     safety (`CHILD_AUDIENCE_INSTRUCTION`, `TEACH_NOT_ROTE_INSTRUCTION`,
     `SAFETY_MODERATION_INSTRUCTION` in `packages/shared/src/prompts.ts`).
     These are hardcoded constants today — moving them to editable config
     needs real care: the safety instruction especially should probably be
     locked/reviewed-only rather than freely editable, so a well-meaning
     edit can't accidentally weaken the moderation check. Needs its own
     auth (this is founder-only, not a role the current stub session system
     has — `UserRole` is student/parent/teacher only).
- **Idea, not yet a phase — Read-aloud (TTS) for Notes/Story content**
  (raised 2026-08-19): for students who struggle with reading, add a
  "🔊 Listen" button that reads Notes/Story text aloud in a natural voice,
  like a teacher explaining rather than a robotic reader. Researched free
  options: **Google Cloud TTS is the strongest fit** — 1M characters/month
  free with no expiry (unlike Amazon Polly's 12-month-only free tier),
  WaveNet voices sound genuinely natural (unlike free browser
  SpeechSynthesis, which is free but robotic-sounding, zero setup, could
  still be a zero-cost stopgap). ElevenLabs has the most human-like voices
  but only ~10,000 free characters/month — not enough for real use.
  **Paused before setup**: Google Cloud requires entering card details to
  activate the API (even though usage would stay in the free tier — a
  budget alert was the planned safeguard against surprise charges), and the
  user wasn't comfortable with that yet. Revisit when the user is ready to
  add a card, or if a genuinely free-with-no-card TTS option turns up.

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
