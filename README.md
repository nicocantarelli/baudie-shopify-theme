# Baudie — Shopify theme

Custom Shopify theme for [Baudie](https://baudie.com), built and maintained by [Lumios Digital](https://lumios.digital).

Designed around Baudie's Deodorant Enhancer® product line, with custom sections for the storefront, product pages, about/our-story, and a configurable password page used during private launch and on the legacy Bella Skin Beauty store.

## Quick start

### Prerequisites

- [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) (latest)
- Access to the Baudie Shopify store (ask the team for an invite)
- Recommended: [Shopify Liquid VS Code extension](https://shopify.dev/docs/storefronts/themes/tools/shopify-liquid-vscode) for syntax + linting

### Local dev

```bash
git clone git@github.com:lumiosdigital/baudie-shopify-theme.git
cd baudie-shopify-theme
shopify theme dev --store baudie.myshopify.com
```

This boots a local server with hot reload pointed at your dev theme on Shopify. First run will prompt you to authenticate and select a theme.

### Useful commands

```bash
shopify theme pull         # pull latest from a remote theme
shopify theme push         # push local to a remote theme
shopify theme list         # list themes on the connected store
shopify theme check        # lint Liquid + theme structure
```

## Architecture

Standard Shopify theme structure — see [shopify.dev/docs/storefronts/themes/architecture](https://shopify.dev/docs/storefronts/themes/architecture) for full reference.

```
.
├── assets/         # Fonts, critical.css, JS, static images
├── blocks/         # Reusable theme blocks (group, text)
├── config/         # Global theme settings + data
├── layout/         # theme.liquid, password.liquid
├── locales/        # Translations + schema translations
├── sections/       # 40 sections — the bulk of the work lives here
├── snippets/       # Reusable Liquid fragments (css-variables, meta-tags, prelude, etc.)
└── templates/      # JSON templates that compose sections into pages
```

### Key custom sections

| Section | Purpose |
|---|---|
| `hero-product.liquid` | Homepage hero with product CTA |
| `product-bundle.liquid` | Bundle product template (variants + pricing logic) |
| `product-details.liquid` / `-features.liquid` / `-faq.liquid` / `-benefits.liquid` | PDP composition |
| `meet-your-scents.liquid` | Scent showcase with media |
| `what-makes-different.liquid` | Pillar grid |
| `explore-sets.liquid` | Set/bundle showcase with editable badges |
| `image-text-block.liquid` | Flexible image + copy section, supports full-bleed and standard widths |
| `about-hero.liquid` / `about-philosophy.liquid` / `about-mission.liquid` / `about-partnerships.liquid` | Our Story page composition |
| `password.liquid` | Dual-mode password page (form to unlock OR link redirect) — used on Baudie during private launch and on the legacy Bella Skin Beauty store |

### Templates

Custom JSON templates live in [templates/](./templates):

- `index.json` — homepage
- `product.json` / `product.bundle.json` / `product.wipes.json` — PDPs (product-type-specific)
- `page.our-story.json` / `page.contact.json` / `page.customer-care.json` / `page.privacy.json` / `page.terms.json`
- `password.json` — coming-soon / private gate

## Conventions

Follow these patterns. They're enforced informally — match the surrounding code.

### File + class naming

- **Liquid files**: kebab-case (`image-text-block.liquid`, `about-hero.liquid`)
- **CSS classes**: BEM (`image-text-block__heading--mobile-top`)
- **Liquid variables**: snake_case (`has_content`, `image_position`)
- **Settings IDs**: snake_case with prefixes (`prelude_heading_text_size`, `image_aspect_ratio`)
- **Translation keys**: hierarchical, max 3 levels (`t:sections.about_hero.name`)

### Section structure

```liquid
{%- liquid
  # 1. Logic block at top — assigns, defaults
-%}

{# 2. HTML markup #}
<section class="component-name full-width" style="--var: ...">
  ...
</section>

{% stylesheet %}
  /* 3. Scoped CSS using BEM + custom properties */
{% endstylesheet %}

{% javascript %}
  /* 4. Optional JS (for non-trivial behavior, prefer web components) */
{% endjavascript %}

{% schema %}
{
  /* 5. Schema at bottom */
}
{% endschema %}
```

### Full-width sections

Shopify wraps every section in a 3-column grid (`[margin][content][margin]`) defined in [assets/critical.css](./assets/critical.css). By default, sections render in the middle column with capped width.

To make a section span the full viewport, add the `full-width` class to its root element:

```liquid
<section class="my-section full-width">
```

This is required for hero-style sections, full-bleed image-text blocks, and the password page.

### Translations

All user-facing strings go through `{{ 'key' | t }}`. Add new strings to:

- [locales/en.default.json](./locales/en.default.json) — storefront-facing strings
- [locales/en.default.schema.json](./locales/en.default.schema.json) — theme editor labels (when using `t:` in schema)

Sentence case (only proper nouns capitalized).

### CSS

- Mobile-first — base styles for mobile, `@media (min-width: 769px)` to enhance for desktop
- Use `clamp()` for fluid typography
- BEM modifiers: `.component--state` for state, `.component__element` for parts
- CSS custom properties for dynamic values via inline `style="--var: {{ setting }}"`

### Typography

Custom fonts live in [assets/](./assets). Reference via CSS variables defined in [snippets/css-variables.liquid](./snippets/css-variables.liquid):

- `--font-alyona` — display headings (Alyona Regular/Bold)
- `--font-jokker` — body copy (Jokker Regular/Semibold/Bold)
- `--font-sweet-sans` — buttons + small caps (Sweet Sans Pro Medium/Bold)

### Accessibility

- Semantic HTML (`<button>`, `<nav>`, `<section>`)
- ARIA on interactive components (`aria-expanded`, `aria-controls`)
- Custom Web Components for enhanced behavior over inline JS where possible

### Animations

Driven by data attributes — see existing `data-animate-elements-on-scroll` and `data-animate-delay="125"` usage in sections like `about-hero` and `meet-your-scents`.

## Web components

The project favors lightweight custom elements scoped per-section over framework JS. Each lives inside a `{% javascript %}` block in its parent section file.

| Custom element | Defined in | What it does |
|---|---|---|
| `<meet-scents-section>` | [sections/meet-your-scents.liquid](./sections/meet-your-scents.liquid) | Scent picker — handles selection state, image swap, and active-card sync |
| `<related-products>` | [sections/related-products.liquid](./sections/related-products.liquid) | Related-products carousel/grid behavior |

When adding new interactive sections, follow the same pattern: define the class inside `{% javascript %}`, register with `customElements.define`, and tag the section root with the matching element name.

## Metafields

Custom product metafields used throughout the theme. All live under the `custom` namespace (`product.metafields.custom.*`). When migrating stores or duplicating products, these need to come along — see the matching definitions in Shopify admin → Settings → Custom data → Products.

### Image references

| Key | Purpose | Used in |
|---|---|---|
| `card_image` | Default product card image (landscape/wide) | [snippets/product-card.liquid](./snippets/product-card.liquid), `explore-sets`, `product-bundle` |
| `card_image_portrait` | Portrait variant of the card image | `product-card` |
| `card_hover_image` | Hover-state image swap on cards | `product-card`, `explore-sets` |
| `meet_scents_image` | Hero image for the scent picker | `meet-your-scents` |

### Colors

| Key | Purpose |
|---|---|
| `product_card_background` | Card background color (defaults to `#FCF0D2`) |
| `card_background_color` | Background in `meet-your-scents` (defaults to `#FFCAD2`) |
| `product_text_color` | Text color override on PDP |

### Copy + content

| Key | Purpose |
|---|---|
| `short_description` | Truncated product blurb for cards + scent picker |
| `bottle_size` | Bottle size string shown on PDP |
| `product_details` | Rich text — accordion content |
| `scent_notes` | Rich text — scent breakdown |
| `key_ingredients` | Rich text — featured ingredients |
| `full_ingredient_list` | Rich text — full INCI list |
| `scent_name` | Display name for the scent picker (separate from product title) |

## Deploy

This repo is connected to the production Shopify store via Shopify's GitHub integration. **Pushes to `main` automatically sync to the live theme** — there is no separate deploy step.

### Branch strategy

Currently the project uses a **single-branch (`main` only)** workflow. This works because the team is small and the scope is contained, but it has tradeoffs:

- **Pro**: simple, no merge dance, theme editor edits land in version control immediately
- **Con**: every commit goes live; no preview environment isolated from production

If you need to test substantial changes without exposing them to customers:

1. Create a feature branch (`feat/some-change`)
2. In Shopify admin → **Online Store → Themes**, duplicate the live theme into an unpublished "Preview" theme
3. Connect the feature branch to that preview theme via the GitHub integration (Shopify admin → Theme actions → Connect to GitHub)
4. Push to the feature branch to test in isolation
5. Merge to `main` when ready, which auto-deploys to live

When this happens often enough to be annoying, formalize a `staging` branch wired to a permanent preview theme.

### Theme editor commits

Edits made in the Shopify admin theme editor are auto-committed to `main` by Shopify (look for `Update from Shopify for theme baudie-shopify-theme/main` in the git log). **Always pull before starting work** to avoid clobbering merchant edits:

```bash
git pull --rebase
```

## Runbook

Common gotchas and where to look first.

### Horizontal scroll on a section

Likely cause: a section is using `width: 100vw` instead of the `full-width` class. `100vw` includes the scrollbar width and overflows the viewport.

**Fix**: remove `width: 100vw` from the section's CSS, add `full-width` to the section's root class list. See [assets/critical.css](./assets/critical.css) for the underlying grid pattern (`.shopify-section > .full-width { grid-column: 1 / -1; }`).

### Section background not reaching the screen edges

Cause: missing `full-width` class — the section is rendering inside the constrained middle column of the section grid, so the body background (theme setting, currently `#FCE9EC`) shows on either side.

**Fix**: add `full-width` to the section's root.

### Browser tab shows " – Baudie" with empty prefix

Cause: the page has no `page_title` and the `<title>` template appended " – Baudie" anyway.

**Fix**: already handled in [snippets/meta-tags.liquid](./snippets/meta-tags.liquid) — falls back to `shop.name` when `page_title` is blank. If this regresses, check that snippet.

### Centering a hero or banner looks "off"

Cause: asymmetric padding (e.g., `padding: 120px 24px 40px`). Even though the flex container is centering, the asymmetric padding shifts the visual center.

**Fix**: equalize top/bottom padding when the section relies on flex centering.

### Theme editor edits appear as commits on `main`

This is expected — Shopify's GitHub integration auto-commits theme editor changes. They show up as `Update from Shopify for theme baudie-shopify-theme/main`. Don't force-push over them; pull first.

### A new schema setting isn't showing up in the editor

Schema changes only take effect after Shopify re-validates the section. If a setting doesn't show:

1. Hard-refresh the theme editor
2. Check the section's `{% schema %}` JSON for syntax errors (`shopify theme check` will catch most)
3. Existing template JSON files in `/templates/` may have stale data — settings with new IDs will pick up defaults; renamed IDs become orphans

### Mobile renders desktop styles (or vice versa)

The breakpoint convention is **mobile-first** with `@media (min-width: 769px)` to enhance for desktop. If styles aren't applying:

1. Check the breakpoint direction matches the section convention
2. Confirm there's no later rule overriding due to specificity (`.section--full .section__heading` beats `.section__heading`)

## Notes

- **Section settings** — when adding new schema settings, defaults will populate on the next admin load, but existing template JSON files in `/templates/` may have stale settings cached. Edit them in the theme editor or update the JSON directly.
- **Password page** — has two modes (`password` form vs `link` redirect) controlled by a section setting. Used identically on Baudie (during private launch) and on the legacy Bella Skin Beauty store (set to link mode, redirecting to baudie.com).

## License

Proprietary — Lumios Digital + Baudie. See [LICENSE.md](./LICENSE.md).
