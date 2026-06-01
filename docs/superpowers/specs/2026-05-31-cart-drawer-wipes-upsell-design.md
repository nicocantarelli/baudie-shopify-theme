# Cart-Drawer Wipes Upsell — Design

**Date:** 2026-05-31
**Status:** Approved design, pending implementation plan

## Goal

In the theme's custom side cart, upsell cotton wipes to any shopper whose cart
contains a non-wipe product. Two offers are shown together:

- **Single Cotton Wipes** — $8 (1-pack)
- **3 Pack Cotton Wipes** — $19 (3-pack)

Adding an offer drops it into the cart and refreshes the drawer using the
existing AJAX flow. Prices are the products' normal Shopify prices — no discount
logic.

## Context

This theme does **not** use the UpCart app. It has a fully custom cart drawer at
[sections/sidecart.liquid](../../../sections/sidecart.liquid) (~1,700 lines of
Liquid + scoped JS) with AJAX add-to-cart, a free-shipping progress bar, bundle
rendering, optimistic quantity updates, and stock warnings.

Switching to the UpCart app would discard all of that bespoke work and add a
monthly fee, so the upsell is built **natively into the existing drawer**.

Research into UpCart's own implementation (docs.aftersell.com) confirmed our
approach matches its proven patterns: in-cart only, hide-if-already-in-cart by
default, hide unavailable products, bottom placement below line items, a stacked
block layout for 1–2 offers, real product prices (no custom price injection), and
"Complete your order"-style copy. UpCart's carousel, rule-strategy engine, and
custom-price features are unnecessary for two fixed offers.

## Decisions

| Question | Decision |
|---|---|
| Build approach | Native into custom `sidecart.liquid` (not UpCart app) |
| Offers shown | Both 1-pack ($8) and 3-pack ($19) together |
| Offer products | Two `product` pickers in section settings |
| Exclusion ("except wipes") | A "Wipes" `collection` picker — suppress block when every cart item is in it |
| Pricing | Normal product prices, no discounts |
| Placement | Below line items, above the checkout button |
| Layout | Stacked block (no carousel) |
| Default heading | "Complete your order" |
| Checkout upsell | Out of code scope — written advisory only |

## Architecture

### 1. New snippet — `snippets/sidecart-upsell.liquid`

Renders the upsell block: heading + the two offer products as compact stacked
rows (image, title, price, Add button). Each Add is a minimal product
`<form action="{{ routes.cart_add_url }}">` carrying the variant `id`.

**No new JavaScript.** The drawer's existing `initAjaxAddToCart` handler already
intercepts any `/cart/add` form submit, adds the item, and re-renders the drawer
content. The upsell form rides that path for free.

Documented with a LiquidDoc (`{% doc %}`) header listing its params.

### 2. Visibility logic (server-rendered Liquid)

Recomputes on every drawer refresh because the snippet lives inside
`[data-sidecart-content]`, which `refreshFromServer()` already re-renders on
every cart change. No JS state to manage.

Rules, in order:

1. If the feature is disabled or the cart is empty → render nothing.
2. **Exclusion:** if **every** cart line item's product is in the Wipes
   collection → render nothing (don't upsell wipes to a wipes-only cart).
3. **Per-offer suppression** — hide an individual offer when:
   - that product is already in the cart, OR
   - the product/variant is unavailable (sold out with `deny` policy, draft, or
     no available variant).
4. If both offers end up hidden → the block does not render.

Collection membership is read via `line_item.product.collections` and the
configured exclude-collection handle.

### 3. Wire into `sections/sidecart.liquid`

Render the snippet inside `[data-sidecart-content]`, **after** the items list
(`[data-sidecart-items]`) and the empty-state block, **before** the
`[data-sidecart-footer]`. This places it below the line items and above the
subtotal/checkout button. Because it is inside the AJAX-refreshed content
region, it recomputes automatically on add/remove — no JS changes to the drawer.

### 4. Section settings (schema) + translations

New settings group on the `sidecart` section schema:

- `header` — "Upsell"
- `checkbox` `enable_upsell` (default `false`)
- `text` `upsell_heading` (default "Complete your order")
- `product` `upsell_product_1`
- `product` `upsell_product_2`
- `collection` `upsell_exclude_collection`

Translation keys added to `locales/en.default.json` (any user-facing strings)
and `locales/en.default.schema.json` (schema labels), following the existing
`sidecart.settings.*` hierarchy. Sentence case values.

### 5. Scoped CSS

Added to the section's existing `{% stylesheet %}` block, BEM-named
(`.sidecart-upsell__…`), reusing the drawer's `--sidecart-bg` / `--sidecart-text`
custom properties and existing font variables so it matches automatically. A
compact row layout (small thumbnail, title + price, Add button) that also works
in the mobile bottom-sheet.

### 6. Variant handling

Most wipe products are expected to be single-variant. Implementation adds the
product's first available variant. If a configured offer product turns out to
have multiple sellable variants, add a small variant `<select>` to that offer's
form; otherwise omit it. Decided per-product at render time.

## Out of scope

**In-checkout upsell.** Shopify's checkout cannot be modified from theme code.
An in-checkout upsell requires either Shopify Plus + Checkout UI Extensions, or a
dedicated app (e.g. Aftersell, ReConvert) configured in the Shopify admin.
UpCart itself is in-cart only and routes checkout upsells through the separate
Aftersell app, which is Plus-only. Deliverable here is a short written advisory
of the options and requirements — no theme code.

## Testing

- Cart with a non-wipe product → both offers visible below items, above checkout.
- Add the 1-pack → it appears as a line item; the 1-pack offer disappears; the
  3-pack offer remains; drawer refreshes without a page load.
- Cart containing only wipes → no upsell block.
- An offer product set to sold out (deny policy) → that offer hidden.
- Feature disabled in theme editor → no block.
- Mobile bottom-sheet → layout intact, checkout button still reachable.
- Empty cart → no block.

## Key wins

- No new JavaScript — reuses the proven AJAX add-to-cart path.
- No app, no monthly fee.
- Exact client rule ("any non-wipe cart → offer wipes").
- Fully editable in the theme editor (products + exclusion collection + copy).
- Recomputes correctly on every cart change via the existing refresh mechanism.
