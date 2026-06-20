# Affiliate / Influencer Program landing page — Design

**Date:** 2026-06-20
**Status:** Approved (pending spec review)

## Goal

Build a branded **affiliate-program** landing page for Baudie that recruits affiliates/influencers
into **Social Snowball** ("Snowball"). The page should follow the content structure of the Primally
Pure influencer-program page and the visual style of the Baudie about-us (`/pages/about-us`,
template `page.our-story.json`) page. The Snowball signup is captured via Snowball's supported embed
(iframe or theme app block) — **not** a custom-built form.

## Key constraints (researched)

- Snowball exposes **no public API** for creating affiliates. Supported capture methods are its
  **iframe embed** and its **theme app block** only.
- The Snowball form is **cross-origin**, so its fields cannot be restyled with our CSS/fonts. We
  achieve brand cohesion by framing the embed in an on-brand container whose background blends with
  Snowball's form background.
- The embed code is **store-specific** and lives in the client's Snowball dashboard; we cannot
  retrieve it. The section must accept it via the theme editor.

## Brand reference (from about-us)

- Deep plum background `#3e2027`, white text `#ffffff`.
- Display headings: serif `var(--font-alyona)`, large `clamp(48px, 8vw, 96px)`, weight 400.
- Eyebrows/body: sans `var(--font-jokker)`, ~12px eyebrow weight 500.
- Generous vertical spacing, botanical/lifestyle photography, minimal buttons.

## Page composition

Assembled via a new page template that wires existing sections plus one new section. Mirrors how
`page.our-story.json` composes `about-hero`, `about-philosophy`, etc.

| # | Content | Section | New? |
|---|---------|---------|------|
| 1 | Hero (plum bg, serif headline, intro, CTA to form) | `about-hero` | reuse |
| 2 | Perks / benefits (commission %, cookie window, free product, early access, support) | `about-philosophy` (pillar blocks) | reuse |
| 3 | Who we are (brand narrative + image) | `image-text-block` (image left) | reuse |
| 4 | Who you are (ideal affiliate + image) | `image-text-block` (image right) | reuse |
| 5 | How it works (3 numbered steps: Apply → Share → Earn) | `about-philosophy` (pillar blocks) | reuse |
| 6 | Signup (branded heading/intro + Snowball embed) | `affiliate-signup` | **NEW** |
| 7 | FAQ (accordion) | `product-faq` | reuse |

## New section: `affiliate-signup`

Single new component. Follows project structure order: liquid logic → HTML → `{% stylesheet %}` →
`{% javascript %}` (optional) → `{% schema %}`. Documented with a `{% doc %}`-style header where
applicable; all user-facing strings use translation keys.

### Settings
- `heading` — text
- `intro` — richtext
- `embed_code` — `liquid`/HTML field for the pasted Snowball iframe code
- `min_height` — range (px), iframe fallback height
- `max_width` — select (standard / wide / full), to match `image-text-block` width options
- `background_color` — color (default `#3e2027`)
- `text_color` — color (default `#ffffff`)

### Blocks
- `{ "type": "@app" }` — allows Snowball's **theme app block** to be dropped into the signup slot as
  an alternative to pasting the iframe.

### Behavior
- Render order in the signup body:
  1. If `embed_code` is present → render it.
  2. Render any app blocks (`{% content_for 'blocks' %}` / `{%- for block in section.blocks -%}` with
     `{% render block %}`) so a Snowball app block also appears.
  3. If neither is configured → render a placeholder note (translated) with setup instructions, shown
     only in the theme editor context where practical.
- Centered, on-brand container: constrained `max_width`, padding, `background_color`/`text_color`,
  serif heading + sans intro consistent with about-us.
- Wrapper background set to blend with the Snowball form so the embed reads as one seamless block.
- Optional tiny `{% javascript %}`: listen for Snowball's height `postMessage` (if any) and auto-fit
  the iframe; fall back to `min_height` when no message is received. Implemented defensively (origin
  check, no-op if no iframe present). Nice-to-have — page must work without it.

### Accessibility
- Section wrapped in semantic `<section>`; heading is a real heading element.
- Embed/iframe carries a `title` attribute where we control the markup.

## Plumbing

- **`templates/page.affiliate.json`** — wires sections 1–7 with sensible defaults and brand colors
  (`#3e2027` / `#ffffff`), placeholder copy for each block. Template suffix → "affiliate".
- **`locales/en.default.json`** — add `sections.affiliate_signup.*` keys (name, settings labels,
  blocks, placeholder/help text). Follow existing hierarchical key conventions.
- Client steps (documented, not code): create a Shopify page at `/pages/affiliate-program`, assign
  the "affiliate" template, then either paste the Snowball iframe into the signup section or add the
  Snowball app block there.

## Out of scope

- Custom-built signup form or Snowball API wiring (chose supported embed path).
- Restyling inside the Snowball form (cross-origin — not possible).
- Unrelated refactors of existing sections. If an existing section needs a minor setting to support
  reuse (e.g. an anchor id for the hero CTA target), add it minimally and only as needed.

## Minor change to existing section: `about-hero`

`about-hero` currently has **no** button/link setting (verified). To support the hero CTA that
scrolls to the form, add a minimal, **optional, backwards-compatible** pair of settings:
- `button_label` — text (optional)
- `button_link` — url (optional; default `#affiliate-signup`)

Rendered only when `button_label` is present, using the theme's existing button styling. The
`affiliate-signup` section gets a stable anchor id (`affiliate-signup`) as the scroll target. No
other behavior of `about-hero` changes; existing usages (the about-us page) are unaffected because
the button renders only when configured.
