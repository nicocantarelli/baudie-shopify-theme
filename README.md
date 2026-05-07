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

## Deploy

This repo is connected to the production Shopify store via Shopify's GitHub integration. **Pushes to `main` automatically sync to the live theme** — there is no separate deploy step.

That means:

- Commits land in the theme almost immediately
- Edits made in the Shopify theme editor will create commits on `main` (look for `Update from Shopify for theme baudie-shopify-theme/main` in the log)
- Always pull before starting work to avoid clobbering merchant edits

For testing changes without going live, push to a separate branch and connect it to a non-production theme via Shopify admin → Online Store → Themes.

## Notes

- **Section settings** — when adding new schema settings, defaults will populate on the next admin load, but existing template JSON files in `/templates/` may have stale settings cached. Edit them in the theme editor or update the JSON directly.
- **Password page** — has two modes (`password` form vs `link` redirect) controlled by a section setting. Used identically on Baudie (during private launch) and on the legacy Bella Skin Beauty store (set to link mode, redirecting to baudie.com).
- **Web components** — the project favors lightweight custom elements over framework JS. Keep behavior local to the section via `{% javascript %}` when possible.

## License

Proprietary — Lumios Digital + Baudie. See [LICENSE.md](./LICENSE.md).
