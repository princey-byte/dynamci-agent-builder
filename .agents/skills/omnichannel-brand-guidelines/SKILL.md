---
name: omnichannel-brand-guidelines
description: Use when designing, styling, reviewing, or building frontend UI for Omnichannel, DMD, audience-builder micro frontends, dashboards, shells, cards, workflows, login pages, or brand-consistent React/Next.js screens.
---

# Omnichannel Brand Guidelines

## Overview

Use existing Omnichannel theme tokens first. Do not invent a new SaaS palette, font stack, logo treatment, or gradient language unless the user explicitly asks for a separate design system.

Source of truth: `omnichannel-ui-react/src/@core/theme/*`, `src/configs/*`, `src/components/layout/shared/Logo.tsx`, `public/images/*`, `tailwind.config.ts`, and `src/components/common/channelNodeConfig.ts`.

## When To Use

Use for:
- React/Next.js frontend pages, shells, cards, dashboards, forms, workflows, and micro frontends that should feel like Omnichannel.
- Brand review when colors, typography, logo usage, icon colors, shadows, or spacing are being chosen.
- Audience Builder or other route-level micro frontends that share auth/layout but may customize the content area.

Do not use for unrelated backends, CLI tools, or frontend work that the user explicitly wants to brand independently.

## Core Rule

Prefer runtime MUI variables and theme tokens:

```tsx
<Box sx={{ bgcolor: 'background.paper', color: 'text.primary', borderColor: 'divider' }} />
```

Avoid hard-coded colors unless documenting a brand token, channel accent, or static logo asset.

## Color Reference

| Role | Token/value | Usage |
| --- | --- | --- |
| Runtime primary | `#7367F0` | Default user-selected primary from `primaryColorConfig[0]`; use for active state, CTA, selected nav |
| Runtime primary light/dark | `#8F85F3` / `#675DD8` | Hover, soft accents when not using MUI `lighten/darken` |
| Core primary fallback | `#6366F1` | Base core theme, chart/workflow fallback, gradients |
| Primary gradient | `linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)` | Small accent badges/bars only, not full-card default backgrounds |
| Light background | `#FAFAFA` | App background |
| Light paper | `#FFFFFF` | Cards, nav, panels |
| Soft light | `#F8FAFC` | Subtle panels, grey-light surfaces |
| Dark background | `#0F172A` | Dark app background |
| Dark paper | `#1E293B` | Dark cards/nav |
| Secondary | `#64748B` | Neutral actions, muted icons |
| Success | `#10B981` | Positive states, success KPIs |
| Warning | `#F59E0B` | Caution, delay/trigger accents |
| Error | `#EF4444` | Destructive/error states |
| Info | `#06B6D4` | Informational state |

Selectable primary alternatives exist: teal `#0D9394`, amber `#FFAB1D`, rose `#EB3D63`, blue `#2092EC`. Use only when reading current settings or building the customizer.

## Typography

Use `Public Sans` from `next/font/google` with weights `300,400,500,600,700,800,900`.

Fallback stack:

```text
"Public Sans", sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif
```

Key sizes from `typography.ts`:

| Variant | Size | Weight | Line height |
| --- | --- | --- | --- |
| h1 | `2.875rem` | 500 | 1.47826 |
| h2 | `2.375rem` | 500 | 1.47368421 |
| h3 | `1.75rem` | 500 | 1.5 |
| h4 | `1.5rem` | 500 | 1.58334 |
| h5 | `1.125rem` | 500 | 1.5556 |
| h6 | `0.9375rem` | 500 | 1.46667 |
| body1 | `0.9375rem` | normal | 1.46667 |
| body2 | `0.8125rem` | normal | 1.53846154 |
| caption | `0.8125rem` | normal | 1.38462 |

`globals.css` sets `html { font-size: 84%; }` to align the rem scale with the template.

## Logo Usage

Active app shell logo:
- Image: `/images/favicon.ico`
- Render size: `32x32`
- Alt: `DMD Logo`
- Wordmark text: `Omnichannel`
- Text color: `var(--mui-palette-text-primary)` unless a dark/colored surface needs an explicit light color
- Text style: `1.375rem`, `font-weight: 700`, `line-height: 1.09091`, `letter-spacing: 0.25px`
- Gap: `12px` between mark and text

White brand asset:
- File: `/images/logo-white.svg`
- Use on dark or colored marketing/auth panels only.
- Do not place the white wordmark on white/light paper.
- Logo mark colors inside SVG: purple `#5D2BFF`, orange `#EF8E4B`, deep purple `#4922EF`, magenta `#AB27E2`; do not map these directly to UI state colors.

`/images/dmd_logo.png` exists but is not actively referenced in code. Do not use it unless the user specifically asks.

## Shape, Shadows, Layout

| Token | Value |
| --- | --- |
| Base radius | `6px` |
| Custom radii | xs `2`, sm `4`, md `6`, lg `8`, xl `10` |
| Tailwind 2xl | `0.75rem` |
| Light md shadow | `0px 4px 8px rgba(0,0,0,0.08)` |
| Light xl shadow | `0px 12px 24px rgba(0,0,0,0.12)` |

Default app cards are paper-like, white/minimal, with restrained shadows. Avoid oversized `24px` radii, glassmorphism, neon palettes, or full-card rainbow gradients.

## Channel and Workflow Accents

Use `src/components/common/channelNodeConfig.ts` for channel/workflow icon colors:
- Email/SMS/Push/Digest `#8b5cf6`
- In-app/Web notification `#6366f1`
- WhatsApp `#22c55e`
- Meta Ads `#3b82f6`
- Google Ads `#ea4335`
- Trigger/Action/Delay `#f59e0b`
- Decision/Condition `#0ea5e9`
- Default `#94a3b8`

Do not define channel colors locally.

## Micro Frontend Guidance

For route-level micro frontends such as `ui-auidence-builder`:
- Share auth/session and shell vocabulary with Omnichannel.
- Match shell/sidebar/navbar with Omnichannel tokens.
- The content area may use a separate builder-specific system, but it must document the boundary and keep auth, workspace, typography, and navigation legible.
- Use `#7367F0` as the default runtime primary unless consuming actual host settings.

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| Treating `#6366F1` as the only primary | Use `#7367F0` for default runtime primary; `#6366F1` is core fallback/workflow accent |
| Inventing generic blue/purple gradients | Use existing primary gradient only for restrained accents |
| Hard-coding colors in components | Use MUI `sx` palette tokens or CSS variables first |
| Using `logo-white.svg` on light surfaces | Use favicon mark + `Omnichannel` text for app shell |
| Guessing logo clear-space/min-size rules | State that formal logo rules are not present in repo; do not invent them |
| Recoloring channel icons ad hoc | Use `NODE_CHANNEL_CONFIG` |
| Introducing a separate micro-frontend design silently | Make shell shared and custom content boundary explicit |

## Source Files To Check

- `src/configs/primaryColorConfig.ts`
- `src/configs/themeConfig.ts`
- `src/@core/theme/colorSchemes.ts`
- `src/@core/theme/typography.ts`
- `src/@core/theme/customShadows.ts`
- `src/app/globals.css`
- `tailwind.config.ts`
- `src/@core/tailwind/plugin.ts`
- `src/components/layout/shared/Logo.tsx`
- `public/images/logo-white.svg`
- `src/components/common/channelNodeConfig.ts`
