# ResuLens Interface System

Last reviewed: 2026-09-20

This document is the visual source of truth for ResuLens. It adapts the supplied
Framer design analysis to a resume-intelligence product; it is a reference, not
an instruction to reproduce Framer's brand or layout.

## Design idea

ResuLens should feel like a precise reading instrument: a quiet, focused workspace,
high-contrast typography, document-like structure, and a small number of vivid
analysis cues. The public page uses transparent, tactile 3D assets to show a
resume being read, aligned, and kept private without presenting a fabricated
product screen or placing imagery inside opaque rectangles. Signal blue
represents active analysis, never general decoration.

The brand mark is a dimensional ivory “R” with a restrained lens detail inside a
signal-blue rounded tile. Use the transparent PNG in product navigation,
authentication, footer, and browser icon surfaces; keep it compact and pair it
with the ResuLens wordmark where space allows.

The interface supports Light, Dark, and System. System is the default; explicit
choices persist locally and synchronize between tabs. The account menu contains
the three appearance options beside Settings and sign-out; visitors can change
appearance from the header. It should feel confident and editorial, not like a
collection of generic SaaS cards. Semantic tokens in `src/app/themes.css` are the
implementation source of truth for both palettes.

## Tokens

### Color

| Token          | Light     | Dark      | Role                     |
| -------------- | --------- | --------- | ------------------------ |
| Canvas         | `#f8f9fc` | `#090909` | Page background          |
| Surface        | `#ffffff` | `#141619` | Cards and controls       |
| Surface raised | `#edf0f5` | `#20242a` | Selected surfaces        |
| Ink            | `#17212f` | `#f4f6fa` | Primary text and actions |
| Muted ink      | `#596477` | `#a2abb8` | Supporting copy          |
| Hairline       | `#dce1e9` | `#2a3038` | Borders                  |
| Signal blue    | `#0869c6` | `#55adff` | Links, focus, selection  |
| Success        | `#167346` | `#6cdaa0` | Confirmed state          |
| Danger         | `#bd303c` | `#ff858b` | Destructive/error state  |

White and black are the anchors. Signal blue is never a broad background or
primary button fill. Violet and coral remain secondary to the blue analysis signal.

### Type

- Primary UI and headings: `Inter Variable`, then `Inter`, `ui-sans-serif`,
  `system-ui`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, and
  `sans-serif`. Use weights 300, 400, 510, and 590 where the surface calls for
  light, regular, medium, or strong emphasis.
- OpenType features: `cv01`, `ss03`, and `zero` are enabled for the primary UI
  typeface.
- Code/data: `Berkeley Mono`, then `JetBrains Mono`, `IBM Plex Mono`, and the
  system monospace stack, only for structured JSON and technical metadata.
- Landing titles scale from 44px on mobile to 77px on wide screens; section
  headings stay between 32px and 50px. Body copy is 16–17px with generous leading.
  Keep existing font fallbacks; no remote font dependency is required.
- Use sentence case. Small labels describe useful state; they are not decorative
  all-caps eyebrows.

### Shape and spacing

- 5px rhythm, expressed through 10, 15, 20, 30, 40, and 100px.
- Product controls retain pills; landing CTAs use restrained 11px corners. Keep at least a 44px touch target.
- Form fields use 10px corners; product cards use 20px; landing imagery uses 16px.
- Default content width is 1200px with 20px mobile and 30px desktop gutters.
- Elevation comes from surface steps and a fine top edge, not large soft shadows.
- The sticky navigation is a rounded floating capsule. Its translucent surface
  gains stronger blur, border definition, and a restrained shadow after scrolling.
  Preserve the full two-row navigation on narrow screens.
- The page scrollbar uses a slim rounded thumb with no visible track. It follows
  the active palette and becomes clearer on hover without using the brand accent.

## Layout

Public landing page:

```text
┌────────────────────────────────────────────────────────────┐
│ ResuLens       Product navigation          Account actions │
├────────────────────────────────────────────────────────────┤
│ Concise promise + actions │ editorial resume scan visual    │
├────────────────────────────────────────────────────────────┤
│ Private PDF  │ Review first │ Explainable │ Delete anytime │
├────────────────────────────────────────────────────────────┤
│ Upload / Review / Discover as three open process columns   │
├────────────────────────────────────────────────────────────┤
│ Explainable fit and gaps │ transparent alignment image     │
├────────────────────────────────────────────────────────────┤
│ Privacy promise │ transparent private document image      │
├────────────────────────────────────────────────────────────┤
│ Practical FAQ │ final invitation │ navigation footer       │
└────────────────────────────────────────────────────────────┘
```

Authenticated workspace:

```text
┌────────────────────────────────────────────────────────────┐
│ Route title and status                         Main action │
├──────────────────────────────┬─────────────────────────────┤
│ Primary task                 │ Context / history / status  │
│ Upload, filters, or details  │ Compact document rows       │
└──────────────────────────────┴─────────────────────────────┘
```

Use a single landing column below 768px. Keep all essential navigation visible without
requiring a hover interaction. Align product copy left; center only deliberate
empty states.

## Component rules

- **Primary button:** foreground fill, canvas-colored label, inverted with the theme. It names the exact action.
- **Secondary button:** raised surface with foreground label. No outlined ghost-button grid.
- **Text link:** signal blue for inline navigation; neutral text in top navigation.
- **Input:** surface background, hairline edge, blue `:focus-visible` ring, explicit
  label, name, autocomplete intent, and useful error adjacent to the field.
- **Document row:** filename is primary; page/date/status form a compact metadata
  line. Long names truncate without shifting status.
- **Status:** pair text with a dot or shape. Never communicate state by color alone.
- **Match score:** label it “ResuLens match score,” use tabular numerals, and show
  the signal breakdown. Unknown and confirmed conflict remain separate.
- **Empty state:** state why it is empty and name the next valid action.
- **Destructive action:** require confirmation or a recoverable undo period.
- **Clerk UI:** use the same surface, type, pills, focus blue, and error semantics as
  native ResuLens forms.
- **Account menu:** use an opaque theme-aware surface with a compact profile row,
  Settings, account security, Light/Dark/System appearance, and sign-out. Keep the menu visually native to the
  product shell; do not repeat workspace navigation or use a translucent provider
  popover.

## Motion and accessibility

- The landing hero uses one staged text entrance and one image entrance. Each
  major lower section may reveal once as a single composed block; do not animate
  every card, line, or decorative detail independently.
- Route continuity stays at 200ms. High-frequency hover, focus, and press feedback
  stays at 120ms or less, with button press scale fixed at `0.96`.
- Interaction motion uses transforms and opacity. State changes always retain a
  static text, icon, color, or focus cue.
- Do not use `transition: all`. Respect `prefers-reduced-motion` globally.
- Keep a visible skip link and logical heading hierarchy.
- Icon-only controls need accessible names; decorative icons are hidden from
  assistive technology.
- Maintain visible keyboard focus and 44px touch targets.
- Resolve `color-scheme` and browser theme color from the active palette. Restore
  saved appearance before paint and react to device changes while in System mode.
- Loading, success, and error changes use text and appropriate live regions.

## Content voice

Use direct, calm language. Explain what ResuLens knows, what it inferred, and what
is still unknown. Never call a score an ATS score or a hiring probability. Empty
and failure states should always tell the user what to do next.

## Review checklist

- Does the page have one clear primary task?
- Does each landing image communicate a distinct product idea without imitating a dashboard?
- Do surface levels communicate hierarchy without excessive borders or shadows?
- Are controls keyboard accessible, labelled, and at least 44px tall?
- Do mobile layouts keep the primary action and navigation reachable?
- Are long filenames, job titles, and provider content safely constrained?
- Are animation, focus, both palettes, empty states, and destructive actions safe?
