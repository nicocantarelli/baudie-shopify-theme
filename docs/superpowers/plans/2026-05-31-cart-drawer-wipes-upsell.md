# Cart-Drawer Wipes Upsell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a configurable wipes upsell to the theme's custom side cart that offers two products (1-pack, 3-pack) whenever the cart contains any non-wipe product.

**Architecture:** Two new snippets render the upsell inside the drawer's existing AJAX-refreshed content region. An orchestrator snippet (`sidecart-upsell.liquid`) computes visibility in server-side Liquid; a card snippet (`sidecart-upsell-item.liquid`) renders one offer using the theme's standard `{% form 'product' %}` add-to-cart pattern. The drawer's existing `initAjaxAddToCart` handler intercepts the add and re-renders the content — so **no JavaScript changes are required**.

**Tech Stack:** Shopify Liquid, section schema settings, theme translation files, scoped `{% stylesheet %}` CSS (BEM). Verification via `shopify theme check` + manual browser testing.

---

## Testing approach (read first)

This theme has **no unit-test runner** (no package.json, no JS/Liquid test harness). "Tests" in this plan therefore mean:

1. **Lint:** `shopify theme check` — must introduce **no new errors** on the files we touch. (The theme may have pre-existing offenses elsewhere; we only care about not adding new ones to our files.)
2. **Manual verification:** run `shopify theme dev` (or push to a development theme) and exercise the drawer in a browser against the checklist in each task.

Do not fabricate automated tests for Liquid output. Use the lint + manual checks as written.

---

## Prerequisites (Shopify admin — no code, must exist before manual verification)

The theme reads these; it does not create them. Without them the upsell either
won't render or will show the wrong price. Set them up (or confirm they exist)
before Task 6.

1. **Wipes collection** — a collection containing every wipe product. Drives the
   "don't upsell to a wipes-only cart" exclusion. Its handle is selected in the
   `upsell_exclude_collection` setting (Task 1).

2. **`custom.upsell_price` metafield definition** — Settings → Custom data →
   Products → Add definition. Name "Upsell price", namespace.key `custom.upsell_price`,
   type **Decimal**. Then set the value on each wipe product:
   - Single Cotton Wipes → `8.00`
   - 3 Pack Cotton Wipes → `19.00`
   This is the price shown on the upsell card.

3. **Two "Buy X Get Y" automatic discounts** — Discounts → Create → Buy X Get Y,
   set to *Automatic*:
   - **Discount A:** Customer buys 1+ item from [qualifying non-wipe products or
     collections] → gets **Single Cotton Wipes**, discount amount set so the price
     becomes **$8.00**.
   - **Discount B:** same trigger → gets **3 Pack Cotton Wipes** at **$19.00**.
   - For "X" pick the store's main product collection(s) excluding wipes (Buy X
     Get Y has no "exclude" option, so choose the collections that should qualify).
   - Set the "Get" quantity to 1 if you don't want the discount to scale.

   **Coordination rule:** the discount result must equal the `custom.upsell_price`
   metafield value. If a price changes, update **both** the discount and the
   metafield, or the card and the charged price will disagree.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `locales/en.default.schema.json` | Theme-editor labels for the new settings | Modify |
| `sections/sidecart.liquid` | Add upsell schema settings, render call, scoped CSS | Modify |
| `snippets/sidecart-upsell.liquid` | Orchestrator: visibility logic + wrapper | Create |
| `snippets/sidecart-upsell-item.liquid` | One offer card (image, title, price, add form) | Create |

Build order: settings/labels first (so `t:` keys resolve), then the card snippet, then the orchestrator (depends on the card), then wire into the section, then CSS, then full verification.

---

### Task 1: Add upsell settings to the sidecart schema + editor labels

**Files:**
- Modify: `locales/en.default.schema.json` (insert into the `sidecart.settings` object, before `"colors_header"`)
- Modify: `sections/sidecart.liquid` (insert into the `{% schema %}` settings array, before the `t:labels.colors` header)

- [ ] **Step 1: Add the translation labels**

In `locales/en.default.schema.json`, find this block (around line 670, the end of the `sidecart.settings` object):

```json
      "shipping_bar_icon_color": {
        "label": "Bar icon color"
      },
      "colors_header": "Colors",
```

Replace it with:

```json
      "shipping_bar_icon_color": {
        "label": "Bar icon color"
      },
      "upsell_header": "Upsell",
      "enable_upsell": {
        "label": "Enable cart upsell"
      },
      "upsell_heading": {
        "label": "Upsell heading"
      },
      "upsell_product_1": {
        "label": "Upsell product 1"
      },
      "upsell_product_2": {
        "label": "Upsell product 2"
      },
      "upsell_exclude_collection": {
        "label": "Exclude collection",
        "info": "Carts containing only products from this collection won't see the upsell (e.g. your Wipes collection)."
      },
      "colors_header": "Colors",
```

- [ ] **Step 2: Add the schema settings**

In `sections/sidecart.liquid`, find this block in the `{% schema %}` (around line 1753):

```json
      "id": "shipping_bar_icon_color",
      "label": "t:sidecart.settings.shipping_bar_icon_color.label",
      "default": "#3E2027"
    }, {
      "type": "header",
      "content": "t:labels.colors"
    },
```

Replace it with:

```json
      "id": "shipping_bar_icon_color",
      "label": "t:sidecart.settings.shipping_bar_icon_color.label",
      "default": "#3E2027"
    }, {
      "type": "header",
      "content": "t:sidecart.settings.upsell_header"
    }, {
      "type": "checkbox",
      "id": "enable_upsell",
      "label": "t:sidecart.settings.enable_upsell.label",
      "default": false
    }, {
      "type": "text",
      "id": "upsell_heading",
      "label": "t:sidecart.settings.upsell_heading.label",
      "default": "Complete your order"
    }, {
      "type": "product",
      "id": "upsell_product_1",
      "label": "t:sidecart.settings.upsell_product_1.label"
    }, {
      "type": "product",
      "id": "upsell_product_2",
      "label": "t:sidecart.settings.upsell_product_2.label"
    }, {
      "type": "collection",
      "id": "upsell_exclude_collection",
      "label": "t:sidecart.settings.upsell_exclude_collection.label",
      "info": "t:sidecart.settings.upsell_exclude_collection.info"
    }, {
      "type": "header",
      "content": "t:labels.colors"
    },
```

- [ ] **Step 3: Verify JSON + schema validity**

Run: `shopify theme check sections/sidecart.liquid locales/en.default.schema.json`
Expected: no new `ValidSchema`, `ValidJson`, or `MissingTemplate` errors for these files. (Pre-existing unrelated offenses are acceptable.)

Also confirm the locale JSON still parses:
Run: `node -e "JSON.parse(require('fs').readFileSync('locales/en.default.schema.json','utf8')); console.log('schema locale OK')"`
Expected: `schema locale OK`

- [ ] **Step 4: Commit**

```bash
git add sections/sidecart.liquid locales/en.default.schema.json
git commit -m "Add wipes upsell settings to sidecart schema"
```

---

### Task 2: Create the upsell card snippet

**Files:**
- Create: `snippets/sidecart-upsell-item.liquid`

- [ ] **Step 1: Confirm the reused translation key exists**

Run: `grep -n "\"add_to_cart\"" locales/en.default.json`
Expected: a match under `products` (e.g. `"add_to_cart": "Add to cart"`). The card reuses this key. If it does not exist, stop and report — do not invent a key.

- [ ] **Step 2: Create the card snippet**

Create `snippets/sidecart-upsell-item.liquid` with exactly this content:

```liquid
{% doc %}
  Renders a single upsell offer card in the sidecart. Renders nothing when the
  product has no available variant. Shows the discounted upsell price from the
  product's `custom.upsell_price` metafield (the matching Buy X Get Y discount
  applies the real reduction once the item is added to the cart).

  @param {product} product - The product to offer as an upsell
{% enddoc %}

{%- liquid
  assign variant = product.selected_or_first_available_variant
  assign render_card = true
  if product == blank or variant == blank or variant.available == false
    assign render_card = false
  endif
  assign card_image = product.metafields.custom.card_image_portrait | default: product.metafields.custom.card_image | default: product.featured_image

  assign upsell_price = variant.price
  assign has_deal = false
  assign upsell_meta = product.metafields.custom.upsell_price
  if upsell_meta != blank and upsell_meta.value != blank
    assign upsell_price = upsell_meta.value | times: 100 | round
    if upsell_price < variant.price
      assign has_deal = true
    endif
  endif
-%}

{%- if render_card -%}
  <li class="sidecart-upsell__item">
    <div class="sidecart-upsell__image-wrap">
      {%- if card_image -%}
        {{ card_image | image_url: width: 160 | image_tag:
          loading: 'lazy',
          class: 'sidecart-upsell__image',
          alt: product.title,
          width: 80,
          height: 80
        }}
      {%- else -%}
        {{ 'product-1' | placeholder_svg_tag: 'sidecart-upsell__placeholder' }}
      {%- endif -%}
    </div>

    <div class="sidecart-upsell__info">
      <p class="sidecart-upsell__title">{{ product.title }}</p>
      <p class="sidecart-upsell__price">
        {%- if has_deal -%}
          <span class="sidecart-upsell__compare">{{ variant.price | money }}</span>
        {%- endif -%}
        <span class="sidecart-upsell__current">{{ upsell_price | money }}</span>
      </p>
    </div>

    {%- form 'product', product, class: 'sidecart-upsell__form' -%}
      <input type="hidden" name="id" value="{{ variant.id }}">
      <button
        type="submit"
        name="add"
        class="sidecart-upsell__add"
        aria-label="{{ 'products.add_to_cart' | t }}: {{ product.title }}">
        {{ 'products.add_to_cart' | t }}
      </button>
    {%- endform -%}
  </li>
{%- endif -%}
```

- [ ] **Step 3: Lint the snippet**

Run: `shopify theme check snippets/sidecart-upsell-item.liquid`
Expected: no new errors (no `UnusedAssign`, no `ParserBlockingJavaScript`, no syntax errors). The `{% form 'product' %}` tag produces a valid `/cart/add` form.

- [ ] **Step 4: Commit**

```bash
git add snippets/sidecart-upsell-item.liquid
git commit -m "Add sidecart upsell card snippet"
```

---

### Task 3: Create the orchestrator snippet (visibility logic)

**Files:**
- Create: `snippets/sidecart-upsell.liquid`

- [ ] **Step 1: Create the orchestrator snippet**

Create `snippets/sidecart-upsell.liquid` with exactly this content:

```liquid
{% doc %}
  Renders the sidecart upsell block. Shows the configured offer products only
  when the cart contains at least one product outside the excluded ("wipes")
  collection. Each offer is hidden when its product is already in the cart or
  has no available variant. Renders nothing when no offers qualify.

  @param {boolean} enabled - Whether the upsell feature is turned on
  @param {string} heading - Heading text shown above the offers
  @param {product} [product_1] - First upsell product
  @param {product} [product_2] - Second upsell product
  @param {collection} [exclude_collection] - A cart of only these products shows no upsell
{% enddoc %}

{%- liquid
  assign show_block = true
  if enabled == false or cart.item_count == 0
    assign show_block = false
  endif

  # Exclusion: hide the block when every cart item is in the excluded collection
  if show_block
    assign has_non_excluded = false
    if exclude_collection == blank
      assign has_non_excluded = true
    else
      for line in cart.items
        assign line_excluded = false
        for col in line.product.collections
          if col.handle == exclude_collection.handle
            assign line_excluded = true
            break
          endif
        endfor
        unless line_excluded
          assign has_non_excluded = true
          break
        endunless
      endfor
    endif
    unless has_non_excluded
      assign show_block = false
    endunless
  endif

  # Build a comma-delimited lookup of product ids already in the cart
  assign cart_product_ids = ','
  for line in cart.items
    assign cart_product_ids = cart_product_ids | append: line.product.id | append: ','
  endfor

  # Decide visibility for offer 1
  assign show_1 = false
  if product_1 != blank
    assign variant_1 = product_1.selected_or_first_available_variant
    assign token_1 = ',' | append: product_1.id | append: ','
    assign in_cart_1 = false
    if cart_product_ids contains token_1
      assign in_cart_1 = true
    endif
    if variant_1 != blank and variant_1.available and in_cart_1 == false
      assign show_1 = true
    endif
  endif

  # Decide visibility for offer 2
  assign show_2 = false
  if product_2 != blank
    assign variant_2 = product_2.selected_or_first_available_variant
    assign token_2 = ',' | append: product_2.id | append: ','
    assign in_cart_2 = false
    if cart_product_ids contains token_2
      assign in_cart_2 = true
    endif
    if variant_2 != blank and variant_2.available and in_cart_2 == false
      assign show_2 = true
    endif
  endif

  if show_1 == false and show_2 == false
    assign show_block = false
  endif
-%}

{%- if show_block -%}
  <div class="sidecart-upsell" data-sidecart-upsell>
    {%- if heading != blank -%}
      <p class="sidecart-upsell__heading">{{ heading }}</p>
    {%- endif -%}
    <ul class="sidecart-upsell__list" role="list">
      {%- if show_1 -%}
        {% render 'sidecart-upsell-item', product: product_1 %}
      {%- endif -%}
      {%- if show_2 -%}
        {% render 'sidecart-upsell-item', product: product_2 %}
      {%- endif -%}
    </ul>
  </div>
{%- endif -%}
```

- [ ] **Step 2: Lint the snippet**

Run: `shopify theme check snippets/sidecart-upsell.liquid`
Expected: no new errors. Note: `variant_1`/`variant_2`/`token_1`/`token_2` are all consumed, so no `UnusedAssign`. The `{% render %}` references `sidecart-upsell-item` (created in Task 2), so no `MissingTemplate`.

- [ ] **Step 3: Commit**

```bash
git add snippets/sidecart-upsell.liquid
git commit -m "Add sidecart upsell orchestrator snippet"
```

---

### Task 4: Render the upsell inside the drawer content region

**Files:**
- Modify: `sections/sidecart.liquid` (the HTML, around line 135)

Rationale: placing the render at the end of `[data-sidecart-content]` (after the empty-state block, before the content's closing `</div>` and the footer) puts the upsell **below the line items and above the subtotal/checkout**. Because it lives inside `[data-sidecart-content]`, the existing `refreshFromServer()` and the AJAX add handler re-render it automatically on every cart change — including making an offer disappear once added.

- [ ] **Step 1: Insert the render call**

In `sections/sidecart.liquid`, find this exact text (the end of the empty-state block, where `.sidecart__empty` and `.sidecart__content` both close and the footer opens — around line 135):

```liquid
    {{ section.settings.continue_button_text }}
  </a>
</div></div><div class="sidecart__footer{% unless has_items or shipping_bar_preview %} sidecart__footer--hidden{% endunless %}" data-sidecart-footer>
```

Replace it with:

```liquid
    {{ section.settings.continue_button_text }}
  </a>
</div>{% render 'sidecart-upsell', enabled: section.settings.enable_upsell, heading: section.settings.upsell_heading, product_1: section.settings.upsell_product_1, product_2: section.settings.upsell_product_2, exclude_collection: section.settings.upsell_exclude_collection %}</div><div class="sidecart__footer{% unless has_items or shipping_bar_preview %} sidecart__footer--hidden{% endunless %}" data-sidecart-footer>
```

(The first `</div>` closes `.sidecart__empty`; the render is inserted; then `</div>` closes `.sidecart__content`. Only the placement changed — no existing markup was removed.)

- [ ] **Step 2: Lint**

Run: `shopify theme check sections/sidecart.liquid`
Expected: no new errors; `sidecart-upsell` resolves (created in Task 3).

- [ ] **Step 3: Commit**

```bash
git add sections/sidecart.liquid
git commit -m "Render wipes upsell in sidecart content region"
```

---

### Task 5: Add scoped CSS for the upsell

**Files:**
- Modify: `sections/sidecart.liquid` (inside the `{% stylesheet %}` block)

- [ ] **Step 1: Add the styles**

In `sections/sidecart.liquid`, find this rule inside the `{% stylesheet %}` block (around line 821):

```css
.sidecart__dynamic-checkout {
  margin-top: 14px;
}
```

Insert the following **immediately after** that rule (keep the existing rule, add below it):

```css
.sidecart-upsell {
  border-top: 1px solid var(--sidecart-border);
  padding-top: 15px;
  margin-top: 15px;
}

.sidecart-upsell__heading {
  font-family: var(--font-sweet-sans);
  font-weight: 500;
  font-size: 14px;
  letter-spacing: -0.14px;
  text-transform: uppercase;
  color: var(--sidecart-text);
  margin: 0 0 12px;
}

.sidecart-upsell__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sidecart-upsell__item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sidecart-upsell__image-wrap {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  background-color: color-mix(in srgb, var(--sidecart-text) 6%, var(--sidecart-bg));
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.sidecart-upsell__image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.sidecart-upsell__placeholder {
  width: 70%;
  height: 70%;
  opacity: 0.3;
}

.sidecart-upsell__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidecart-upsell__title {
  font-family: var(--font-sweet-sans);
  font-weight: 500;
  font-size: 13px;
  letter-spacing: -0.13px;
  text-transform: uppercase;
  color: var(--sidecart-text);
  margin: 0;
}

.sidecart-upsell__price {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 0;
}

.sidecart-upsell__compare {
  font-family: var(--font-sweet-sans);
  font-size: 12px;
  text-decoration: line-through;
  opacity: 0.6;
  color: var(--sidecart-text);
}

.sidecart-upsell__current {
  font-family: var(--font-sweet-sans);
  font-size: 14px;
  color: var(--sidecart-text);
}

.sidecart-upsell__form {
  margin: 0;
  flex-shrink: 0;
}

.sidecart-upsell__add {
  font-family: var(--font-sweet-sans);
  font-weight: 500;
  font-size: 11px;
  letter-spacing: -0.11px;
  text-transform: uppercase;
  color: var(--sidecart-bg);
  background-color: var(--sidecart-text);
  border: none;
  padding: 10px 16px;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.2s ease;
}

.sidecart-upsell__add:hover {
  opacity: 0.85;
}

.sidecart-upsell__add:focus-visible {
  outline: 2px solid var(--sidecart-text);
  outline-offset: 2px;
}

.sidecart-upsell__add.is-loading {
  opacity: 0.6;
  pointer-events: none;
}

@media (max-width: 768px) {
  .sidecart-upsell__image-wrap {
    width: 48px;
    height: 48px;
  }

  .sidecart-upsell__add {
    padding: 9px 12px;
  }
}
```

(`.sidecart-upsell__add.is-loading` matches the `is-loading` class the existing AJAX handler adds to the submit button while the request is in flight.)

- [ ] **Step 2: Lint**

Run: `shopify theme check sections/sidecart.liquid`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add sections/sidecart.liquid
git commit -m "Style sidecart wipes upsell"
```

---

### Task 6: Full verification (lint + manual browser checklist)

**Files:** none (verification only)

- [ ] **Step 1: Full theme check**

Run: `shopify theme check`
Expected: no new errors introduced by `sidecart.liquid`, `sidecart-upsell.liquid`, `sidecart-upsell-item.liquid`, or `en.default.schema.json`. Compare against the pre-existing baseline if unsure (`git stash` + check, then `git stash pop`).

- [ ] **Step 2: Start a local preview**

Run: `shopify theme dev`
Open the printed preview URL. (Requires the store to have the two wipe products and, ideally, a "Wipes" collection. If those don't exist yet, the upsell will simply not render — confirm that's the only reason before debugging.)

- [ ] **Step 3: Configure in the theme editor**

In the preview's theme editor: Overlay group → Side cart section → Upsell. Enable it, set heading "Complete your order", pick the two wipe products, and pick the Wipes collection. Save.

- [ ] **Step 4: Run the manual checklist**

Verify each (drawer opens via the cart toggle / after add-to-cart):

- [ ] Add a **non-wipe** product → both offers appear below the line items, above the checkout button.
- [ ] Each card shows the **normal price struck through and the deal price** ($8 / $19) pulled from the `custom.upsell_price` metafield.
- [ ] Click **Add** on the 1-pack → it appears as a line item **at the discounted $8** (Buy X Get Y applied); the 1-pack offer disappears; the 3-pack offer remains; the drawer stays open and refreshes **without a page reload**. The card price and the added line price match.
- [ ] **Remove the only non-wipe item** from the cart → the Buy X Get Y discount no longer qualifies and the wipe reverts to full price (expected behavior of a cart-condition discount).
- [ ] **Blank the metafield** on one product (temporarily) → its card shows the plain full price with no strikethrough (graceful fallback). Restore the value after.
- [ ] Cart contains **only wipes** (add a wipe product to an empty cart) → no upsell block renders.
- [ ] Set one offer product to **sold out** (or unpublish it) and reload → that offer is hidden; the other still shows.
- [ ] **Disable** the upsell in the editor → no block renders.
- [ ] **Empty cart** → no block renders.
- [ ] **Mobile** (narrow the viewport / device emulation) → the bottom-sheet drawer shows the upsell rows intact and the checkout button is still reachable.
- [ ] Change a line item **quantity** → the upsell still renders correctly (it re-computes on every cart change).

- [ ] **Step 5: Final commit (if Step 4 surfaced any fixes)**

Only if changes were needed:

```bash
git add -A
git commit -m "Fix wipes upsell issues found in manual verification"
```

---

## Notes / out of scope

- **Variants:** offers use `product.selected_or_first_available_variant` (matching the theme's `related-products` pattern). If a configured wipe product turns out to have multiple sellable variants that matter, a variant `<select>` would be a follow-up — not in this plan.
- **Checkout upsell:** intentionally not built here. An in-checkout upsell requires Shopify Plus (Checkout UI Extensions); the non-Plus options are post-purchase or thank-you-page apps. Handled separately via an app, per client direction.
- **Pricing:** wipes keep their normal price on their own pages and are discounted **only as an upsell** via a native Buy X Get Y automatic discount. The card's display price comes from the `custom.upsell_price` metafield. The metafield (display) and the discount (actual charge) both encode the deal price and must be kept in sync — change both if a price changes. See Prerequisites.
