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

- **Eligibility helper** (pure function): given a cart line set + an offer's
  product data, returns whether the offer should render (not in cart, available,
  not coming-soon) and whether the whole block should render (cart has a
  qualifier / is not excluded-only). Mirrors sidecart rules. Unit-tested.
- **Price-display helper** (pure function): given `variant.price` and
  `custom.upsell_price`, returns `{ currentPrice, compareAtPrice | null }`.
  Mirrors `sidecart-upsell-item.liquid` logic. Unit-tested.
- **Data layer**: queries the Storefront API (available in-checkout) for each
  offer product — variant price, `availableForSale`, image, title, tags (for
  coming-soon), and `metafield(custom, upsell_price)`.
- **Render component**: the offer card(s) UI + heading, using checkout UI
  components, styled to read consistently with checkout and the sidecart card.
- **Add action**: `applyCartLinesChange` add-line on button click; surfaces
  success/error via checkout UI state.

### Data flow (per render)

1. Read live cart lines from checkout APIs.
2. Read merchant settings (enabled, heading, offer products, exclude collection).
3. For each offer, fetch product data via Storefront API.
4. Run eligibility + price-display helpers.
5. Render eligible cards; hide block if no eligible offers or cart is
   excluded-only.
6. On "Add", apply the cart-line change; the existing automatic discount reduces
   the line price in checkout.

### Merchant settings (checkout editor — approach A)

- `enabled` (boolean)
- `heading` (text)
- `offer_product_1`, `offer_product_2` (product references; default offer_1 = wipes)
- `exclude_collection` (collection reference)

Mirrors the sidecart snippet's params one-to-one.

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

These are verified during implementation, not assumed:

1. **Checkout settings field types** — confirm checkout-editor settings support
   product and collection references. If not, fall back to variant references or
   a metafield-driven config, keeping the same behavior.
2. **Discount re-evaluation** — confirm the automatic discount re-applies to a
   line added by the extension (expected; verify in a real checkout).
3. **Metafield access in checkout** — confirm `custom.upsell_price` is readable
   via the in-checkout Storefront API query (vs. needing a metafield declaration
   in the extension TOML).

## Rollout

- Build and test against the development store via `shopify app dev`.
- `shopify app deploy` to register the extension, then enable + place the block
  in the checkout editor and configure the offer (wipes).
- The sidecart and `baudie-discounts` app are untouched throughout.
