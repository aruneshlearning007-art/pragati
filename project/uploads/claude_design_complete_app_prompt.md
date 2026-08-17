# Prompt for Claude Design — Complete Application Prototype (Desktop Web)

Paste this into Claude Design. This covers the full application, desktop-first — not just the MVP slice.

---

## What we're building

A desktop web prototype of the complete personalized learning platform for Class 3–8 students in India. Use **Class 6 Science, Chapter: "Light — Shadows and Reflections"** as the primary example throughout, but show **at least two other chapters** on the Home screen in different states (one mastered, one not-started) so the prototype demonstrates breadth, not just one topic in isolation. This is front-end only — no real backend, all data is realistic sample data.

There are three separate audiences, each with their own view: **Student**, **Parent**, and — new for this version — **Teacher**.

---

## 1. Design system (carry through everywhere)

- **Colors:** warm cream background, deep indigo/violet primary, and a consistent status language used everywhere status appears — green (mastered), amber (needs revision), blue (not started). Never color alone; always pair with an icon or label.
- **Typography:** must render English and Hindi (Devanagari) cleanly in the same interface — prove this on at least two screens.
- **Tone:** warm, encouraging, never exam-stress language ("let's try again," not "wrong" or "failed").
- **Components to reuse identically everywhere:** chapter/topic card with status, tab switcher, quiz question card, progress/mastery meter, primary/secondary buttons, status chip, empty/loading states.

---

## 2. Desktop layout paradigm

This is the biggest change from a mobile-first design:

- **Persistent left sidebar** for primary navigation (Subjects, Progress, Settings for students; Children/Class selector for parents/teachers) — replaces a mobile bottom tab bar entirely.
- **Main content area** to the right of the sidebar, generously spaced.
- **Side-by-side panes where it adds real value** — most importantly, the Explain screen should support viewing two explanation modes (e.g., Story and Picture) next to each other for direct comparison, not just one at a time in a tab.
- **Top bar** showing the current student's name/class/board and a language switcher, always visible.

---

## 3. Student-facing screens

### Onboarding
Name, class, board, language — same as before, adapted to a centered desktop layout rather than a mobile step-by-step flow.

### Home dashboard
Sidebar lists subjects; main panel shows the selected subject's chapters as cards with status. Include a small "today's focus" widget suggesting one specific topic worth revisiting, driven by the diagnostic engine.

### Notes view
Structured notebook-style notes for the example chapter. Include a visible **print/export** action — a genuine desktop-only affordance parents will use.

### Explain view
Story / Picture / Real-world / Go-further modes. Design this to demonstrate the **side-by-side comparison** capability specifically — show two modes open at once as one of the states.

### Video library
Curated videos for the chapter, embedded playback in-page (not linking out).

### Practice / Quiz view
Topic quiz with MCQ, assertion-reason, and picture-based question states, plus correct/incorrect feedback states and a results summary.

### Exam-prep mode
A separate entry point generating a full sample paper matching a real exam pattern, with questions visibly tagged when they target the student's weak topics. Results screen frames readiness, not just a score.

### Progress view
Simple, encouraging mastery visualization — not a dense analytics view (that's the parent/teacher job).

### Settings
Language, board/class display, subscription status.

---

## 4. Parent dashboard

- **Multi-child support:** design a child switcher (e.g., two sample children, "Ananya" and "Rohan") — this is part of the full vision, not just single-child.
- Weekly summary and topic-by-topic breakdown per selected child.
- Framed as "how you can help," not a report card.

---

## 5. Teacher dashboard (new — design this from scratch)

This doesn't exist yet anywhere else in our design — here's the concept to design against:

- **Class-level view, not one student.** A teacher selects a class/section and sees an aggregate mastery view across every student in it — e.g., a heatmap or bar view showing, per topic, what percentage of the class is mastered / needs revision / not started.
- **"Needs attention" list** — a sorted list surfacing which specific students have the most weak topics right now, so a teacher can prioritize who to check in with.
- **Topic drill-down** — clicking a topic shows exactly which students are weak on it (e.g., "60% of the class hasn't mastered reflection angles" → list of those specific students), so the teacher knows what to re-teach.
- **Student drill-down** — clicking a student shows their individual progress, similar to the parent view but from a teacher's vantage point.
- Keep this to **visibility and insight**, not assignment/homework features — the teacher sees and understands class-wide gaps; the prototype doesn't need an "assign this" action.

---

## 6. System states

Design once, apply everywhere: empty state, loading state, offline/error state.

---

## 7. Explicitly out of scope

- No real backend, authentication, or data persistence — realistic sample data throughout.
- The landing page is a separate, already-completed piece — this prompt is for the application itself.
- No assignment/homework creation tools in the teacher view — visibility only, per the scope above.
