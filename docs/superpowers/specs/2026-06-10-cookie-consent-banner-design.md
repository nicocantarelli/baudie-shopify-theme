# Custom Branded Cookie Consent Banner — Design Spec

**Date:** 2026-06-10
**Theme:** baudie-theme (Shopify)
**Goal:** Replace Shopify's plain native cookie banner with a compact, branded, granular consent banner that the client can edit in the theme customizer.

## Problem

The store currently shows Shopify's **native cookie banner** (no custom banner or consent app exists in the theme code). The native banner can only be repositioned/resized in admin — it cannot match Baudie's fonts and colors. The client wants it **smaller and on-brand**.

## Solution Overview

A theme-owned consent banner that:

- Renders as a compact **bottom-left rounded card** (position configurable).
- Uses the theme body font (`--font-sweet-sans`) and brand colors.
- Offers **granular consent**: Accept all / Reject all / Manage preferences, with per-category toggles.
- Drives real consent through **Shopify's Customer Privacy API** (`window.Shopify.customerPrivacy`).
- Is **fully editable** in the theme customizer (copy, colors, position, which categories show).
- Provides a footer **"Cookie settings"** trigger so visitors can change their choice later (GDPR requirement).

## Components

### 1. `sections/cookie-banner.liquid`
The section. Standard structure order:
1. `{%- liquid -%}` logic block (resolve settings, privacy policy URL).
2. HTML: the `<cookie-consent>` custom element wrapping the card and a hidden preferences panel.
3. `{% stylesheet %}` — scoped BEM styles, individual-color-setting driven via inline custom properties.
4. `{% javascript %}` — the `<cookie-consent>` web component.
5. `{% schema %}` — settings + presets.

**Markup shape (BEM):**
```
<cookie-consent class="cookie-banner cookie-banner--bottom-left" role="dialog" aria-label="..." hidden>
  <div class="cookie-banner__card">
    <p class="cookie-banner__heading">…</p>
    <p class="cookie-banner__body">… <a href="{privacy_url}">Privacy Policy</a></p>

    <div class="cookie-banner__prefs" hidden>
      <label class="cookie-banner__row cookie-banner__row--locked">Necessary (always on)</label>
      <label class="cookie-banner__row"><input type="checkbox" data-category="analytics"> Analytics</label>
      <label class="cookie-banner__row"><input type="checkbox" data-category="marketing"> Marketing</label>
    </div>

    <div class="cookie-banner__actions">
      <button data-action="manage" aria-expanded="false">Manage preferences</button>
      <button data-action="reject" class="cookie-banner__btn--secondary">Reject all</button>
      <button data-action="accept" class="cookie-banner__btn--primary">Accept all</button>
      <button data-action="save" class="cookie-banner__btn--primary" hidden>Save</button>
    </div>
  </div>
</cookie-consent>
```
When the panel is open, "Manage preferences" hides and "Save" shows.

### 2. `<cookie-consent>` web component (in the section's `{% javascript %}`)
Responsibilities:
- **Decide visibility.** On connect, ensure the Privacy API is available (load via `Shopify.loadFeatures([{name:'consent-tracking-api', version:'0.1'}], cb)` if needed). Then call `window.Shopify.customerPrivacy.shouldShowBanner()` — only un-hide the card when it returns true. This respects admin region settings and never re-shows after a choice is made (Shopify persists the consent cookie).
- **Accept all** → `setTrackingConsent({ analytics:true, marketing:true, preferences:true, sale_of_data:true }, cb)` then hide.
- **Reject all** → same call with all `false` → hide.
- **Manage preferences** → reveal `.cookie-banner__prefs`, swap Manage→Save, set `aria-expanded="true"`. Initialize checkbox states from `currentVisitorConsent()`.
- **Save** → read checkbox states, map to API call (see mapping), hide.
- **Reopen** → listens (delegated on `document`) for clicks on `[data-cookie-settings]` and/or a `cookie-consent:open` custom event; re-shows the card with the preferences panel expanded.
- **Fail safe.** If `window.Shopify.customerPrivacy` is unavailable after load attempt, do nothing (page never breaks, no JS errors).

**Category mapping** (UI → Shopify API categories):
| UI toggle | Shopify categories set |
|---|---|
| Necessary | (none — always allowed, never sent as a deny) |
| Analytics | `analytics`, `preferences` |
| Marketing | `marketing`, `sale_of_data` |

The Shopify `preferences` category (remembering UI/site choices) is grouped under the **Analytics** toggle since there is no separate visible toggle for it. Every consent call sets all four Shopify categories explicitly: **Accept all** → all `true`; **Reject all** → all `false`; **Save** → `analytics` + `preferences` follow the Analytics checkbox, `marketing` + `sale_of_data` follow the Marketing checkbox.

### 3. Registration: `sections/overlay-group.json`
Add a `cookie-banner` entry to `sections` and append `"cookie-banner"` to `order`, so it renders site-wide via the existing `{% sections 'overlay-group' %}` in `layout/theme.liquid`. (File is auto-generated but adding a section type here is the supported pattern.)

### 4. Footer reopen trigger: `sections/footer.liquid`
Add a small **"Cookie settings"** `<button data-cookie-settings type="button">` styled as a footer link, placed near the existing legal/privacy links. Clicking it re-opens the banner's preferences panel. Copy is translatable. No new floating UI.

### 5. Translations: `locales/en.default.json`
All user-facing strings under a `cookie_banner` namespace (heading, body, accept, reject, manage, save, necessary/analytics/marketing labels, footer "Cookie settings"). Section schema labels added under the section's `t:` keys per existing convention.

## Editable Settings (schema)

- `enabled` — checkbox (default true)
- `position` — select: bottom-left (default) / bottom-right / bottom-center
- `heading` — text
- `body` — richtext/text
- `privacy_page` — url/page picker (privacy policy link)
- `label_accept`, `label_reject`, `label_manage`, `label_save` — text
- `show_analytics` — checkbox (default true)
- `show_marketing` — checkbox (default true)
- Colors (individual pickers, matching sidecart/footer pattern):
  - `background_color`, `text_color`
  - `accept_bg_color`, `accept_text_color`
  - `reject_bg_color`, `reject_text_color`
  - `border_radius` (range, px) — default to theme input radius
- A `default` preset so it can be added from the editor.

Colors are emitted as inline CSS custom properties on the root element; the scoped stylesheet consumes them with sensible fallbacks to brand defaults (`#fce9ec` bg / `#3e2027` text, matching sidecart/footer).

## Styling

- BEM, mobile-first. Scoped to `.cookie-banner`.
- Desktop: fixed, ~360–400px wide card, offset from the chosen corner with margin; subtle shadow; rounded corners (`border_radius`).
- Mobile: full-width minus page margin, pinned bottom.
- Slide-in/fade transition, wrapped in `@media (prefers-reduced-motion: no-preference)`.
- Font: `--font-sweet-sans`; uppercase/letter-spacing only where it matches existing UI.
- `z-index` above page content but coordinated with the sidecart/overlay layer; must not sit under the Gorgias chat widget (bottom-left chosen partly to avoid bottom-right chat conflicts — verify on the live site).

## Accessibility

- Root `role="dialog"` + `aria-label`.
- Real `<button>` elements; `aria-expanded` on the Manage trigger reflecting panel state.
- On show, move focus into the card (first action button); visible focus rings.
- Not dismissible without an explicit choice (no Esc-to-close on first view); Reject all is the safe explicit exit.
- Checkboxes are real `<input type="checkbox">` with associated `<label>`s.

## Prerequisites (Shopify admin — required, not code)

1. **Disable Shopify's native cookie banner** (Settings → Customer privacy → Cookie banner) to avoid two banners.
2. **Confirm the live banner is the native one**, not a separate consent app. If an app, disable/uninstall it.
3. Keep **consent-required regions** configured in admin — the banner respects `shouldShowBanner()`.

## Out of Scope (YAGNI)

- A "Preferences" cookie category toggle (client confirmed Necessary + Analytics + Marketing is enough).
- Floating re-open tab (footer link chosen instead).
- Multi-language copy beyond `en.default.json` (keys are translatable; other locales can be filled later).
- Consent logging/audit dashboards (Shopify's Customer Privacy handles storage).

## Testing / Verification

- First visit in a consent-required region: banner appears; Accept all → `currentVisitorConsent()` shows all granted; reload → no banner.
- Reject all → all denied; reload → no banner.
- Manage → Save with only Analytics on → marketing/sale_of_data denied, analytics granted.
- Footer "Cookie settings" → re-opens panel and reflects current consent.
- API-unavailable path → no banner, no console errors.
- Customizer: changing colors/copy/position/category toggles reflects live.
- Keyboard-only + screen reader pass on the dialog.
- No conflict/overlap with sidecart or Gorgias chat.
