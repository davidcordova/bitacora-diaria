---
name: Obsidian Cybernetic Core
colors:
  surface: '#12131a'
  surface-dim: '#12131a'
  surface-bright: '#383941'
  surface-container-lowest: '#0d0e15'
  surface-container-low: '#1a1b22'
  surface-container: '#1e1f27'
  surface-container-high: '#292931'
  surface-container-highest: '#34343c'
  on-surface: '#e3e1ec'
  on-surface-variant: '#b9cacb'
  inverse-surface: '#e3e1ec'
  inverse-on-surface: '#2f3038'
  outline: '#849495'
  outline-variant: '#3b494b'
  surface-tint: '#00dbe9'
  primary: '#dbfcff'
  on-primary: '#00363a'
  primary-container: '#00f0ff'
  on-primary-container: '#006970'
  inverse-primary: '#006970'
  secondary: '#ffb0cd'
  on-secondary: '#640039'
  secondary-container: '#aa0266'
  on-secondary-container: '#ffbad3'
  tertiary: '#faf3ff'
  on-tertiary: '#3c0091'
  tertiary-container: '#e1d2ff'
  on-tertiary-container: '#6d3bd7'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#7df4ff'
  primary-fixed-dim: '#00dbe9'
  on-primary-fixed: '#002022'
  on-primary-fixed-variant: '#004f54'
  secondary-fixed: '#ffd9e4'
  secondary-fixed-dim: '#ffb0cd'
  on-secondary-fixed: '#3e0022'
  on-secondary-fixed-variant: '#8c0053'
  tertiary-fixed: '#e9ddff'
  tertiary-fixed-dim: '#d0bcff'
  on-tertiary-fixed: '#23005c'
  on-tertiary-fixed-variant: '#5516be'
  background: '#12131a'
  on-background: '#e3e1ec'
  surface-variant: '#34343c'
typography:
  display-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.06em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.25rem
  gutter-lg: 1.5rem
  margin: 1.5rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
---

## Brand & Style

The design system establishes a high-performance, command-center dashboard experience tailored for modern operators, quantitative analysts, and enterprise platforms. It fuses dark cyberpunk futurism with the mathematical discipline of precision telemetry software. The visual tone is deeply immersive, high-velocity, and authoritative, evoking a sense of calm control over complex data.

Stylistically, the system balances **Tactile Glassmorphism** and **High-Tech Futurism**. Deep obsidian and midnight navy backdrops anchor the UI, while structural glass layering, hairline luminescent borders, and controlled neon bioluminescent accents (Electric Cyan, Vivid Magenta, and Radiant Indigo) guide attention without causing visual fatigue.

## Colors

The palette operates on pure chromatic contrast against light-absorbing obsidian foundations:

- **Foundation & Surfaces:**
  - Base Background: `#0B0C13` (canvas bedrock)
  - Card/Container Surface: `#13141F` (matte slate obsidian)
  - Floating/Elevated Panel: `#1B1C2A` (interactive glass surface)
  - Subtle Stroke: `rgba(255, 255, 255, 0.08)` to `rgba(0, 240, 255, 0.25)`

- **High-Voltage Accents:**
  - **Primary (Electric Cyan `#00F0FF`):** Used for primary metrics, real-time telemetry markers, positive trend vectors, and focal active states.
  - **Secondary (Vivid Magenta `#EC4899`):** Reserved for counter-trends, volume anomalies, high-priority notifications, and secondary data clusters.
  - **Tertiary (Radiant Indigo `#8B5CF6`):** Bridges the spectrum for multi-series graphs, system statuses, gradients, and secondary visual anchors.

- **Typography & Neutral Scales:**
  - Heading & Primary Data: `#FFFFFF`
  - Secondary Data / Labels: `#94A3B8`
  - Muted Inactive / Grids: `#475569`

## Typography

The type system prioritizes micro-legibility at small viewports while maintaining high-impact visual hierarchy for telemetry numbers. **Plus Jakarta Sans** provides geometric clarity with crisp apertures that remain razor-sharp over dark glowing backdrops.

Numbers within metric cards (`display-lg` and `display-xl`) utilize tabular figures to prevent layout shifting during real-time data streaming. Section and metric category labels leverage uppercase styling with positive letter-spacing (`label-md` and `label-sm`) to emulate avionics and control bridge displays.

## Layout & Spacing

The layout is built around an adaptive 12-column modular grid designed for dashboard consolidation.

- **Desktop (1200px+):** Fixed 260px vertical navigation sidebar paired with a fluid 12-column operational canvas. Gutters stay uniform at `1.5rem` (`gutter-lg`) to balance high information density without visual crowding.
- **Tablet (768px - 1199px):** Sidebar collapses to an icon rail (72px), charts adjust to 6 or 12 column spans, with gutters compressing to `1.25rem`.
- **Mobile (< 768px):** Collapses to a single-column stack with persistent bottom-dock navigation. Canvas margins reduce to `1rem` (`margin-mobile`), ensuring maximal chart horizontal resolution.

## Elevation & Depth

Depth is conveyed through luminous backlighting and multi-plane glass containers rather than generic drop shadows:

1. **Bedrock (Base Layer):** Pitch background `#0B0C13` with subtle atmospheric radial glows (`radial-gradient(ellipse at top right, rgba(139, 92, 246, 0.12), transparent 70%)`).
2. **Standard Surface (Cards & Telemetry Containers):** `#13141F` at 85% opacity with `backdrop-filter: blur(16px)`. Border is a precise 1px stroke using `rgba(255, 255, 255, 0.07)`.
3. **Elevated & Hovered Surfaces:** Shifts to `#1B1C2A` with an ambient glow tinted by the nearest accent: `0 10px 30px -10px rgba(0, 240, 255, 0.18)` and an active inner highlight rim.
4. **Spotlight Highlights:** Primary metric widgets can take full linear gradient fills (`linear-gradient(135deg, rgba(0, 240, 255, 0.85), rgba(99, 102, 241, 0.85))`) with overlaid dark contrast typography.

## Shapes

The design uses a refined rounded silhouette (`roundedness: 2`, base `0.5rem` / 8px). Metric cards and structural modules employ `rounded-xl` (16px to 24px) to soften the intense technical visual language.

Interactive badges, status indicators, and primary action buttons adopt fluid pill geometries (`rounded-full` / 9999px), providing an ergonomic contrast against the structured rectangular grid.

## Components

### Buttons & Call-to-Actions
- **Luminous Primary:** Solid Electric Cyan-to-Indigo gradient fill (`linear-gradient(135deg, #00F0FF, #6366F1)`), dark contrast text (`#0D0E15`), pill-shaped, with a dynamic glow shadow on hover (`box-shadow: 0 0 20px rgba(0, 240, 255, 0.4)`).
- **Secondary Ghost:** Translucent background (`rgba(255, 255, 255, 0.05)`), 1px border (`rgba(255, 255, 255, 0.15)`), white text. On hover, the border brightens to `#00F0FF` with an inner glow.

### Metric Cards & Key Performance Indicators
- Multi-layered glass cards featuring two distinct styles:
  1. **Neon Gradient Surface:** Full bleed energetic gradient for primary focus KPIs with high-contrast bold dark typography.
  2. **Obsidian Surface:** Dark card with soft hairline borders, glowing indicator icons in rounded badges, and vibrant large data values with small uppercase unit markers (`h`, `min`).

### Pills, Chips & Status Indicators
- Micro pill badges (`label-sm`) with 20% alpha backgrounds and 100% saturated borders and text (e.g., Magenta Alpha background with `#EC4899` text for `new` or `critical`).
- Live state beacons use concentric pulsing radial rings.

### Charts & Telemetry Visualizations
- Smooth cubic spline curves with semi-transparent vertical area fills (`rgba(0, 240, 255, 0.2)` fading to transparent at the baseline).
- Data points feature dual-ring tooltips with glowing neon centers.
- Circular donut charts employ rounded stroke caps with neon drop shadows to emphasize distinct status ratios.

### Form Inputs & Selectors
- Background filled with `#0D0E15`, bordered with `rgba(255, 255, 255, 0.1)`. Active focus states illuminate the full border in Electric Cyan `#00F0FF` with an exterior blur radius of 4px.