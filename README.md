# Baudie — Shopify theme

Custom Shopify theme for [Baudie](https://baudie.com).

Designed and built by Nicolas Cantarelli.

Designed around Baudie's Deodorant Enhancer® product line, with custom sections for the storefront, product pages, about/our-story, and a configurable password page used during private launch and on the legacy Bella Skin Beauty store.

## Quick start

### Prerequisites

- [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) (latest)
- Access to the Baudie Shopify store (ask the team for an invite)
- Recommended: [Shopify Liquid VS Code extension](https://shopify.dev/docs/storefronts/themes/tools/shopify-liquid-vscode) for syntax + linting

### Local dev

```bash
git clone git@github.com:nicocantarelli/baudie-shopify-theme.git
cd baudie-shopify-theme
shopify theme dev --store baudie-9825.myshopify.com
```

This boots a local server with hot reload pointed at your dev theme on Shopify. First run will prompt you to authenticate and select a theme.

The store's admin domain is `baudie-9825.myshopify.com` (`baudie.myshopify.com` is a different store and the CLI will refuse it). If the CLI isn't installed globally, prefix any command with `npx -y @shopify/cli@latest`, e.g. `npx -y @shopify/cli@latest theme check`.

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
├── sections/       # 46 sections + 3 section groups (header, footer, overlay) — the bulk of the work lives here
├── snippets/       # Reusable Liquid fragments (product-card, sidecart-item, purchase-options, css-variables, meta-tags, etc.)
└── templates/      # 27 JSON templates (+ gift_card.liquid) that compose sections into pages
```

### Key custom sections

| Section | Purpose |
|---|---|
| `hero-product.liquid` | Homepage hero with product CTA |
| `product.liquid` | Main PDP (individual scents + wipes): price, add to cart, subscription options, accordions, patent stamp, trust badges |
| `product-bundle.liquid` | Build-your-own Bundle of 3 — custom scent picker that adds a Simple Bundles parent product with the picked scents as line-item properties |
| `product-bundle-duo.liquid` | Duo bundle (one enhancer + fixed Cotton Dry Wipes), also via Simple Bundles |
| `landing-hero.liquid` | Campaign landing pages (menopause / postpartum) with their own add to cart |
| `sidecart.liquid` | The cart drawer — the only cart UI (`/cart` just reopens it via `cart-redirect.liquid`). Intercepts every product form submit and adds via AJAX |
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
- `product.json` — individual scents (default PDP)
- `product.bundle.json` / `product.bundle-duo.json` / `product.wipes.json` — bundle, duo and wipes PDPs
- `product.menopause.json` / `product.postpartum.json` — campaign landing pages (`landing-hero`)
- `collection.json` / `collection.bundles.json` / `collection.wipes.json` / `list-collections.json` — shop pages
- `page.our-story.json` / `page.contact.json` / `page.customer-care.json` / `page.affiliate.json` / `page.affiliate-terms.json` / `page.cancellation.json` / `page.for-men.json` / `page.privacy.json` / `page.terms.json`
- `cart.json` — renders `cart-redirect` only (opens the sidecart and sends the visitor back)
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

{% # 2. HTML markup %}
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

- Base styles for mobile, enhanced for desktop. Newer sections (product page, bundles, landing pages, how-to-use, about) use `@media (min-width: 1024px)`; older ones use `769px`, and many add `max-width` queries too — match the breakpoints of the file you're editing
- Use `clamp()` for fluid typography
- BEM modifiers: `.component--state` for state, `.component__element` for parts
- CSS custom properties for dynamic values via inline `style="--var: {{ setting }}"`

### Typography

Custom fonts live in [assets/](./assets). Reference via CSS variables defined in [snippets/css-variables.liquid](./snippets/css-variables.liquid):

- `--font-alyona` — display headings (Alyona Regular/Bold)
- `--font-jokker` — body copy (Jokker Regular/Semibold/Bold)
- `--font-sweet-sans` — buttons, prices, labels and small caps (Sweet Sans Pro Regular/Medium/Bold). Used uppercase with letter-spacing at −1% of the font size (e.g. `14px` / `-0.14px`)
- Also defined: `--font-manrope` (sidecart secondary text), `--font-byrd`, `--font-space-grotesk`

### Accessibility

- Semantic HTML (`<button>`, `<nav>`, `<section>`)
- ARIA on interactive components (`aria-expanded`, `aria-controls`)
- Custom Web Components for enhanced behavior over inline JS where possible

## Web components

The project favors lightweight custom elements over framework JS. Each lives inside a `{% javascript %}` block in the section or snippet that renders it. (Some older sections still use an inline `<script>` IIFE instead, e.g. `product.liquid` and `sidecart.liquid`.)

| Custom element | Defined in | What it does |
|---|---|---|
| `<meet-scents-section>` | [sections/meet-your-scents.liquid](./sections/meet-your-scents.liquid) | Scent picker — handles selection state, image swap, and active-card sync |
| `<related-products>` | [sections/related-products.liquid](./sections/related-products.liquid) | Related-products carousel/grid behavior |
| `<cookie-consent>` | [sections/cookie-banner.liquid](./sections/cookie-banner.liquid) | Cookie banner and consent preferences |
| `<notify-me-form>` | [snippets/notify-me-form.liquid](./snippets/notify-me-form.liquid) | Klaviyo back-in-stock signup shown instead of add to cart when sold out / coming soon |
| `<purchase-options>` | [snippets/purchase-options.liquid](./snippets/purchase-options.liquid) | One-time / Subscribe & save toggle (see **Subscriptions**) |
| `<select-menu>` | [snippets/select-menu.liquid](./snippets/select-menu.liquid) | Wraps a native `<select>` in a styled, accessible dropdown (combobox + listbox). The select stays the source of truth and fires `change`, so existing handlers keep working. The open list is `position: fixed` so scroll areas (sidecart) can't clip it, and flips upward when there's no room |

When adding new interactive components, follow the same pattern: define the class inside `{% javascript %}` (guarded with `if (!customElements.get(...))`), register with `customElements.define`, and tag the root element with the matching element name.

## Metafields

Custom product metafields used throughout the theme. All live under the `custom` namespace (`product.metafields.custom.*`). When migrating stores or duplicating products, these need to come along — see the matching definitions in Shopify admin → Settings → Custom data → Products.

### Image references

| Key | Purpose | Used in |
|---|---|---|
| `card_image` | Default product card image (landscape/wide) | [snippets/product-card.liquid](./snippets/product-card.liquid), `explore-sets`, `product-bundle` |
| `card_image_portrait` | Portrait variant of the card image | `product-card` |
| `card_hover_image` | Hover-state image swap on cards | `product-card`, `explore-sets` |
| `card_video` | Optional video on product cards | `product-card` |
| `meet_scents_image` | Hero image for the scent picker | `meet-your-scents` |
| `product_image` | Main PDP image (falls back to the featured image) | `product` |
| `hero_image` / `hero_secondary_image` | Homepage hero images for the featured product | `hero-product` |
| `how_to_use_image` / `how_to_use_video` | Media for the how-to-use section | `how-to-use` |

### Colors

| Key | Purpose |
|---|---|
| `product_card_background` | Card background color (defaults to `#FCF0D2`) |
| `card_background_color` | Background in `meet-your-scents` (defaults to `#FFCAD2`) |
| `hero_card_background_color` | Card background in `hero-product` (falls back to `card_background_color`) |
| `gradient_color_1` / `gradient_color_2` / `gradient_color_3` | PDP background gradient (`product`; the duo uses 1–2) |
| `product_text_color` | Text color override on PDP |
| `product_title_note_color` | Optional color for the supporting line below the PDP title; defaults to `product_text_color` |

### Copy + content

| Key | Purpose |
|---|---|
| `short_description` | Truncated product blurb for cards + scent picker |
| `bottle_size` | Bottle size string shown on PDP |
| `product_details` | Rich text — accordion content |
| `how_to_use` | Rich text — "How to use" accordion on the PDP |
| `scent_notes` | Rich text — scent breakdown |
| `key_ingredients` | Rich text — featured ingredients |
| `full_ingredient_list` | Rich text — full INCI list |
| `scent_name` | Display name for the scent picker (separate from product title) |
| `product_title_note` | Optional single-line supporting copy shown directly below the PDP title |

### Bundles

| Key | Purpose |
|---|---|
| `bundle_upsell_text` / `bundle_upsell_product` | PDP button linking a scent to a bundle (replaces the "Explore other scents" dropdown when both are set) |
| `bundle_companion` | Fixed bundle component (e.g. the duo's Cotton Dry Wipes) shown on the bundle's cart line, since Simple Bundles doesn't put it on the line itself |

### Upsell system

| Key | Purpose |
|---|---|
| `upsell_price` | Deal price for the side-cart / checkout upsell. A product carrying this metafield is an "upsell product"; the value is the price it drops to when the cart holds at least one regular product. |

The upsell is a three-part system sharing this metafield contract: the theme's [snippets/sidecart-upsell-item.liquid](./snippets/sidecart-upsell-item.liquid) (side-cart display), the [baudie-checkout-upsell](https://github.com/nicocantarelli/baudie-checkout-upsell) checkout UI extension (in-checkout offers), and the [baudie-discounts](https://github.com/nicocantarelli/baudie-discounts) Shopify Function (server-side price enforcement). The pricing rules must stay in sync across all three.

## Subscriptions (Appstle)

Subscribe & save runs on [Appstle Subscriptions](https://apps.shopify.com/subscriptions-by-appstle). Appstle owns everything after the purchase decision — billing, renewals, emails, payment retries and the customer portal. The theme only renders the purchase choice and shows subscription lines in the cart. Appstle's own storefront widget is **not** used (its app embed stays off) so there's never a second selector.

- **Managed in Appstle**, not in code — the "Subscribe & Save" plan defines which products are eligible (the individual scents), the delivery frequencies (every 1, 2 or 3 months), and the 15% discount. Any product added to a plan gets the selector automatically; labels and prices come from the plan's selling plans.
- **Product page** — [snippets/purchase-options.liquid](./snippets/purchase-options.liquid) (`<purchase-options>`), rendered by `product.liquid` above the price. A One-time | Subscribe toggle; Subscribe is preselected and `?selling_plan=<id>` preselects a frequency. The chosen plan id goes into a hidden `selling_plan` input tied to the product form with `form="…"`, which the sidecart's AJAX add already forwards. It also updates the main price (`data-purchase-price-for`). The delivery frequency uses the custom [select-menu](./snippets/select-menu.liquid) dropdown.
- **Theme editor** — Product section → **Subscriptions**: "Show subscription options" is the kill switch (hides the toggle so everything is one-time, without touching the Appstle plan), "Show savings badge" (the "Save 15%" tag, off by default), three optional perk lines, and **Subscription terms** — rich text shown under the toggle while Subscribe is selected, where `[price]` and `[frequency]` are swapped for the chosen plan's price and (lowercased) name. The "15% off every order" line is generated from the plan, so it can't drift from what checkout charges. Each template has its own copy of these settings (`product.json` for the scents, `product.wipes.json` for the wipes).
- **Cart** — [snippets/sidecart-item.liquid](./snippets/sidecart-item.liquid) strikes through the one-time price on subscription lines. Plan pricing isn't a discount (`original_line_price` already includes the 15%), so the strikethrough comes from `selling_plan_allocation.compare_at_price`. The `~sp<id>` suffix in the sidecart's line signature keeps subscription and one-time lines of the same scent separate.
- **Switching in the cart** — subscription lines show "↻ Subscription" over a purchase-option dropdown (One-time purchase / Subscribe & save X% → the plan's frequencies), like Salt & Stone's cart. One-time lines of plan products show "↻ Save X% with a subscription" over the same dropdown, but **only when Theme settings → Cart → "Let customers switch to a subscription in the cart" is on** (off by default, because products sit on the Appstle plan before launch). `changeFrequency()` in `sidecart.liquid` is optimistic: the label rolls, the arrows spin and the price/subtotal update instantly (`animatePurchaseOption()`), while a single `/cart/change.js` call per line (by line key, `selling_plan` = plan id, or `null` for one-time) saves in the background. Only merging two cards forces a full re-render; failures re-render from the real cart and show a toast.
- **Launch** — tick "Show subscription options" (product template) **and** the Cart setting above. Until then customers can't subscribe anywhere.
- **Customer portal** — the store uses new customer accounts; customers reach Appstle's portal through its "Manage Subscription Button" app embed (theme editor → Checkout and customer accounts).
- **No stacking** — the 15% must not combine with promo codes. Every Shopify discount code uses Purchase type **One-time purchase** (so a code only discounts the one-time items in a mixed cart), and Appstle's portal doesn't allow discount codes. Set that on any new code too. The upsell deal (`baudie-discounts`) skips subscription lines, so subscribed wipes get only the subscription price; upsells added from the cart or checkout are always one-time.
- **Wipes are ready but off** — Cotton Dry Wipes and the 3-pack use `product.wipes.json` (same `product` section), so adding them to an Appstle plan is all it takes to switch them on.
- **Not subscribable (yet)** — Discovery Set, Bundle of 3 and the duo / Scent Wipes Pack (Simple Bundles), and the menopause/postpartum landing pages (`landing-hero` has its own form without the selector). Before enabling bundles, check how Appstle renewals interact with Simple Bundles' cart transform and the picked-scent line properties.

## Deploy

Deployment is manual via **Shopify CLI** — this repo is *not* connected to the store through Shopify's GitHub integration. (It was until mid-2026; the `Update from Shopify …` commits in the history are from that era.)

### Workflow

```bash
shopify theme pull --store baudie-9825.myshopify.com   # 1. ALWAYS pull the live theme first
git diff                                                # 2. Review + commit editor changes it brought in
shopify theme dev --store baudie-9825.myshopify.com    # 3. Develop against a hot-reloading dev theme
shopify theme push --only <each file you changed>       # 4. Push only what you touched (see below)
git commit && git push                                  # 5. Keep the repo in sync manually
```

**Pull before you push — every time.** Theme-editor changes made by the merchant (text, settings, images, colors) live in `config/settings_data.json` and `templates/*.json` and no longer flow into git automatically. Pushing stale local copies of those files overwrites the merchant's work.

**Push only the files you changed.** The live theme is **Baudie Theme** (`shopify theme list --store baudie-9825.myshopify.com` shows its id). Pushing to it needs `--allow-live`; `--nodelete` makes sure nothing on the store is removed:

```bash
shopify theme push --store baudie-9825.myshopify.com --theme <live theme id> --allow-live --nodelete \
  --only sections/product.liquid \
  --only snippets/purchase-options.liquid
```

Before pushing, pull those same files into a scratch folder (`shopify theme pull --path /tmp/live --only …`) and diff them against git — locale files and sections can also be edited in the admin. If you do push the whole theme instead, at least exclude the merchant-owned files:

```bash
shopify theme push --ignore "config/settings_data.json" --ignore "templates/*.json"
```

### Testing without touching live

Push to an unpublished theme and preview it there:

```bash
shopify theme push --unpublished --theme "Preview — feature name"
```

Publish from the admin (or `shopify theme publish`) once verified.

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

### Merchant editor changes are missing from the repo

Expected — since the GitHub integration was removed, theme-editor changes exist only in the store until someone runs `shopify theme pull` and commits the result. Do that at the start of every working session (see **Deploy → Workflow**).

### A new schema setting isn't showing up in the editor

Schema changes only take effect after Shopify re-validates the section. If a setting doesn't show:

1. Hard-refresh the theme editor
2. Check the section's `{% schema %}` JSON for syntax errors (`shopify theme check` will catch most — note the repo has some pre-existing offenses, so look at the files you touched)
3. Existing template JSON files in `/templates/` may have stale data — settings with new IDs will pick up defaults; renamed IDs become orphans

### Mobile renders desktop styles (or vice versa)

Sections don't share one breakpoint — newer ones switch to desktop at `@media (min-width: 1024px)`, older ones at `769px`, and many also use `max-width` queries. If styles aren't applying:

1. Check you're using the same breakpoint (and direction) as the rest of that file
2. Confirm there's no later rule overriding due to specificity (`.section--full .section__heading` beats `.section__heading`)

## Notes

- **Section settings** — when adding new schema settings, defaults will populate on the next admin load, but existing template JSON files in `/templates/` may have stale settings cached. Edit them in the theme editor or update the JSON directly.
- **Password page** — has two modes (`password` form vs `link` redirect) controlled by a section setting. Used identically on Baudie (during private launch) and on the legacy Bella Skin Beauty store (set to link mode, redirecting to baudie.com).

## License

Base theme code under Shopify's theme license — see [LICENSE.md](./LICENSE.md). Theme customizations by Nicolas Cantarelli; Baudie branding, content, and imagery belong to Baudie.
