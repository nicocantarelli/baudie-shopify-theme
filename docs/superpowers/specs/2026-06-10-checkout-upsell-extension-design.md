# Checkout Upsell Extension — Design

**Date:** 2026-06-10
**Status:** Approved (pending spec review)
**Owner:** lumiosdigital

## Summary

Build a bespoke in-checkout upsell for the Baudie Plus store: a **Checkout UI
Extension** that renders offer card(s) inside the checkout page (default offer:
the wipes) and lets the customer add the product before paying. It reuses the
existing discount machinery — it adds no new pricing logic.

The extension lives in a **new, separate custom app** (`baudie-checkout-upsell`).
It does **not** modify the existing `baudie-discounts` app; it depends on that
app's automatic discount to apply the real price reduction in checkout.

## Background: existing pieces this builds on

Two existing pieces define the behavior the checkout upsell must match:

1. **Sidecart upsell (theme)** — `snippets/sidecart-upsell.liquid` and
   `snippets/sidecart-upsell-item.liquid` in `baudie-theme`. These render offer
   cards in the cart drawer: product image, title, the discounted
   `custom.upsell_price` as the current price, and the regular `variant.price`
   struck through as compare-at. Offers hide when already in cart, unavailable,
   or `coming-soon` tagged; the whole region hides when the cart holds only
   excluded ("wipes") products. Settings expose: enabled, heading, up to two
   offer products, and an exclude-collection.

2. **Discount engine (`baudie-discounts` app)** — a Shopify Function
   (`extensions/discount-function/src/cart_lines_discounts_generate_run.js`) that
   discounts **any** product carrying a `custom.upsell_price` metafield down to
   that price (per-item, any quantity), **only when the cart also contains at
   least one non-upsell "qualifier" product**. `custom.upsell_price` is a decimal
   in dollars (e.g. `8`, `19`). This is a native automatic discount, so it
   **applies inside checkout automatically**.

Because the customer in checkout always has real qualifier products in the cart,
adding the wipes triggers the existing discount with no new pricing code. The
checkout extension only displays the price and adds the line.

## Goals

- Show a configurable upsell offer inside checkout (default: the wipes).
- Match the sidecart's look, eligibility rules, and pricing display.
- Reuse the existing automatic discount for the real reduction.
- Give the merchant flexibility via checkout-editor settings (approach A).

## Non-goals

- No changes to `baudie-discounts` or its function.
- No new discount/pricing logic (Shopify Function, draft orders, etc.).
- No post-purchase or thank-you-page upsell (in-checkout only).
- No theme changes (the sidecart upsell is unaffected).

## Architecture

### Project

- New standalone app `baudie-checkout-upsell/`, sibling to `baudie-theme` and
  `baudie-discounts`, with its own `shopify.app.toml` / client_id, installed
  unlisted on the Plus store. Its own git repo.
- Toolchain mirrors `baudie-discounts`: Shopify CLI, npm workspaces
  (`extensions/*`), vitest.
- Holds a single `checkout-ui-extension`.

### Extension target

- `purchase.checkout.block.render` — a placeable block the merchant positions
  anywhere in the checkout editor (maximum location flexibility), rather than a
  hard-pinned target.

### Components (each independently testable)

- **Qualifier helper** (pure function): given the cart-line products' upsell
  prices, returns whether the cart contains ≥1 "qualifier" (a product with no
  `custom.upsell_price`). Mirrors the discount function's gate exactly.
  Unit-tested.
- **Eligibility helper** (pure function): given the cart lines + an offer's
  fetched data, returns whether that offer should render (not already in cart,
  available, not `coming-soon`). Unit-tested.
- **Price-display helper** (pure function): given `variant.price` and
  `custom.upsell_price`, returns `{ currentPrice, compareAtPrice | null }`.
  Mirrors `sidecart-upsell-item.liquid` logic. Unit-tested.
- **Data layer**:
  - Cart qualifier detection: declare `custom.upsell_price` in the extension
    TOML and read it on cart-line products via `useAppMetafields`.
  - Offer data: query the in-checkout **Storefront API** (`query` from the
    extension API) for each configured offer *variant* — price,
    `availableForSale`, image, product title, product tags (coming-soon), and
    `metafield(custom, upsell_price)`.
- **Render component**: the offer card(s) UI + heading, using checkout UI
  components, styled to read consistently with checkout and the sidecart card.
- **Add action**: `applyCartLinesChange` add-line on button click; surfaces
  success/error via checkout UI state.

### Data flow (per render)

1. Read live cart lines from checkout APIs.
2. Read merchant settings (enabled, heading, offer variants).
3. Detect qualifier presence from cart-line product metafields
   (`useAppMetafields`). If no qualifier, render nothing.
4. For each configured offer variant, fetch data via the Storefront API `query`.
5. Run eligibility + price-display helpers.
6. Render eligible cards; hide the block if no eligible offers.
7. On "Add", apply the cart-line change; the existing automatic discount reduces
   the line price in checkout.

### Merchant settings (checkout editor — approach A)

Checkout settings support only `variant_reference` among reference types (no
product or collection references), so offers are configured per-variant and the
"excluded-only" guard is replaced by the metafield-based qualifier rule above:

- `enabled` (boolean)
- `heading` (single_line_text_field)
- `offer_variant_1`, `offer_variant_2` (`variant_reference`; default
  `offer_variant_1` = the wipes variant)

The qualifier rule (cart must contain a non-upsell product) reproduces the
sidecart's exclude-collection intent without a collection setting, and stays
perfectly aligned with the discount function.

## Error handling

- Storefront query failure or missing product → render nothing for that offer
  (fail closed; never block checkout).
- `applyCartLinesChange` failure → show an inline error on the card; cart
  unchanged.
- Missing/blank `custom.upsell_price` → show the regular price with no
  compare-at (matches sidecart fallback).

## Testing

- **Vitest** for the eligibility and price-display helpers, with fixtures
  mirroring the discount function's cases (upsell-deal, wipes-only,
  no-qualifier, already-in-cart, coming-soon).
- **Manual** verification in a real checkout via `shopify app dev`: card renders,
  "Add" inserts the line, and the automatic discount actually reduces the price.

## Risks / validation checkpoints

Resolved during design research (Shopify docs, 2026-06-10):

- **Settings field types** — only `variant_reference` is supported among
  reference types; no product/collection references. Design updated: offers are
  variant references; the exclude-collection guard is replaced by the
  metafield-based qualifier rule.
- **Metafield access in checkout** — cart-line product metafields are read by
  declaring `custom.upsell_price` in the extension TOML and using
  `useAppMetafields`; arbitrary offer-variant data comes from the Storefront API
  `query`.

Still verified during implementation, not assumed:

1. **Discount re-evaluation** — confirm the automatic discount re-applies to a
   line added by the extension (expected; verify in a real checkout via
   `shopify app dev`).
2. **Storefront `query` shape** — confirm the exact field path for a variant's
   product metafield and image in the current API version against the generated
   scaffold before wiring the data layer.

## Rollout

- Build and test against the development store via `shopify app dev`.
- `shopify app deploy` to register the extension, then enable + place the block
  in the checkout editor and configure the offer (wipes).
- The sidecart and `baudie-discounts` app are untouched throughout.
