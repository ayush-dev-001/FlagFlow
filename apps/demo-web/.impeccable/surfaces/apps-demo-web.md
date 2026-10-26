---
version: 1
slug: "apps-demo-web"
primary_target: "apps/demo-web"
related_targets: ["apps/demo-api"]
---

# Demo customer app (phase 8)

Scope: apps/demo-web, the demo customer's app "Acme", plus its FlagFlow side panel. It is fed by apps/demo-api, which holds the API key and relays FlagFlow changes over its own event stream. Visitor mode: Demonstrate. Someone watching a FlagFlow demo should see a real-feeling product change live when a flag changes in the dashboard.

Audience and job: prospects and reviewers watching the demo, and the owner presenting it.
- Success: they pick a demo user and toggle a flag in the dashboard.
- Within a second, the Acme app visibly changes for that user and only that user. The panel says what changed and why.
- No refresh and no redeploy are involved.

Constraints:
- Owner decision, 2026-10-26 ("Own brand + FF panel"): Acme has its own look, which is deliberately not FlagFlow's. A FlagFlow-styled panel sits beside it.
- dark_mode must switch Acme between light and dark, so Acme can't be always-ink.
- The panel is FlagFlow's world: ink #0b0d0c, lime #c4f04a for on, Inter Tight, Geist Mono for keys and IDs.
- 375px, keyboard and reduced motion are required.
- Voice: plain and precise.

## Direction contract

THESIS: two worlds side by side, and you can see where one ends. Acme is a calm, warm product that changes. FlagFlow is the ink panel that tells you why. Lime belongs only to the panel, and Acme never uses it.

OWN-WORLD:
- **Acme:**
  - Geist type.
  - Light: warm paper #f6f4ef with white cards, #e4e0d7 rules and deep teal #0f766e. Dark: #111315 with #1a1d20 cards and bright teal #2dd4bf.
  - 10–16px radii, product tiles in muted sand, ochre, olive and slate.
  - The theme changes with a 420ms colour transition, which is dropped under reduced motion.
- **FlagFlow panel:**
  - A 340px ink column on the right from 1024px, sticky and full height. Below 1024px it sits above Acme in compact form: IDs only in the user picker, and flags in two columns from 640px.
  - A Live badge with a pulsing lime dot and the stream version, a link to the dashboard, a "Viewing as" picker of U001–U005, the six flags with lime On and grey Off for that user, and a "Live changes" log.
  - The log says "turned on for U001", or "changed, no effect for U001" when the change does nothing for this user.

FIRST VIEWPORT:
- Desktop: Acme fills the left. When beta_banner is on, a teal beta banner sits on top. Then the header (acme. wordmark, Shop / Orders / Analytics, the user's name) and the shop: a product grid with "Add to bag" and a bag card. When chat_widget is on, a teal chat bubble sits bottom-right of Acme.
- The six features:
  - dark_mode: light or dark Acme.
  - chat_widget: the chat bubble and its panel.
  - analytics_dashboard: stat cards and a weekly bar chart, or a dashed "Analytics is locked" card.
  - new_checkout: a one-step "Pay in one step" card with a "New checkout" tag, or a classic three-step form with a step bar.
  - beta_banner: the banner.
  - export_report: an "Export PDF" button on Orders that downloads a real PDF.
- The server enforces the same flags (analytics, export and checkout flow), so hiding a button is not the only gate.

FORM: an owner-chosen split (2026-10-26). Signature move: "the change lands". When a flag changes for the viewed user, Acme changes in place, the panel's flag row flashes lime once, and the log gains a line, all without a reload.

FINISH: unreviewed and undocumented is unfinished. This build ends with the finish review, the verdict and DESIGN.md, which notes that the demo is a separate world.
