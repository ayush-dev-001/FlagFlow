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
  dialog-title:
    fontFamily: 'Inter Tight Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '22px'
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: '-0.04em'
  panel-title:
    fontFamily: 'Inter Tight Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '17px'
    fontWeight: 600
    letterSpacing: '-0.02em'
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
  key-title:
    fontFamily: 'Geist Mono Variable, ui-monospace, SFMono-Regular, monospace'
    fontSize: 'clamp(1.6rem, 3vw, 2.1rem)'
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: '-0.03em'
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
  panel-pad: '24px'
  stack-gap: '16px'
  board-gap: '24px'
  detail-rail: '320px'
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
  switch-off:
    backgroundColor: 'rgb(255 255 255 / 0.12)'
    rounded: '{rounded.pill}'
    width: '40px'
    height: '24px'
  switch-on:
    backgroundColor: '{colors.lime}'
    textColor: '{colors.ink}'
    rounded: '{rounded.pill}'
    width: '40px'
    height: '24px'
  switch-lg:
    rounded: '{rounded.pill}'
    width: '54px'
    height: '32px'
  panel:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
    typography: '{typography.panel-title}'
    rounded: '{rounded.card}'
    padding: '{spacing.panel-pad}'
  flag-card:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
    typography: '{typography.mono}'
    rounded: '{rounded.panel}'
    padding: '16px'
  flag-card-hover:
    backgroundColor: '{colors.raised}'
  segmented:
    backgroundColor: 'rgb(255 255 255 / 0.04)'
    rounded: '{rounded.control}'
    padding: '4px'
  segmented-item-active:
    backgroundColor: 'rgb(255 255 255 / 0.09)'
    textColor: '{colors.text}'
    height: '36px'
    padding: '0 12px'
  select:
    backgroundColor: 'rgb(11 13 12 / 0.7)'
    textColor: '{colors.text}'
    typography: '{typography.body}'
    rounded: '{rounded.control}'
    padding: '0 36px 0 12px'
    height: '40px'
  search-input:
    backgroundColor: 'rgb(11 13 12 / 0.7)'
    textColor: '{colors.text}'
    typography: '{typography.body}'
    rounded: '{rounded.control}'
    padding: '0 14px 0 40px'
    height: '44px'
  id-chip:
    backgroundColor: 'rgb(255 255 255 / 0.04)'
    textColor: '{colors.text}'
    rounded: '{rounded.pill}'
    padding: '0 4px 0 12px'
    height: '32px'
  connected-badge-on:
    backgroundColor: '{colors.lime-soft}'
    textColor: '{colors.lime}'
    typography: '{typography.label}'
    rounded: '{rounded.pill}'
    padding: '0 12px'
    height: '32px'
  connected-badge-off:
    backgroundColor: 'rgb(255 255 255 / 0.03)'
    textColor: '{colors.muted}'
    typography: '{typography.label}'
    rounded: '{rounded.pill}'
    padding: '0 12px'
    height: '32px'
  dialog:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
    typography: '{typography.dialog-title}'
    rounded: '{rounded.card}'
    padding: '24px'
    width: '460px'
  dialog-wide:
    width: '560px'
  toast:
    backgroundColor: '{colors.raised}'
    textColor: '{colors.text}'
    typography: '{typography.body}'
    rounded: '{rounded.control}'
    padding: '12px 16px'
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

The voice is bold and tight. Headlines are Inter Tight at weight 700, Title Case, with heavy negative tracking. Reading text is white at 55 to 60% opacity. Geist Mono shows up only for strings a person would copy into code. The home page carries the richest version of the world: a floating glass header, side rails, faint arcs, lime sparkles, and lime glows bleeding up from the lower corners. The auth pages drop the header and split into form and illustration. The signed-in shell keeps only the two corner glows, faint enough to work under. Its screens are built from panels: near-black 20px cards with a title row, switches that turn lime when a flag is on, and a toast that confirms each change.

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
- **Lime Wash** (lime at 12%): the active nav item background, the Live pill fill and the connected badge fill.

The signed-in screens add these lime uses, and each is an "on": the switch track when on, the connected badge (lime text, lime/25 border, a pulsing lime dot) while at least one SDK stream is open, the success toast's check, the Copied check, "Gets it" with a glowing lime dot on End users, an Active organization on Admin, and the board card's focus ring.

### Secondary

- **Iris** (#6b5cf6): Testing state only. The Testing dot is iris, and the pill fill is iris at 20%.
- **Iris Text** (#a59cff): Testing pill text. Iris itself is too dark to read on ink, so the label uses this lighter tint.

### Tertiary

- **Flame** (#ff5a24): danger and errors only: the danger button, field error border (flame at 60%) and error text, the alert icon, the error toast's icon and the error state's icon. **Flame Wash** (flame at 12%) fills the danger button, alerts and the error state's icon tile.

### Neutral

- **Ink** (#0b0d0c): the page ground everywhere, the text on lime and white fills, and the input well (ink at 70%).
- **Sidebar Ink** (#101312): the app sidebar and mobile drawer, opaque.
- **Card Ink** (#151817): the auth illustration panel, app panels, the API key card, pricing cards.
- **Feature Ink** (#161918): home page feature cards.
- **Raised Ink** (#1c1f1e): the billing toggle track, the skip link, toasts, and a flag card on hover.
- **Hover Ink** (#222624): hover for small icon buttons and Log out in the shell.
- **Hairline** (white at 5 to 8%): card and panel edges and the panel title rule (6%), list row dividers (5%), dialog, toast and chip edges (8%), the sidebar edge and section dividers. Control borders step up to white at 10% (hover 20%).
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
- **Headline** (700, clamp(2.25rem, 4vw, 3rem), 1.02, -0.055em): auth page titles ("Welcome Back").
- **Title** (700, clamp(2rem, 3vw, 2.75rem), 1.04, -0.05em): app page titles in the page header, and the 404 and error titles.
- **Card Title** (600, 22px, -0.03em): titles inside cards (plan names). Smaller card headings go to 19px at -0.02em.
- **Dialog Title** (700, 22px, 1.25, -0.04em): dialog titles ("Copy Your New Key", "Delete new_checkout?") and the On/Off word in a flag's status panel.
- **Panel Title** (600, 17px, -0.02em): panel title rows ("Audience", "History", "Delete Flag") and the titles of empty and error states. Title Case.
- **Key Title** (Geist Mono 600, clamp(1.6rem, 3vw, 2.1rem), 1.25, -0.03em): the flag detail page title, which is the flag key itself. It breaks anywhere, so long keys wrap.
- **Lead** (400, 17px, 1.375): home page section leads, in white at 55%; auth sublines use 16px. Page header descriptions use 16px white/55 at max 60ch.
- **Body** (400, 15px): field text and labels (labels at 500), alerts, toasts, nav items (500), list row names (500), audit sentences, working copy. Panel and flag card descriptions are 14px white/55.
- **Label** (500 to 600, 13px): state pills, hints, errors, nav group titles. Sentence case at normal tracking.
- **Mono** (400, 14px, 1.625, tabular numbers): API keys, flag keys, user IDs, env vars, the flag version. ID chips use 13px.

### Named Rules

**The Tight Title Rule.** Headlines are bold Title Case and tracked -0.04 to -0.055em. They balance-wrap and never go uppercase.

**The Machine Text Rule.** Geist Mono is only for keys and IDs, meaning strings a person would copy into code. When a page is about one key, the key is its title and stays mono (the flag detail page). Mono is never used for headings, labels or decoration that are not themselves a key.

**The Sentence Rule.** Activity reads as sentences, not table cells: the actor in white semibold, the rest at white/60, keys in mono inside the sentence ("Ada Admin turned new_checkout on"), and a relative time on the right that gives the exact date on hover.

## Layout

The app shell has a sticky 248px sidebar from 1024px up. Below that there is a 56px sticky top bar (ink at 80%, 24px blur) with a menu button that opens the sidebar as a drawer (min(80vw, 280px)) over an ink/75 scrim. The main column is capped at 1152px with 16px side padding (40px from 640px) and 40px vertical padding (56px from 1024px). The page header sits 40px above the content and stacks on mobile. From 640px its actions align to the right, on the title's baseline.

Auth pages have no site header (owner decision, 2026-10-25): two sections on screens from 1024px. On the left, the wordmark (a link home) sits top-left; a 400px column, centred vertically, holds a bold Title Case headline with a white/55 subline and then the form directly on ink: fields at a 16px gap, a full-width lime submit and a left-aligned 13px note. One lime glow (25%, 120px blur; 15% and smaller on phones) bleeds from the lower-left corner. On the right, a 28px-radius #151817 panel inset 12px holds two faint concentric arcs, two lime sparkles, a lime pool (30%, 110px blur) under the desk, and the owner-supplied desk illustration (Login.svg, recoloured to ink, greys, white and lime by scripts/build-login-art.mjs). Its monitor mirrors the form: line 1 fills with the length of all text fields together, line 2 with the password length (lengths only, never values), a caret blinks on the focused line, the button pulses while submitting, and a failed submit turns the whole screen flame #ff5a24 and shakes it, the lines and button staying ink. Below 1024px the panel is dropped and the form stands alone.

Signed-in screens stack panels at 16px gaps. The flags board is three equal columns from 1024px, in the order Inactive, Testing, Live, 24px apart. Each column is headed by its state pill, a 13px subtle meaning ("On for listed users only") and a count on the right; an empty column shows a dashed white/8 16px box that says so. Above the board, 28px up, sit the search field (up to 340px), the state filter (380px) and the connected badge pushed right; below 768px they stack, and below 1024px so do the columns. The flag detail page has a back link, then the mono key title with its state pill and the connected badge, then a main column and a 320px side rail from 1024px (status, audience and history on the left; description, details and the admin Delete panel on the right). Lists inside panels are rows split by white/5 hairlines with 16px vertical padding, and their columns stack into one on phones. Toasts stack bottom-right, 24px in, from 640px, and bottom-centre, 16px in, on phones; at most three show, each up to 380px wide. Dialogs are centred with 16px margins on phones, and their action rows stack full width, confirming button on top, below 640px.

The site header floats 12px from the top. It is 64px tall and capped at 900px. Its nav links hide below 768px, and Sign in hides below 640px. Home page content is capped at 1116px and drawn at 90% of the default Tailwind scale (scoped to the home page only). Sparkles show from 768px up so they never cross a headline on a phone.

## Elevation & Depth

Depth comes mostly from tone: ink ground, a slightly lifted card ink, and white hairlines. Light comes from atmosphere, not from shadows on components. Lime glows are blurred circles that bleed up from the lower corners. They are strong on the home page and auth pages (one corner there, plus the pool in the illustration panel) (lime at 45% and 25%, about 120px blur) and faint behind the signed-in shell (lime at 13% and 7%).

### Shadow Vocabulary

- **Live dot glow** (`box-shadow: 0 0 10px #c4f04a`): the Live state dot and other on-dots. It is a light, not a shadow.
- **Focus halo** (`box-shadow: 0 0 0 3px rgb(196 240 74 / 0.18)`): focused inputs, text areas, selects and search fields, with the border at lime 70%.
- **Toast drop** (`box-shadow: 0 20px 50px -20px rgb(0 0 0 / 0.9)`): toasts only, the one layer that floats over working content without a veil. It is dark, so it reads as lift, not light.
- **Dialog veil** (`::backdrop` ink at 72% with a 3px blur): behind every dialog. The dialog itself has no shadow; the veil does the separating.

### Named Rules

**The Glow Means On Rule.** The only component that glows is something that is on. Buttons and cards don't glow at rest.

**The Opaque Chrome Rule.** The app sidebar and drawer are opaque Sidebar Ink. Only the floating site header (white at 3.5%, medium blur) and the mobile app top bar are translucent.

## Shapes

Corners come in three steps. Controls are 9px (buttons, inputs, nav items, code wells, alerts). Panels and chrome are 16px (the floating site header, feature cards). Cards are 20px (app panels, the API key card, home page showcase and stat cards). Pills and dots are fully round. The Mark is a 14px lime square with 3px corners. On the home page, hairline rails, concentric faint arcs and lime cross-shaped sparkles add geometry around the hero.

In the app, panels and dialogs are 20px cards, and the smaller flag cards on the board are 16px. Switches, ID chips, the connected badge and avatars are fully round. Pieces that sit inside something else take their own small corners: the 5px checkbox, the 7px segment pill inside a 9px track, and the 11px empty-state icon tile.

**The Three Radii Rule.** Use 9px for controls, 16px for panels and 20px for cards. Other values are reference-page exceptions or nested pieces, not steps on the scale.

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
- **Shadow Strategy:** none.
- **Border:** 1px white at 6%.
- **Internal Padding:** 24px, or 32px from 640px.

### Panel

The working container of every signed-in screen.

- **Shape:** Card Ink, 20px, 1px white/6 edge, no shadow.
- **Title row:** optional. A 17px semibold Title Case title, a 14px white/55 description and actions on the right (stacked below 640px), ruled off by a white/6 hairline. Padding 16px by 20px, 24px across from 640px.
- **Body:** 20px padding, 24px from 640px.
- **Semantics:** a section labelled by its title, so each titled panel is a named region.
- **Delete panel:** an ordinary panel titled "Delete Flag" with a white/55 line on the consequence and a danger button. Flame lives only in the button. Admins only.

### Empty, Error and Loading States

- **Empty:** a 44px icon tile (white 7%, 11px corners) holding a 20px icon at 1.6 stroke in white/80, a 17px semibold Title Case title, a 15px white/55 explanation (max 46ch) and an optional action. Left-aligned on phones, centred from 640px, 32px vertical padding.
- **Error:** the same shape with a flame-wash tile and a flame alert icon, the title "Couldn't Load This", the server's message, and a secondary "Try again" button. Marked role="alert".
- **Loading:** pulsing skeleton blocks in white 5% at 9px corners, shaped like what is coming (48px rows, 118px flag cards), with a screen-reader-only status that names what is loading.

### Switch (signature)

The on/off control. Lime is on, so the switch is where lime lives most.

- **Size:** 40 by 24px with an 18px knob, or 54 by 32px with a 26px knob in a flag's status panel. 3px inset, fully round.
- **Off:** white 12% track (hover 18%), white knob.
- **On:** lime track, ink knob. The track colour changes over 200ms; the knob travels on the spring.
- **Semantics:** role="switch" with aria-checked, and a name that says what it does ("Turn new_checkout off"). Disabled is 50% opacity. A switch inside a link never navigates.

### Flag Card and Board

- **Card:** Card Ink, 16px, 1px white/6 edge, 16px padding. The 14px mono key is the link, and its hit area stretches over the whole card; the switch sits above it on the right. Below: a two-line 14px white/55 description (or "No description" in subtle italic), then the audience ("2 listed users") and a relative time at 13px subtle.
- **Hover / Focus:** the edge goes to white/12 and the fill to Raised Ink. Keyboard focus draws the lime outline around the whole card.
- **Move:** when a flag changes state it slides to its new column as a shared-layout move (240ms, base ease). Cards fade in on arrival.

### Segmented Control

One choice from a few options: the board filter, or Listed users and All users.

- **Track:** white 4% fill, 9px corners, 4px padding.
- **Items:** 36px tall, 14px medium, white/55 (hover white). The chosen item is white on a white 9% pill with 7px corners that slides between options over 240ms.
- **Semantics:** a radiogroup of radios with aria-checked.

**The Neutral Choice Rule.** A chosen option is white on a white 9% pill, never lime. Choosing a filter is not turning something on.

### Connected Badge (signature)

A 32px pill that says whether any app has a live stream open. With at least one: lime wash, lime/25 border, lime 13px medium text ("2 apps connected") and a lime dot with a ping that is hidden under reduced motion. With none: white 3% fill, white/8 border, muted text and a grey dot ("No apps connected").

### Chips: ID Chip

A listed end-user ID: 32px and fully round, white 4% fill, white/8 border, 13px mono white, with a 24px round remove button (subtle, hover white on white 8%) whose name includes the ID. Chips pop in and out from 94% scale over 160ms.

### Lists and Rows

Rows inside panels are split by white/5 hairlines with 16px vertical padding and no outer border. The name is 15px medium white (subtle when deactivated or revoked), the secondary line 13px subtle, and row actions are ghost buttons pulled flush to the edge. Team rows lead with a 36px round initials avatar (white 9%, 13px semibold). End-user rows say "Gets it" in lime with a glowing lime dot, or "Doesn't get it" in muted with a grey dot, with the reason underneath.

### Dialog

Built on the native `<dialog>`: the browser traps focus and makes the page inert, Escape and a click on the veil close it, and focus returns to the opener.

- **Shape:** Card Ink, 20px, 1px white/8 edge, 24px padding (28px from 640px). 460px wide, 560px for the key reveal.
- **Head:** a 22px bold Title Case title and a 36px ghost close button, with a 15px white/55 description below.
- **Arrival:** the dialog rises 8px from 98.5% scale and the veil fades, both over 240ms on the base ease. Reduced motion keeps only the fade.
- **Key reveal:** the new key sits in a 9px ink well as lime mono, beside a Copy button that turns to a lime check and "Copied". Done stays disabled, and the dialog will not close, until "I've stored this key somewhere safe" is ticked.

**The Name The Action Rule.** A destructive action is confirmed in a dialog whose danger button repeats the action ("Delete flag", never "OK") beside a secondary Cancel. The title names the thing ("Delete new_checkout?") and the body says what happens next.

### Toast

Confirms that a change happened. Raised Ink, 9px, white/8 edge, the toast drop shadow, 12px by 16px padding, 15px white text. Success leads with a lime check and errors with a flame alert icon. Toasts rise 10px over 240ms and leave after 3.5 seconds (6 for errors). The stack is a polite live region; errors are role="alert".

### Inputs / Fields

- **Style:** 44px tall, 9px radius, ink at 70% fill, 1px white/10 border (hover white/20), 14px padding, 15px text, subtle placeholder. The label above is 15px medium white, with an 8px gap to the input.
- **Focus:** the border turns lime at 70% with a 3px lime halo at 18%. The caret is lime.
- **Error:** flame/60 border, 13px flame error text, and aria-describedby links the message to the input. Hints are 13px subtle.
- **Checkbox:** 18px with 5px corners, ink fill and a white/20 border. When ticked it fills lime with an ink check.
- **Text area:** the same well, at least 96px tall, 10px by 14px padding, relaxed leading, resizable vertically.
- **Select:** the same well at 40px, with the native arrow removed and a 16px chevron drawn in white/55, 12px from the right.
- **Search:** the same well at 44px with a 16px subtle search icon 14px in. It is named by aria-label instead of a visible label.
- **ID entry:** fields that take IDs set their text in mono.

### Navigation

- **Sidebar:** Sidebar Ink with a white/6 right edge. The wordmark sits at the top (64px row). Group titles (Workspace, Admin or Platform) are 13px subtle. Items are 40px tall, 15px medium, white/60, with an 18px icon at white/45. Hover adds a white 5% fill.
- **Active item:** lime wash fill, white text, lime icon.
- **Footer block:** org name, then email and role, then Log out as a ghost row, above a hairline.
- **Mobile:** a translucent top bar with a menu button and the wordmark. The drawer slides in from the left with the base ease, focus moves into it, and Escape closes it.

### Site Header (signature)

A floating glass bar: 64px tall, 900px max, 16px radius, white/3.5% fill, white/5 border, medium backdrop blur. It holds the 20px bold wordmark with the lime Mark, nav links at 14px white/60, Sign in at white/70, and a white Get started button (9px, ink text) that turns lime on hover. It is the home page's only; auth pages show just the wordmark.

### Site Atmosphere (signature)

Two white/5 vertical rails at 17% from each edge, two concentric faint arcs (white/6 and white/4), two lime cross sparkles from 768px up, and lime glows in the lower corners. The auth pages do not use it (see Layout).

### Motion

One ease: cubic-bezier(0.16, 1, 0.3, 1). Durations are 160ms, 240ms and 420ms. Page content rises 6px. Hero and auth blocks rise 14px over 700ms, staggered by 80ms. A spring (stiffness 520, damping 38) is used only for things that settle, such as a toggle knob. Reduced motion keeps opacity and drops transforms. In the app, the switch knob springs; the segment pill slides and a flag card moves between columns over 240ms; ID chips pop over 160ms; dialogs rise 8px and toasts 10px over 240ms; and the connected dot pings while streams are open. The auth illustration: field lines fill over 250ms, the screen tint over 350ms, the error shake runs 450ms, the avatar bobs on a 3s loop and the drawing keeps its own SVG loops; under reduced motion the shake, bob and caret blink stop and the SVG loops are paused.

## The Demo App

`apps/demo-web` is outside this system on purpose (owner decision, 2026-10-26). It plays a FlagFlow customer, "Acme", so it has its own brand:

- Geist type.
- Warm paper #f6f4ef with white cards and deep teal #0f766e.
- In dark, #111315 with bright teal #2dd4bf.
- Radii of 10–16px.

Only its side panel is FlagFlow: ink, lime for on, Inter Tight, and Geist Mono for keys and IDs, matching the dashboard. Lime never appears in Acme, and Acme's teal never appears in FlagFlow. The panel's one signature is "the change lands": a changed flag row flashes lime once and the log gains a line. The flash is skipped under reduced motion. Its brief is `apps/demo-web/.impeccable/surfaces/apps-demo-web.md`.

## Do's and Don'ts

### Do:

- **Do** make the whole product match the home page: ink ground, near-black cards, lime as the only signal.
- **Do** use lime only for on, go and focus: the primary action, Live, the active nav item, focus, a ticked checkbox.
- **Do** show flag state through the state pill: Live lime, Testing iris with #a59cff text, Inactive grey, and always call off "Inactive".
- **Do** use flame (#ff5a24) for danger and errors only.
- **Do** set headlines in Inter Tight bold Title Case, tracked -0.04 to -0.055em, with reading text at white 55 to 60%.
- **Do** keep to three radii: 9px buttons, 16px panels, 20px cards.
- **Do** give every auth page the two-section layout: form left, the mirroring illustration right, no site header.
- **Do** keep a primary button neutral (white 6% fill, white 40% text) while it is disabled.
- **Do** use the switch for on and off: lime track and ink knob when on, white 12% track when off, the knob on the spring.
- **Do** put signed-in content in panels: 20px Card Ink with a 17px semibold title row on a white/6 hairline.
- **Do** confirm each change with a toast, and confirm destructive actions in a dialog whose danger button names the action.
- **Do** give every query an empty state, an error state with Try again, and a skeleton while it loads.
- **Do** show landing photographs in greyscale, and give every shipped raster a `.webp.json` provenance sidecar (the four home photos are free-license stock).

### Don't:

- **Don't** make anything lime that is not on, go or focus, including decoration, headings or section labels in the app.
- **Don't** use Geist Mono for headings, labels or decoration.
- **Don't** introduce a violet, indigo or other hue as an accent or atmosphere. Iris is Testing only.
- **Don't** make the app sidebar or drawer translucent.
- **Don't** add a lime glow to buttons or cards. A glow means something is on.
- **Don't** make a chosen segment, filter or tab lime. A choice is white on white 9%.
