---
name: FlagFlow
description: One world from the home page to the last toggle. Near-black ink, and lime only where something is on.
colors:
  ink: '#0b0d0c'
  sidebar: '#101312'
  surface: '#151817'
  feature-card: '#161918'
  raised: '#1c1f1e'
  hover: '#222624'
  line: 'rgb(255 255 255 / 0.07)'
  text: '#ffffff'
  muted: '#a2a5a3'
  subtle: '#868a88'
  lime: '#c4f04a'
  lime-soft: 'rgb(196 240 74 / 0.12)'
  iris: '#6b5cf6'
  iris-text: '#a59cff'
  iris-soft: 'rgb(107 92 246 / 0.2)'
  off: '#8a8e8c'
  off-soft: 'rgb(255 255 255 / 0.07)'
  flame: '#ff5a24'
  flame-soft: 'rgb(255 90 36 / 0.12)'
typography:
  display:
    fontFamily: 'Inter Tight Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: 'clamp(2.25rem, min(5.76vw, 8.1vh), 4.725rem)'
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: '-0.055em'
  headline:
    fontFamily: 'Inter Tight Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: 'clamp(2.25rem, 5vw, 3.4rem)'
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: '-0.055em'
  title:
    fontFamily: 'Inter Tight Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: 'clamp(2rem, 3vw, 2.75rem)'
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: '-0.05em'
  card-title:
    fontFamily: 'Inter Tight Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '22px'
    fontWeight: 600
    letterSpacing: '-0.03em'
  lead:
    fontFamily: 'Inter Tight Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '17px'
    fontWeight: 400
    lineHeight: 1.375
  body:
    fontFamily: 'Inter Tight Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '15px'
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: 'Inter Tight Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '13px'
    fontWeight: 500
    lineHeight: 1.4
  mono:
    fontFamily: 'Geist Mono Variable, ui-monospace, SFMono-Regular, monospace'
    fontSize: '14px'
    fontWeight: 400
    lineHeight: 1.625
    fontFeature: "'tnum'"
rounded:
  mark: '3px'
  control: '9px'
  panel: '16px'
  card: '20px'
  pill: '9999px'
spacing:
  field-gap: '16px'
  card-pad: '24px'
  card-pad-wide: '32px'
  page-x: '40px'
  page-y: '56px'
  sidebar: '248px'
components:
  button-primary:
    backgroundColor: '{colors.lime}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    padding: '0 16px'
    height: '40px'
  button-primary-lg:
    backgroundColor: '{colors.lime}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    padding: '0 20px'
    height: '47px'
  button-primary-disabled:
    backgroundColor: 'rgb(255 255 255 / 0.06)'
    textColor: 'rgb(255 255 255 / 0.4)'
    rounded: '{rounded.control}'
  button-secondary:
    backgroundColor: 'rgb(255 255 255 / 0.05)'
    textColor: '{colors.text}'
    rounded: '{rounded.control}'
    padding: '0 16px'
    height: '40px'
  button-secondary-hover:
    backgroundColor: 'rgb(255 255 255 / 0.09)'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.muted}'
    rounded: '{rounded.control}'
    padding: '0 16px'
    height: '40px'
  button-ghost-hover:
    backgroundColor: 'rgb(255 255 255 / 0.06)'
    textColor: '{colors.text}'
  button-danger:
    backgroundColor: '{colors.flame-soft}'
    textColor: '{colors.flame}'
    rounded: '{rounded.control}'
    padding: '0 16px'
    height: '40px'
  input:
    backgroundColor: 'rgb(11 13 12 / 0.7)'
    textColor: '{colors.text}'
    typography: '{typography.body}'
    rounded: '{rounded.control}'
    padding: '0 14px'
    height: '44px'
  card:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
    rounded: '{rounded.card}'
    padding: '{spacing.card-pad-wide}'
  state-pill-live:
    backgroundColor: '{colors.lime-soft}'
    textColor: '{colors.lime}'
    typography: '{typography.label}'
    rounded: '{rounded.pill}'
    padding: '4px 10px'
  state-pill-testing:
    backgroundColor: '{colors.iris-soft}'
    textColor: '{colors.iris-text}'
    typography: '{typography.label}'
    rounded: '{rounded.pill}'
    padding: '4px 10px'
  state-pill-inactive:
    backgroundColor: '{colors.off-soft}'
    textColor: '{colors.muted}'
    typography: '{typography.label}'
    rounded: '{rounded.pill}'
    padding: '4px 10px'
  nav-item:
    backgroundColor: 'transparent'
    textColor: 'rgb(255 255 255 / 0.6)'
    rounded: '{rounded.control}'
    padding: '0 12px'
    height: '40px'
  nav-item-active:
    backgroundColor: '{colors.lime-soft}'
    textColor: '{colors.text}'
  site-header:
    backgroundColor: 'rgb(255 255 255 / 0.035)'
    textColor: '{colors.text}'
    rounded: '{rounded.panel}'
    height: '64px'
  site-header-cta:
    backgroundColor: '{colors.text}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    padding: '10px 20px'
---

# Design System: FlagFlow

## Overview

**Creative North Star: "Lime Is On"**

FlagFlow is one world from the first pixel of the public home page (`apps/dashboard/src/landing/LandingPage.tsx`, the owner's binding visual reference) to the last toggle in the signed-in app. The ground is near-black ink. Content sits on slightly lifted near-black cards with white hairlines. One colour carries meaning: lime. It marks something that is on, the action that will make something go, and the thing that has focus. Nothing else is lime, so a glance at any screen tells you what is live.

The voice is bold and tight. Headlines are Inter Tight at weight 700, Title Case, with heavy negative tracking. Reading text is white at 55 to 60% opacity. Geist Mono shows up only for strings a person would copy into code. The home page carries the richest version of the world: a floating glass header, side rails, faint arcs, lime sparkles, and lime glows bleeding up from the lower corners. The auth pages reuse that header and atmosphere unchanged. The signed-in shell keeps only the two corner glows, faint enough to work under.

Motion uses one exponential ease-out. Content rises a few pixels as it arrives, on-states settle in, and everything honours `prefers-reduced-motion`.

**Key Characteristics:**

- Ink ground (#0b0d0c) with near-black cards and white hairlines at 6 to 12%.
- Lime (#c4f04a) only for on, go and focus. Ink text on lime fills.
- Flag state: Live lime, Testing iris, Inactive grey. Danger is flame.
- Inter Tight bold Title Case headlines tracked -0.04 to -0.055em. Geist Mono only for keys and IDs.
- Three radii: 9px controls, 16px panels, 20px cards. A 3px-rounded lime square is the mark.
- Atmosphere is lime light, never violet or another hue.

## Colors

Near-black ink with neutral grey-green undertones, white type at reading opacities, and a single acid-lime signal. Iris and flame each have one meaning.

### Primary

- **Signal Lime** (#c4f04a): the primary action fill (with ink text), the Live state, the active nav icon and its lime-soft wash, input focus border and halo, the focus outline, caret, text selection, spinner, the one-time API key text, the stored-key checkbox once ticked, inline "go" links (Create an organization, Go to FlagFlow), and the corner glows. The Mark is a lime square.
- **Lime Wash** (lime at 12%): the active nav item background and the Live pill fill.

### Secondary

- **Iris** (#6b5cf6): Testing state only. The Testing dot is iris, and the pill fill is iris at 20%.
- **Iris Text** (#a59cff): Testing pill text. Iris itself is too dark to read on ink, so the label uses this lighter tint.

### Tertiary

- **Flame** (#ff5a24): danger and errors only: the danger button, field error border (flame at 60%) and error text, and the alert icon. **Flame Wash** (flame at 12%) fills the danger button and alerts.

### Neutral

- **Ink** (#0b0d0c): the page ground everywhere, the text on lime and white fills, and the input well (ink at 70%).
- **Sidebar Ink** (#101312): the app sidebar and mobile drawer, opaque.
- **Card Ink** (#151817): auth form card, app panels, the API key card, pricing cards.
- **Feature Ink** (#161918): home page feature cards.
- **Raised Ink** (#1c1f1e): the billing toggle track and the skip link.
- **Hover Ink** (#222624): hover for small icon buttons and Log out in the shell.
- **Hairline** (white at 6 to 7%): card edges, sidebar edge, section dividers. Control borders step up to white at 10% (hover 20%).
- **White** (#ffffff): headlines, labels, active nav text, and the site header's Get started fill.
- **Muted** (#a2a5a3): secondary copy, ghost buttons, Inactive pill text.
- **Subtle** (#868a88): hints, placeholders, nav group titles.
- **Inactive Grey** (#8a8e8c): the Inactive state dot.

### Named Rules

**The Lime Is On Rule.** Lime means on, go or focus, and nothing else. Before making anything lime, name which of the three it is. If it is none of them, it is not lime.

**The Three States Rule.** Flag state has exactly three colours: Live lime, Testing iris (text #a59cff), Inactive grey. The off state is always labelled "Inactive". Flag state colour comes only through the state pill.

**The Flame Is Danger Rule.** Flame marks destructive actions and errors only. It is never decoration in the app.

**The Lime Light Rule.** Atmospheric light (corner glows, sparkles, the live dot's glow) is lime. No other hue is used for atmosphere.

## Typography

**Display Font:** Inter Tight Variable (with ui-sans-serif, system-ui)
**Body Font:** Inter Tight Variable
**Label/Mono Font:** Geist Mono Variable (with ui-monospace, SFMono-Regular), for machine text only

**Character:** One tight grotesque does all the talking. It is heavy and compressed at headline size and plain at reading size. Mono is used sparingly so that a key or an ID reads as something to copy.

### Hierarchy

- **Display** (700, clamp(2.25rem, min(5.76vw, 8.1vh), 4.725rem), 1.02, -0.055em): the home page hero and section headlines.
- **Headline** (700, clamp(2.25rem, 5vw, 3.4rem), 1.02, -0.055em): auth page titles ("Welcome Back").
- **Title** (700, clamp(2rem, 3vw, 2.75rem), 1.04, -0.05em): app page titles in the page header, and the 404 and error titles.
- **Card Title** (600, 22px, -0.03em): titles inside cards ("Not Available Yet", plan names). Smaller card headings go to 19px at -0.02em.
- **Lead** (400, 17px, 1.375): auth sublines and home page section leads, in white at 55%. Page header descriptions use 16px white/55 at max 60ch.
- **Body** (400, 15px): field text and labels (labels at 500), alerts, nav items (500), working copy.
- **Label** (500 to 600, 13px): state pills, hints, errors, nav group titles. Sentence case at normal tracking.
- **Mono** (400, 14px, 1.625, tabular numbers): API keys, flag keys, user IDs, env vars.

### Named Rules

**The Tight Title Rule.** Headlines are bold Title Case and tracked -0.04 to -0.055em. They balance-wrap and never go uppercase.

**The Machine Text Rule.** Geist Mono is only for keys and IDs, meaning strings a person would copy into code. It is never used for headings, labels or decoration.

## Layout

The app shell has a sticky 248px sidebar from 1024px up. Below that there is a 56px sticky top bar (ink at 80%, 24px blur) with a menu button that opens the sidebar as a drawer (min(80vw, 280px)) over an ink/75 scrim. The main column is capped at 1152px with 16px side padding (40px from 640px) and 40px vertical padding (56px from 1024px). The page header sits 40px above the content and stacks on mobile. From 640px its actions align to the right, on the title's baseline.

Auth pages are centred. The site header comes first, then the title block (max 480px, top offset 56px, or 8vh on large screens), then a 440px form card 40px below. The card's padding is 24px, or 32px from 640px. Fields stack at a 16px gap and the submit button is full width.

The site header floats 12px from the top. It is 64px tall and capped at 900px. Its nav links hide below 768px, and Sign in hides below 640px. Home page content is capped at 1116px and drawn at 90% of the default Tailwind scale (scoped to the home page only). Sparkles show from 768px up so they never cross a headline on a phone.

## Elevation & Depth

Depth comes mostly from tone: ink ground, a slightly lifted card ink, and white hairlines. Light comes from atmosphere, not from shadows on components. Lime glows are blurred circles that bleed up from the lower corners. They are strong on the home page and auth pages (lime at 45% and 25%, about 120px blur) and faint behind the signed-in shell (lime at 13% and 7%).

### Shadow Vocabulary

- **Form card drop** (`box-shadow: 0 30px 80px -40px rgb(0 0 0 / 0.9)`): the auth form card only, to lift it off the atmosphere.
- **Live dot glow** (`box-shadow: 0 0 10px #c4f04a`): the Live state dot and other on-dots. It is a light, not a shadow.
- **Focus halo** (`box-shadow: 0 0 0 3px rgb(196 240 74 / 0.18)`): focused inputs, with the border at lime 70%.

### Named Rules

**The Glow Means On Rule.** The only component that glows is something that is on. Buttons and cards don't glow at rest.

**The Opaque Chrome Rule.** The app sidebar and drawer are opaque Sidebar Ink. Only the floating site header (white at 3.5%, medium blur) and the mobile app top bar are translucent.

## Shapes

Corners come in three steps. Controls are 9px (buttons, inputs, nav items, code wells, alerts). Panels and chrome are 16px (the floating site header, feature cards). Cards are 20px (the auth form card, app panels, the API key card, home page showcase and stat cards). Pills and dots are fully round. The Mark is a 14px lime square with 3px corners. On the home page, hairline rails, concentric faint arcs and lime cross-shaped sparkles add geometry around the hero.

**The Three Radii Rule.** Use 9px for controls, 16px for panels and 20px for cards. Other values are reference-page exceptions, not steps on the scale.

## Components

### Buttons

Confident, flat and quick.

- **Shape:** gently rounded (9px). Medium is 40px tall with 16px padding at 14px. Large is 47px tall with 20px padding at 17px.
- **Primary:** lime fill, ink text, weight 600. Hover brightens it (brightness 110%). Press moves it down 1px. Transitions take 150ms.
- **Disabled primary:** neutral. White at 6% fill with white at 40% text, at full opacity. Lime appears only once the action can go.
- **Secondary:** borderless white at 5% fill with white text (hover 9%).
- **Ghost:** transparent with muted text. Hover adds a white 6% fill and white text.
- **Danger:** flame wash fill, flame text, 1px flame/30 border.
- **Loading:** a spinner replaces the icon, and the button is marked aria-busy.

### Chips: State Pill

- **Style:** fully round, 4px by 10px padding, 13px semibold, with a 6px dot before the label.
- **State:** Live has a lime wash, lime text and a glowing lime dot. Testing has an iris 20% fill, #a59cff text and an iris dot. Inactive has a white 7% fill, muted text and a grey dot.

### Cards / Containers

- **Corner Style:** 20px.
- **Background:** Card Ink (#151817).
- **Shadow Strategy:** none, except the auth form card drop (see Elevation).
- **Border:** 1px white at 6%.
- **Internal Padding:** 24px, or 32px from 640px. Empty states use 28px by 48px.
- **Icon tile:** 47px square, white at 8%, with a 24px icon at 1.5 stroke.

### Inputs / Fields

- **Style:** 44px tall, 9px radius, ink at 70% fill, 1px white/10 border (hover white/20), 14px padding, 15px text, subtle placeholder. The label above is 15px medium white, with an 8px gap to the input.
- **Focus:** the border turns lime at 70% with a 3px lime halo at 18%. The caret is lime.
- **Error:** flame/60 border, 13px flame error text, and aria-describedby links the message to the input. Hints are 13px subtle.
- **Checkbox:** 18px with 5px corners, ink fill and a white/20 border. When ticked it fills lime with an ink check.

### Navigation

- **Sidebar:** Sidebar Ink with a white/6 right edge. The wordmark sits at the top (64px row). Group titles (Workspace, Admin or Platform) are 13px subtle. Items are 40px tall, 15px medium, white/60, with an 18px icon at white/45. Hover adds a white 5% fill.
- **Active item:** lime wash fill, white text, lime icon.
- **Footer block:** org name, then email and role, then Log out as a ghost row, above a hairline.
- **Mobile:** a translucent top bar with a menu button and the wordmark. The drawer slides in from the left with the base ease, focus moves into it, and Escape closes it.

### Site Header (signature)

A floating glass bar: 64px tall, 900px max, 16px radius, white/3.5% fill, white/5 border, medium backdrop blur. It holds the 20px bold wordmark with the lime Mark, nav links at 14px white/60, Sign in at white/70, and a white Get started button (9px, ink text) that turns lime on hover. It is shared by the home page and every auth page.

### Site Atmosphere (signature)

Two white/5 vertical rails at 17% from each edge, two concentric faint arcs (white/6 and white/4), two lime cross sparkles from 768px up, and lime glows in the lower corners. The auth pages use it unchanged.

### Motion

One ease: cubic-bezier(0.16, 1, 0.3, 1). Durations are 160ms, 240ms and 420ms. Page content rises 6px. Hero and auth blocks rise 14px over 700ms, staggered by 80ms. A spring (stiffness 520, damping 38) is used only for things that settle, such as a toggle knob. Reduced motion keeps opacity and drops transforms.

## Do's and Don'ts

### Do:

- **Do** make the whole product match the home page: ink ground, near-black cards, lime as the only signal.
- **Do** use lime only for on, go and focus: the primary action, Live, the active nav item, focus, a ticked checkbox.
- **Do** show flag state through the state pill: Live lime, Testing iris with #a59cff text, Inactive grey, and always call off "Inactive".
- **Do** use flame (#ff5a24) for danger and errors only.
- **Do** set headlines in Inter Tight bold Title Case, tracked -0.04 to -0.055em, with reading text at white 55 to 60%.
- **Do** keep to three radii: 9px buttons, 16px panels, 20px cards.
- **Do** give every auth page the site header and the hero atmosphere.
- **Do** keep a primary button neutral (white 6% fill, white 40% text) while it is disabled.
- **Do** show landing photographs in greyscale, and give every shipped raster a `.webp.json` provenance sidecar (the four home photos are free-license stock).

### Don't:

- **Don't** make anything lime that is not on, go or focus, including decoration, headings or section labels in the app.
- **Don't** use Geist Mono for headings, labels or decoration.
- **Don't** introduce a violet, indigo or other hue as an accent or atmosphere. Iris is Testing only.
- **Don't** make the app sidebar or drawer translucent.
- **Don't** add a lime glow to buttons or cards. A glow means something is on.
