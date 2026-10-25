---
version: 1
slug: "apps-dashboard"
primary_target: "apps/dashboard"
related_targets: []
---

# Dashboard foundation (phase 6)

Scope: apps/dashboard (the design system, the app shell, the auth pages: login, register with the one-time API key reveal, accept invite) plus the public home page that defines the world. Visitor mode: Operate for the app and auth, Persuade for the home page.

Audience and job: engineers and PMs signing in to change flags during a rollout or incident, and admins onboarding teammates. Success: going from the home page's "Get started" to a working session feels like one site, everything in the shell is where they expect it, and the one-time API key is never lost.

Constraints: the owner made the home page (src/landing/LandingPage.tsx) the binding visual reference on 2026-10-25 (PLAN.md §3, PRODUCT.md Brand Commitments). The dashboard is dark ink + lime. Flag states are Live lime, Testing iris, Inactive grey, and flame is danger. Auth pages are two sections, form and mirroring illustration, without the site header. 375px, keyboard navigation and reduced motion are required. Voice: plain and precise.

## Direction contract

THESIS: one world from the first pixel of the home page to the last toggle in the app. Near-black ink, and lime as the single signal: lime means "on", "go" or "focus", and nothing else is lime. It refuses the split where the marketing site and the product look like two companies.

OWN-WORLD:
- Ink ground #0b0d0c with #151817 / #161918 cards and hairlines at white 6–12%.
- Lime #c4f04a for the primary action (ink text), live state, focus and corner glows. Iris #6b5cf6 for Testing, flame #ff5a24 for danger, neutral grey for Inactive.
- Inter Tight: bold Title Case headlines tracked -0.04 to -0.055em, body white at 55–60%, Geist Mono only for keys and IDs.
- 9px buttons, 16–20px cards, a lime square mark beside the wordmark.

STORY: a visitor sees what FlagFlow does on the home page, clicks "Get started", and lands on a form in the same world. Once signed in they work in a calm ink shell where lime always means something is on.

FIRST VIEWPORT:
- Auth pages have no site header (owner decision, 2026-10-25): two sections on screens from 1024px. On the left, the wordmark (a link home) sits top-left; a 400px column, centred vertically, holds a bold Title Case headline with a white/55 subline and then the form directly on ink: fields at a 16px gap, a full-width lime submit and a left-aligned 13px note. One lime glow (25%, 120px blur) bleeds from the lower-left corner. On the right, a 28px-radius #151817 panel inset 12px holds two faint concentric arcs, two lime sparkles, a lime pool (30%, 110px blur) under the desk, and the owner-supplied desk illustration (Login.svg, recoloured to ink, greys, white and lime by scripts/build-login-art.mjs). Its monitor mirrors the form: line 1 fills with the length of all text fields together, line 2 with the password length (lengths only, never values), a caret blinks on the focused line, the button pulses while submitting, and a failed submit turns the whole screen flame #ff5a24 and shakes it, the lines and button staying ink. Below 1024px the panel is dropped and the form stands alone.
- The app shell: a 248px ink sidebar (lime-square wordmark, Workspace and Admin groups, org/user block with Log out). The active item is lime-tinted with a lime icon. The page header is a bold tight Title Case title.

FORM: home-page world, pinned by the owner (PLAN.md §3), first on the list. The earlier roll's assignment is not followed because an owner-pinned direction beats the roll (new-work §3). seed:213ea1b59b88bf0c. Signature move: "lime is on". Every on-state in the product (a live flag, a selected nav item, a toggle, a focused field, the billing pill) is the same lime, and it animates in with the home page's expo ease.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
