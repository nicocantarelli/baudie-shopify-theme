# Checkout Upsell Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build a custom Shopify Checkout UI Extension (new `baudie-checkout-upsell` app) that shows a configurable in-checkout upsell (default: the wipes), reusing the existing `baudie-discounts` automatic discount for pricing.

**Architecture:** A standalone unlisted app holding one `checkout-ui-extension` on the `purchase.checkout.block.render` target. Pure helper functions (qualifier / eligibility / price-display) are unit-tested with vitest; the React component reads cart lines + settings, detects a discount "qualifier" via declared `custom.upsell_price` metafields (`useAppMetafields`), fetches offer-variant data via the Storefront `query`, renders offer cards, and adds the line with `applyCartLinesChange`. The existing automatic Buy-X-Get-Y discount applies the real reduction in checkout.

**Tech Stack:** Shopify CLI, `@shopify/ui-extensions-react/checkout`, JavaScript/JSX, vitest, npm workspaces.

**Reference files (read-only, in sibling repos):**
- `baudie-discounts/extensions/discount-function/src/cart_lines_discounts_generate_run.js` — the qualifier + deal-price rule to mirror.
- `baudie-theme/snippets/sidecart-upsell-item.liquid` — the price-display logic (`upsell_price` ×100, compare-at when lower) to mirror.

**Project location:** `/Users/nicolascantarelli/Developer/lumios-digital/baudie-checkout-upsell` (sibling to `baudie-theme` and `baudie-discounts`).

---

## Task 1: Scaffold the app and extension

**Files:**
- Create: the `baudie-checkout-upsell/` app project (CLI-generated)
- Create: `extensions/checkout-upsell/` extension (CLI-generated)

- [x] **Step 1: Create the app project**

Run from `/Users/nicolascantarelli/Developer/lumios-digital`:

```bash
shopify app init --name baudie-checkout-upsell
```

Choose: build from scratch / "none" template (extension-only app, like `baudie-discounts`). When prompted, connect to the same Partner org and the Baudie Plus dev store used by `baudie-discounts`.

- [x] **Step 2: Generate the checkout UI extension**

Run from `baudie-checkout-upsell/`:

```bash
shopify app generate extension --template checkout_ui --name checkout-upsell
```

This creates `extensions/checkout-upsell/` with `shopify.extension.toml`, `src/`, `package.json`, `locales/`.

- [x] **Step 3: Inspect the generated entry file and record the API surface**

Open the generated `extensions/checkout-upsell/src/` entry (e.g. `Checkout.jsx`). Note the exact import path and hook names this CLI version generates (`reactExtension`, `useApi`, `useCartLines`, `useApplyCartLinesChange`, `useSettings`, `useAppMetafields`, `Banner`, `BlockStack`, `InlineLayout`, `Image`, `Text`, `Button`). These exact names are reused in Tasks 4–5; if any differ in this version, use the generated names.

- [x] **Step 4: Add vitest to the extension**

Run from `extensions/checkout-upsell/`:

```bash
npm install -D vitest
```

Edit `extensions/checkout-upsell/package.json` to add a test script:

```json
"scripts": {
  "test": "vitest run"
}
```

- [x] **Step 5: Commit**

```bash
cd /Users/nicolascantarelli/Developer/lumios-digital/baudie-checkout-upsell
git add -A
git commit -m "Scaffold checkout-upsell app and extension"
```

---

## Task 2: Configure the extension TOML

**Files:**
- Modify: `extensions/checkout-upsell/shopify.extension.toml`

- [x] **Step 1: Set the target, settings, and declared metafield**

Replace the generated `[[extensions.targeting]]`, `[extensions.settings]`, and metafield blocks so the file contains (keep the generated `api_version`, `name`, `type`, `handle`, `uid` values already present):

```toml
[[extensions.targeting]]
target = "purchase.checkout.block.render"

[extensions.targeting.default_placement]
# Default position; merchant can move the block in the checkout editor.
order_summary = true

[[extensions.metafields]]
namespace = "custom"
key = "upsell_price"

[extensions.settings]

  [[extensions.settings.fields]]
  key = "enabled"
  type = "boolean"
  name = "Enable upsell"

  [[extensions.settings.fields]]
  key = "heading"
  type = "single_line_text_field"
  name = "Heading"

  [[extensions.settings.fields]]
  key = "offer_variant_1"
  type = "variant_reference"
  name = "Offer 1 variant (default: wipes)"

  [[extensions.settings.fields]]
  key = "offer_variant_2"
  type = "variant_reference"
  name = "Offer 2 variant (optional)"
```

If `default_placement` syntax is rejected by `shopify app build` for this API version, remove that block (placement is then chosen entirely in the editor) and continue.

- [x] **Step 2: Verify the config builds**

Run from `baudie-checkout-upsell/`:

```bash
shopify app build
```

Expected: build succeeds with no TOML schema errors.

- [x] **Step 3: Commit**

```bash
git add extensions/checkout-upsell/shopify.extension.toml
git commit -m "Configure checkout-upsell target, settings, and metafield"
```

---

## Task 3: Pure helper functions (TDD)

**Files:**
- Create: `extensions/checkout-upsell/src/lib/upsell.js`
- Test: `extensions/checkout-upsell/src/lib/upsell.test.js`

- [x] **Step 1: Write the failing tests**

Create `extensions/checkout-upsell/src/lib/upsell.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  hasQualifier,
  isComingSoon,
  computePriceDisplay,
  isOfferEligible,
} from './upsell.js';

describe('hasQualifier', () => {
  it('true when a cart product has no upsell price', () => {
    expect(hasQualifier([{ upsellPrice: null }, { upsellPrice: 19 }])).toBe(true);
  });
  it('false when every cart product is an upsell product', () => {
    expect(hasQualifier([{ upsellPrice: 8 }, { upsellPrice: 19 }])).toBe(false);
  });
  it('false for an empty cart', () => {
    expect(hasQualifier([])).toBe(false);
  });
});

describe('isComingSoon', () => {
  it('matches common spellings', () => {
    expect(isComingSoon(['coming-soon'])).toBe(true);
    expect(isComingSoon(['Coming Soon'])).toBe(true);
  });
  it('false when absent', () => {
    expect(isComingSoon(['bestseller'])).toBe(false);
    expect(isComingSoon([])).toBe(false);
  });
});

describe('computePriceDisplay', () => {
  it('shows upsell price as current with compare-at when lower', () => {
    expect(computePriceDisplay({ variantPriceCents: 2400, upsellPrice: 19 }))
      .toEqual({ currentCents: 1900, compareAtCents: 2400 });
  });
  it('no compare-at when upsell price is not lower', () => {
    expect(computePriceDisplay({ variantPriceCents: 1900, upsellPrice: 19 }))
      .toEqual({ currentCents: 1900, compareAtCents: null });
  });
  it('falls back to variant price when no upsell price', () => {
    expect(computePriceDisplay({ variantPriceCents: 2400, upsellPrice: null }))
      .toEqual({ currentCents: 2400, compareAtCents: null });
  });
});

describe('isOfferEligible', () => {
  const offer = { productId: 'gid://shopify/Product/1', available: true, comingSoon: false };
  it('eligible when available, not coming soon, not in cart', () => {
    expect(isOfferEligible(offer, [])).toBe(true);
  });
  it('not eligible when already in cart', () => {
    expect(isOfferEligible(offer, ['gid://shopify/Product/1'])).toBe(false);
  });
  it('not eligible when unavailable', () => {
    expect(isOfferEligible({ ...offer, available: false }, [])).toBe(false);
  });
  it('not eligible when coming soon', () => {
    expect(isOfferEligible({ ...offer, comingSoon: true }, [])).toBe(false);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run from `extensions/checkout-upsell/`:

```bash
npm test
```

Expected: FAIL — `Cannot find module './upsell.js'`.

- [x] **Step 3: Write the implementation**

Create `extensions/checkout-upsell/src/lib/upsell.js`:

```js
const COMING_SOON_TAGS = ['coming-soon', 'Coming soon', 'coming soon', 'Coming Soon'];

// A "qualifier" is any cart product without an upsell price — the discount
// function only applies its deal when the cart holds at least one of these.
export function hasQualifier(cartProducts) {
  return cartProducts.some((p) => p.upsellPrice == null);
}

export function isComingSoon(tags) {
  return tags.some((tag) => COMING_SOON_TAGS.includes(tag));
}

// Mirrors snippets/sidecart-upsell-item.liquid: upsell_price (dollars) is the
// shown price; the regular variant price is struck through only when higher.
export function computePriceDisplay({ variantPriceCents, upsellPrice }) {
  if (upsellPrice == null) {
    return { currentCents: variantPriceCents, compareAtCents: null };
  }
  const currentCents = Math.round(upsellPrice * 100);
  const compareAtCents = currentCents < variantPriceCents ? variantPriceCents : null;
  return { currentCents, compareAtCents };
}

export function isOfferEligible(offer, cartProductIds) {
  return offer.available && !offer.comingSoon && !cartProductIds.includes(offer.productId);
}
```

- [x] **Step 4: Run tests to verify they pass**

Run from `extensions/checkout-upsell/`:

```bash
npm test
```

Expected: PASS — all 4 suites green.

- [x] **Step 5: Commit**

```bash
git add extensions/checkout-upsell/src/lib/upsell.js extensions/checkout-upsell/src/lib/upsell.test.js
git commit -m "Add upsell helper functions with tests"
```

---

## Task 4: Storefront query + offer-data mapping

**Files:**
- Create: `extensions/checkout-upsell/src/lib/offers.js`
- Test: `extensions/checkout-upsell/src/lib/offers.test.js`

- [x] **Step 1: Write the failing test for the mapper**

Create `extensions/checkout-upsell/src/lib/offers.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { OFFER_QUERY, mapVariantNode } from './offers.js';

describe('OFFER_QUERY', () => {
  it('requests the fields the card needs', () => {
    for (const field of ['price', 'availableForSale', 'image', 'metafield', 'tags']) {
      expect(OFFER_QUERY).toContain(field);
    }
  });
});

describe('mapVariantNode', () => {
  it('maps a Storefront variant node to offer data', () => {
    const node = {
      id: 'gid://shopify/ProductVariant/10',
      availableForSale: true,
      price: { amount: '24.0', currencyCode: 'USD' },
      image: { url: 'https://cdn/x.png' },
      product: {
        id: 'gid://shopify/Product/1',
        title: 'Wipes',
        tags: ['bestseller'],
        metafield: { value: '19.0' },
      },
    };
    expect(mapVariantNode(node)).toEqual({
      variantId: 'gid://shopify/ProductVariant/10',
      productId: 'gid://shopify/Product/1',
      title: 'Wipes',
      available: true,
      comingSoon: false,
      imageUrl: 'https://cdn/x.png',
      variantPriceCents: 2400,
      upsellPrice: 19,
    });
  });
  it('returns null for a missing node', () => {
    expect(mapVariantNode(null)).toBe(null);
  });
  it('treats a blank metafield as no upsell price', () => {
    const node = {
      id: 'gid://shopify/ProductVariant/10',
      availableForSale: false,
      price: { amount: '8.0', currencyCode: 'USD' },
      image: null,
      product: { id: 'gid://shopify/Product/2', title: 'X', tags: ['coming-soon'], metafield: null },
    };
    expect(mapVariantNode(node)).toEqual({
      variantId: 'gid://shopify/ProductVariant/10',
      productId: 'gid://shopify/Product/2',
      title: 'X',
      available: false,
      comingSoon: true,
      imageUrl: null,
      variantPriceCents: 800,
      upsellPrice: null,
    });
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run from `extensions/checkout-upsell/`:

```bash
npm test src/lib/offers.test.js
```

Expected: FAIL — `Cannot find module './offers.js'`.

- [x] **Step 3: Write the implementation**

Create `extensions/checkout-upsell/src/lib/offers.js`:

```js
import { isComingSoon } from './upsell.js';

// Storefront API query: fetch offer variants by id with the fields the card needs.
export const OFFER_QUERY = `
  query OfferVariants($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        availableForSale
        price { amount currencyCode }
        image { url }
        product {
          id
          title
          tags
          metafield(namespace: "custom", key: "upsell_price") { value }
        }
      }
    }
  }
`;

function toCents(amount) {
  return Math.round(parseFloat(amount) * 100);
}

function parseUpsellPrice(metafield) {
  if (!metafield || metafield.value == null || metafield.value === '') return null;
  const v = parseFloat(metafield.value);
  return v > 0 ? v : null;
}

export function mapVariantNode(node) {
  if (!node || !node.product) return null;
  return {
    variantId: node.id,
    productId: node.product.id,
    title: node.product.title,
    available: Boolean(node.availableForSale),
    comingSoon: isComingSoon(node.product.tags || []),
    imageUrl: node.image?.url ?? null,
    variantPriceCents: toCents(node.price.amount),
    upsellPrice: parseUpsellPrice(node.product.metafield),
  };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run from `extensions/checkout-upsell/`:

```bash
npm test
```

Expected: PASS — `offers.test.js` and `upsell.test.js` all green.

- [x] **Step 5: Commit**

```bash
git add extensions/checkout-upsell/src/lib/offers.js extensions/checkout-upsell/src/lib/offers.test.js
git commit -m "Add Storefront offer query and variant mapper with tests"
```

---

## Task 5: Wire the React component

**Files:**
- Modify: `extensions/checkout-upsell/src/<generated entry>.jsx` (from Task 1, Step 3)

- [x] **Step 1: Replace the entry component**

Using the exact import names recorded in Task 1 Step 3, replace the entry file body with the following. Reconcile any hook/component name differences against the generated scaffold before saving (e.g. if this version exposes `query` via `useApi()` rather than a `useApplyCartLinesChange` hook, adapt the two marked lines):

```jsx
import {
  reactExtension,
  useApi,
  useCartLines,
  useSettings,
  useAppMetafields,
  useApplyCartLinesChange,
  BlockStack,
  InlineLayout,
  Image,
  Text,
  Button,
  Banner,
} from '@shopify/ui-extensions-react/checkout';
import { useEffect, useState } from 'react';
import { OFFER_QUERY, mapVariantNode } from './lib/offers.js';
import { hasQualifier, computePriceDisplay, isOfferEligible } from './lib/upsell.js';

export default reactExtension('purchase.checkout.block.render', () => <UpsellBlock />);

function formatMoney(cents, currency) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

function UpsellBlock() {
  const { query } = useApi();
  const settings = useSettings();
  const cartLines = useCartLines();
  const applyCartLinesChange = useApplyCartLinesChange();

  const enabled = settings.enabled !== false;
  const heading = settings.heading || '';
  const offerVariantIds = [settings.offer_variant_1, settings.offer_variant_2].filter(Boolean);

  // Cart products' upsell_price metafields → qualifier detection.
  const cartMetafields = useAppMetafields({ type: 'product', namespace: 'custom', key: 'upsell_price' });
  const cartProductIds = cartLines.map((l) => l.merchandise.product.id);
  const cartProducts = cartProductIds.map((id) => {
    const mf = cartMetafields.find((m) => m.target.id === id);
    const value = mf?.metafield?.value;
    return { productId: id, upsellPrice: value ? parseFloat(value) : null };
  });

  const [offers, setOffers] = useState([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    if (!enabled || offerVariantIds.length === 0) {
      setOffers([]);
      return;
    }
    query(OFFER_QUERY, { variables: { ids: offerVariantIds } })
      .then((res) => {
        if (!active) return;
        const nodes = res?.data?.nodes ?? [];
        setOffers(nodes.map(mapVariantNode).filter(Boolean));
      })
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [enabled, offerVariantIds.join(',')]);

  if (!enabled || error) return null;
  if (!hasQualifier(cartProducts)) return null;

  const visible = offers.filter((o) => isOfferEligible(o, cartProductIds));
  if (visible.length === 0) return null;

  return (
    <BlockStack spacing="base">
      {heading ? <Text emphasis="bold">{heading}</Text> : null}
      {visible.map((offer) => (
        <OfferCard key={offer.variantId} offer={offer} onAdd={applyCartLinesChange} />
      ))}
    </BlockStack>
  );
}

function OfferCard({ offer, onAdd }) {
  const [adding, setAdding] = useState(false);
  const [failed, setFailed] = useState(false);
  const { currentCents, compareAtCents } = computePriceDisplay(offer);
  const currency = 'USD';

  async function add() {
    setAdding(true);
    setFailed(false);
    const result = await onAdd({ type: 'addCartLine', merchandiseId: offer.variantId, quantity: 1 });
    setAdding(false);
    if (result.type === 'error') setFailed(true);
  }

  return (
    <BlockStack spacing="tight">
      <InlineLayout spacing="base" columns={['auto', 'fill', 'auto']} blockAlignment="center">
        {offer.imageUrl ? <Image source={offer.imageUrl} /> : <Text>{' '}</Text>}
        <BlockStack spacing="none">
          <Text>{offer.title}</Text>
          <InlineLayout spacing="tight" columns={['auto', 'auto']}>
            {compareAtCents ? (
              <Text appearance="subdued" accessibilityRole="deletion">
                {formatMoney(compareAtCents, currency)}
              </Text>
            ) : null}
            <Text>{formatMoney(currentCents, currency)}</Text>
          </InlineLayout>
        </BlockStack>
        <Button kind="secondary" loading={adding} onPress={add}>
          Add
        </Button>
      </InlineLayout>
      {failed ? <Banner status="critical">Couldn’t add this item. Please try again.</Banner> : null}
    </BlockStack>
  );
}
```

- [x] **Step 2: Verify the build and unit tests still pass**

Run from `baudie-checkout-upsell/`:

```bash
shopify app build && (cd extensions/checkout-upsell && npm test)
```

Expected: build succeeds; vitest suites all PASS.

- [x] **Step 3: Commit**

```bash
git add extensions/checkout-upsell/src
git commit -m "Wire checkout upsell block: qualifier gate, offer query, add action"
```

---

## Task 6: Live verification and deploy

**Files:** none (verification + deploy)

- [ ] **Step 1: Run the dev preview**

Run from `baudie-checkout-upsell/`:

```bash
shopify app dev
```

Open the preview, add the upsell block in the checkout editor, and set `offer_variant_1` to the wipes variant.

- [ ] **Step 2: Verify behavior against the spec**

Confirm in a real checkout session:
- With a normal product (qualifier) in the cart, the wipes card renders with the discounted `upsell_price` and a struck-through regular price.
- Clicking **Add** inserts the line, and the order summary reflects the **discounted** price (the `baudie-discounts` automatic discount applied) — this validates discount re-evaluation (risk #1).
- With only upsell products in the cart, the block does not render.
- When the wipes are already in the cart, the card does not render.

If the discount does not apply to the extension-added line, stop and report — that is a blocking finding requiring a discount-side fix, outside this app.

- [ ] **Step 3: Deploy**

Run from `baudie-checkout-upsell/`:

```bash
shopify app deploy
```

Then enable + place the block and configure the wipes offer in the live checkout editor.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "Checkout upsell extension verified and deployed" --allow-empty
```

---

## Self-Review notes

- **Spec coverage:** project/app (Task 1), target + settings + metafield (Task 2), qualifier + eligibility + price-display helpers (Task 3), Storefront offer data (Task 4), render + add action + qualifier gate (Task 5), discount re-evaluation + deploy (Task 6). All spec sections covered.
- **Type consistency:** offer shape `{ variantId, productId, title, available, comingSoon, imageUrl, variantPriceCents, upsellPrice }` is produced by `mapVariantNode` (Task 4) and consumed by `isOfferEligible` / `computePriceDisplay` / `OfferCard` (Tasks 3, 5). `hasQualifier` consumes `{ productId, upsellPrice }` produced in Task 5. Names match across tasks.
- **Known reconciliation point (not a placeholder):** Task 1 Step 3 records the generated hook/component names; Task 5 Step 1 adapts the two marked lines if this API version differs. This is the spec's documented validation checkpoint, executed against real scaffolding rather than guessed.

---

## Execution notes (2026-06-11) — Tasks 1–5 complete

Implemented at `/Users/nicolascantarelli/Developer/lumios-digital/baudie-checkout-upsell` (9 commits on `main`, local only — no remote yet). 25/25 vitest tests green; esbuild bundle check clean. Every task went through spec-compliance + code-quality subagent review; all findings applied.

### Deviations from plan (all reviewed and approved)

1. **Preact, not React.** Shopify CLI 3.88 generates only the Preact flavor for `checkout_ui` (api_version 2026-04): global `shopify` signals API + `<s-*>` web components. The plan's React imports (`@shopify/ui-extensions-react/checkout`, `useCartLines`, `BlockStack`, …) no longer exist. Task 5 was rewritten against the installed typings (every API name verified at file:line in `node_modules/@shopify/ui-extensions`). This was the plan's sanctioned reconciliation point (Task 1 Step 3).
2. **Manual scaffold.** `shopify app init` requires interactive Partner-org auth, so the app skeleton was cloned from `baudie-discounts` and the extension from the official `Shopify/extensions-templates` checkout-extension template (byte-fidelity verified by review). App linking is deferred to Task 6.
3. **`default_placement = "ORDER_SUMMARY1"`** (string, docs-verified) instead of the plan's `[extensions.targeting.default_placement]` table syntax, which is not valid TOML for this schema.
4. **Interface hardening beyond plan** (from review findings): `parseUpsellPrice` exported as the single canonical parser (the plan's component re-implemented it incorrectly — `"0"`/non-numeric would have broken qualifier parity with the discount function); `currencyCode` passed through `mapVariantNode` and formatted with `shopify.i18n.formatCurrency` (plan hardcoded `en-US`/USD); `UPSELL_NAMESPACE`/`UPSELL_KEY` constants; `computePriceDisplay` clamps to the variant price so the displayed price always equals the charged price even when `upsell_price` is misconfigured above the variant price; a11y: `accessibilityLabel` on Add buttons, visually-hidden "Sale price"/"Regular price" labels for the strikethrough; locale keys (`locales/en.default.json`) instead of hardcoded strings; template `fr.json` deleted.
5. **Known accepted transient:** `appMetafields` load async with no loaded-flag, so an upsell-only cart can briefly pass the qualifier gate before entries arrive (documented in a comment at the gate; usually masked by the offer-fetch round-trip). Verify live in Task 6.

### Task 6 runbook (requires interactive auth — user in the loop)

From `/Users/nicolascantarelli/Developer/lumios-digital/baudie-checkout-upsell`:

1. `shopify app config link` — create the new app on the Partner org (same org as `baudie-discounts`). This writes `client_id` (and possibly rewrites `application_url`/`redirect_urls`); first dev/deploy also writes the extension `uid` into `shopify.extension.toml`. **Commit those rewrites.**
2. **Admin prerequisite:** the `custom.upsell_price` product metafield definition must have **Storefront API access** enabled (Settings → Custom data → Products → upsell_price), or `OFFER_QUERY` returns null metafields and offers show full price.
3. `shopify app dev` against the Baudie Plus dev store → in the checkout editor add the "checkout-upsell" block (should default into the order summary), set `offer_variant_1` to the wipes variant, optional heading.
4. Verify per plan Task 6 Step 2, plus the review additions: discount applies to the extension-added line (**blocking if not — discount-side fix needed**); upsell-only cart hides the block (also throttle network to observe the transient from note 5); wipes-already-in-cart hides the card; Add button visual weight (set `variant="secondary"` on the `s-button` if it competes with Pay); confirm single-currency store (the `upsell_price` scalar is currency-less by design, same as the discount function).
5. `shopify app deploy`, then enable + configure in the live checkout editor.
6. Create a GitHub repo + `git remote add origin … && git push -u origin main` (gh CLI is not authenticated on this machine, so this needs the user).
