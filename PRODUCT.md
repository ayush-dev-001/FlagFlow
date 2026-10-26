# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Engineers and product managers at small-to-mid SaaS teams. They open the dashboard during a rollout to turn a feature on for a few end users, widen it to everyone, or switch it off fast when something breaks. They also come here to debug a single report ("what does U001 see?"). Org admins also manage teammates, roles and API keys. A FlagFlow superadmin oversees organizations.

## Product Purpose

FlagFlow lets a team turn features in their own app on or off for specific end users without redeploying. Success means a change made in the dashboard is live in the customer's running app in under a second, and the team can always see who changed what.

## Positioning

Live, with no redeploy. Flag changes reach running apps over a server-sent event stream in under a second, and targeting uses the customer's own plain end-user IDs (`U001`), not FlagFlow accounts. It is deliberately simple and fast: on/off flags with a target list or "all users", not an enterprise experimentation suite.

## Operating Context

- Dashboard users sign in with email and password. Members join only by an emailed invite (48-hour link); only an org creator signs up freely. One user belongs to one org.
- A flags board groups flags into Inactive / Testing / Live, derived from enabled + all-users. A flag detail page has the toggle, description, targets, the all-users switch and history.
- End-user lookup: search an ID such as `U001` and see and toggle that user's flags.
- Admin areas: team (members, roles, invites), audit log, settings (org name, API keys, each shown once).
- A demo customer app (demo-api + demo-web) reacts live to six flags, as proof of the "no redeploy" claim.

## Capabilities and Constraints

- Roles: SUPERADMIN, ADMIN, MEMBER. Admin-only: deleting flags, the audit log, team management and settings.
- Flag keys match `^[a-z0-9_]{2,64}$`. Flags default to off and may exist before the feature ships in code. Unknown flag or user means off.
- Session model: a 15-minute in-memory access token plus a rotating httpOnly refresh cookie, refreshed silently.
- Every page needs loading, empty and error states, works at 375px width, and passes keyboard navigation (PLAN.md §3).
- Stack (decided in PLAN.md): React 19 + Vite, Tailwind CSS, TanStack Query, React Router, Motion.
- Out of scope for v1: percentage rollouts, A/B tests, per-environment flags, analytics, billing.

## Brand Commitments

- Name: FlagFlow.
- Voice: plain and precise, like a good developer tool. Short, literal labels; technical terms where they're the right word; no jokes, no marketing copy.
- Binding visual reference (owner decision, 2026-10-25): the public home page `apps/dashboard/src/landing/LandingPage.tsx`, and every screen matches it.
  - Near-black ink `#0b0d0c`, `#151817` cards, and lime `#c4f04a` as the one accent.
  - Inter Tight, with bold Title Case headlines. Lime glows.
  - The signed-in dashboard is dark ink + lime. Flag states: Live = lime, Testing = iris `#6b5cf6`, Inactive = grey. Flame `#ff5a24` is danger.
  - Auth pages share the home page's header and atmosphere.
  - Owner decision, 2026-10-26: the home page was redesigned as original work (it had followed a third-party template too closely). It has no pricing section while billing is out of scope, and its nav and footer link only to real sections, the API reference and the demo app.
  - Motion explains state changes, stays short, and respects `prefers-reduced-motion`.

## Evidence on Hand

- No logo or brand assets exist yet.
- No customers, testimonials or metrics exist. Don't fabricate any.
- The seeded demo org ("Acme Inc.") and its six flags (`dark_mode`, `chat_widget`, `analytics_dashboard`, `new_checkout`, `beta_banner`, `export_report`) are real fixtures, usable as example content.

## Product Principles

1. **State is always legible.** A flag's on/off state and who it reaches must be readable at a glance, and every change must visibly confirm it happened.
2. **Fast to the right flag.** Rollouts and incidents are time-pressured, so finding and toggling a flag takes the fewest steps.
3. **Safe by default.** Flags start off, destructive actions are deliberate, secrets are shown once, and every change is attributable in the audit log.
4. **Plain words.** Labels and errors say exactly what happened and what to do next.

## Accessibility & Inclusion

Keyboard-navigable throughout, usable at 375px, and `prefers-reduced-motion` respected for every animation (PLAN.md §3). WCAG AA contrast is assumed as the floor; no stricter standard has been stated.
