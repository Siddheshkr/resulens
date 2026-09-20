# ResuLens Interface System

Last reviewed: 2026-09-10

This document is the visual source of truth for ResuLens. It adapts the supplied
Framer design analysis to a resume-intelligence product; it is a reference, not
an instruction to reproduce Framer's brand or layout.

## Design idea

ResuLens should feel like a precise reading instrument: a quiet black workspace,
high-contrast typography, document-like structure, and a small number of vivid
analysis surfaces. The memorable element is the **lens field**—a violet-to-coral
panel that frames a resume and its evidence-backed match. Color represents active
analysis, never general decoration.

The brand mark is a blue resume, profile, and lens glyph. Use the supplied
transparent artwork in product navigation and authentication entry points; keep it
small and let the surrounding interface remain monochrome.

The interface is dark-only. It should feel confident and editorial, not like a
collection of generic SaaS cards.

## Tokens

### Color

| Token          | Value     | Role                                         |
| -------------- | --------- | -------------------------------------------- |
| Canvas         | `#090909` | Page and navigation background               |
| Surface        | `#141414` | Primary cards and controls                   |
| Surface raised | `#1c1c1c` | Selected and emphasized surfaces             |
| Ink            | `#ffffff` | Primary text and primary actions             |
| Muted ink      | `#9b9b9b` | Supporting copy and metadata                 |
| Hairline       | `#292929` | Borders and document rules                   |
| Signal blue    | `#0099ff` | Links, focus, selection, and live state only |
| Violet         | `#6a4cf5` | Lens-field anchor                            |
| Coral          | `#ff5577` | Lens-field energy and processing state       |
| Success        | `#45d483` | Confirmed and approved state                 |
| Danger         | `#ff6b6b` | Destructive and failed state                 |

White and black are the anchors. Signal blue is never a broad background or
primary button fill. Violet and coral appear together only in one analysis panel
per viewport.

### Type

- Display: `Inter Variable`, system fallback, weight 600. Use tight tracking and
  compact line height so headlines behave like a poster.
- Interface and body: `Inter Variable`, system fallback, weight 400–600, with
  `cv05`, `cv11`, and tabular numerals enabled.
- Code/data: the system monospace stack, only for structured JSON and identifiers.
- Display sizes use `clamp()` and stay between 32 and 104 pixels. Body lines stay
  below roughly 76 characters.
- Use sentence case. Small labels describe useful state; they are not decorative
  all-caps eyebrows.

### Shape and spacing

- 5px rhythm, expressed through 10, 15, 20, 30, 40, and 100px.
- Controls and CTAs are pills with at least a 44px touch target.
- Form fields use 10px corners; product cards use 20px; the lens field uses 30px.
- Default content width is 1200px with 20px mobile and 30px desktop gutters.
- Elevation comes from surface steps and a fine top edge, not large soft shadows.

## Layout

Public landing page:

```text
┌────────────────────────────────────────────────────────────┐
│ ResuLens       Product navigation          Account actions │
├────────────────────────────────────────────────────────────┤
│ Large, left-aligned promise                                │
│ focused copy + actions                                     │
│                                                            │
│                    ┌────── lens field ───────────────────┐ │
│                    │ resume evidence  →  ranked role     │ │
│                    └──────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────┤
│ Upload              Review             Match               │
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

Use a single column below 810px. Keep all essential navigation visible without
requiring a hover interaction. Align product copy left; center only deliberate
empty states.

## Component rules

- **Primary button:** white pill, black label. It names the exact action.
- **Secondary button:** charcoal pill, white label. No outlined ghost-button grid.
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
- **Account menu:** use an opaque charcoal surface with a compact profile row,
  Settings, account security, and sign-out. Keep the menu visually native to the
  product shell; do not repeat workspace navigation or use a translucent provider
  popover.

## Motion and accessibility

- One short lens-field reveal may run on page load. Interaction feedback may use
  transforms and opacity only.
- Do not use `transition: all`. Respect `prefers-reduced-motion` globally.
- Keep a visible skip link and logical heading hierarchy.
- Icon-only controls need accessible names; decorative icons are hidden from
  assistive technology.
- Maintain visible keyboard focus and 44px touch targets.
- Set `color-scheme: dark` and a canvas-matching browser theme color.
- Loading, success, and error changes use text and appropriate live regions.

## Content voice

Use direct, calm language. Explain what ResuLens knows, what it inferred, and what
is still unknown. Never call a score an ATS score or a hiring probability. Empty
and failure states should always tell the user what to do next.

## Review checklist

- Does the page have one clear primary task?
- Is the lens field the only atmospheric color surface in its viewport?
- Do surface levels communicate hierarchy without excessive borders or shadows?
- Are controls keyboard accessible, labelled, and at least 44px tall?
- Do mobile layouts keep the primary action and navigation reachable?
- Are long filenames, job titles, and provider content safely constrained?
- Are animation, focus, dark controls, empty states, and destructive actions safe?
