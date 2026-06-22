# Affiliate Program Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a branded affiliate-program landing page that embeds the Social Snowball signup form, assembled mostly from existing about-us sections plus one new section.

**Architecture:** A new page template (`templates/page.affiliate.json`) composes existing sections (`about-hero`, `about-philosophy`, `image-text-block`, `product-faq`) plus one new `affiliate-signup` section that frames the Snowball embed (pasted iframe or Snowball theme app block). A minimal, backwards-compatible CTA button is added to `about-hero` so the hero can scroll to the form.

**Tech Stack:** Shopify Liquid sections, section-scoped `{% stylesheet %}`/`{% javascript %}`, theme translation locales (`en.default.json` for storefront strings, `en.default.schema.json` for editor labels), `shopify theme check` for linting.

## Global Constraints

- Brand palette: plum `#3E2027`, white `#FFFFFF`. Defaults must use these exact values.
- Fonts: serif display `var(--font-alyona)` for headings; sans `var(--font-jokker)` for eyebrows/body.
- Naming: files kebab-case; CSS classes BEM (`affiliate-signup__element--modifier`); setting IDs snake_case; translation keys hierarchical (max 3 levels).
- All editor-facing setting labels use `t:` keys in `locales/en.default.schema.json`. All storefront-rendered theme strings use `t:` keys in `locales/en.default.json`. No hardcoded user-facing strings.
- Section structure order: liquid logic → HTML → `{% stylesheet %}` → `{% javascript %}` (if any) → `{% schema %}`.
- Snowball form fields cannot be styled with theme CSS (cross-origin); brand-matching of the form itself is done via Snowball's Custom CSS in their dashboard — **out of scope for this plan.**
- No automated test framework exists for this theme. The "test" cycle for every task is: (a) `shopify theme check` shows **no new offenses** beyond the existing baseline of **20 offenses across 10 files**, and (b) a manual verification checklist in the Shopify theme editor/preview.
- Page URL/handle: `affiliate-program`; template suffix: `affiliate`.

---

## File Structure

- **Create** `sections/affiliate-signup.liquid` — new section framing the Snowball embed (iframe setting + `@app` block + placeholder). One responsibility: render and brand-frame the signup.
- **Modify** `sections/about-hero.liquid` — add optional CTA button (label + link), rendered only when configured (the "above" CTA).
- **Modify** `sections/about-philosophy.liquid` — add the same optional CTA button (rendered after the pillars) so the "how it works" section carries the "below" CTA, per the two-CTA layout requested (mirrors the Primally Pure inspiration).
- **Create** `templates/page.affiliate.json` — page template wiring the 7 sections with brand defaults and starter copy.
- **Modify** `locales/en.default.json` — storefront string: signup empty-state placeholder.
- **Modify** `locales/en.default.schema.json` — editor labels for the new section and the new about-hero button settings.

Tasks are independent deliverables and should be executed in order (Task 3 references sections from Tasks 1–2).

---

### Task 1: New `affiliate-signup` section

**Files:**
- Create: `sections/affiliate-signup.liquid`
- Modify: `locales/en.default.schema.json` (add `sections.affiliate_signup`)
- Modify: `locales/en.default.json` (add `sections.affiliate_signup.placeholder`)

**Interfaces:**
- Produces: a section of type `affiliate-signup` with an anchor `id="affiliate-signup"` (Task 2's hero button links to `#affiliate-signup`; Task 3 references section type `affiliate-signup`).

- [ ] **Step 1: Create the section file**

Create `sections/affiliate-signup.liquid` with exactly this content:

```liquid
{%- liquid
  assign bg_color = section.settings.background_color | default: '#3E2027'
  assign text_color = section.settings.text_color | default: '#FFFFFF'
  assign min_height = section.settings.min_height | default: 600
  assign max_width = section.settings.max_width | default: 'standard'
  assign has_embed = false
  if section.settings.embed_code != blank
    assign has_embed = true
  endif
-%}

<section
  id="affiliate-signup"
  class="affiliate-signup full-width affiliate-signup--{{ max_width }}"
  style="--as-bg: {{ bg_color }}; --as-text: {{ text_color }}; --as-min-height: {{ min_height }}px;">
  <div class="affiliate-signup__inner">
    {%- if section.settings.heading != blank -%}
      <h2 class="affiliate-signup__heading">{{ section.settings.heading }}</h2>
    {%- endif -%}
    {%- if section.settings.intro != blank -%}
      <div class="affiliate-signup__intro">{{ section.settings.intro }}</div>
    {%- endif -%}

    <div class="affiliate-signup__form">
      {%- if has_embed -%}
        {{ section.settings.embed_code }}
      {%- endif -%}
      {%- for block in section.blocks -%}
        {%- if block.type == '@app' -%}
          {% render block %}
        {%- endif -%}
      {%- endfor -%}
      {%- if has_embed == false and section.blocks.size == 0 -%}
        <p class="affiliate-signup__placeholder">{{ 'sections.affiliate_signup.placeholder' | t }}</p>
      {%- endif -%}
    </div>
  </div>
</section>

{% stylesheet %}
.affiliate-signup {
  background-color: var(--as-bg);
  color: var(--as-text);
  padding: 64px 24px;
}

.affiliate-signup__inner {
  margin: 0 auto;
  max-width: 720px;
  text-align: center;
}

.affiliate-signup--wide .affiliate-signup__inner { max-width: 960px; }
.affiliate-signup--full .affiliate-signup__inner { max-width: 1200px; }

.affiliate-signup__heading {
  font-family: var(--font-alyona);
  font-size: clamp(32px, 5vw, 56px);
  font-weight: 400;
  line-height: 1.05;
  margin: 0;
  color: var(--as-text);
}

.affiliate-signup__intro {
  font-family: var(--font-jokker);
  font-size: 16px;
  line-height: 1.6;
  margin: 16px auto 0;
  max-width: 560px;
  color: var(--as-text);
}

.affiliate-signup__form {
  margin-top: 32px;
  min-height: var(--as-min-height);
}

.affiliate-signup__form iframe {
  width: 100%;
  border: 0;
  display: block;
}

.affiliate-signup__placeholder {
  font-family: var(--font-jokker);
  font-size: 14px;
  opacity: 0.8;
}

@media (min-width: 769px) {
  .affiliate-signup { padding: 96px 40px; }
}
{% endstylesheet %}

{% javascript %}
(function () {
  var forms = document.querySelectorAll('.affiliate-signup__form');
  if (!forms.length) return;
  window.addEventListener('message', function (e) {
    if (!/snowball/i.test(e.origin)) return;
    var data = e.data || {};
    var h = data.height || data.frameHeight;
    if (!h || isNaN(h)) return;
    forms.forEach(function (form) {
      var iframe = form.querySelector('iframe');
      if (iframe) iframe.style.height = h + 'px';
    });
  });
})();
{% endjavascript %}

{% schema %}
{
  "name": "t:sections.affiliate_signup.name",
  "tag": "section",
  "class": "affiliate-signup-section",
  "settings": [
    {
      "type": "text",
      "id": "heading",
      "label": "t:labels.heading",
      "default": "Join the Baudie collective"
    },
    {
      "type": "richtext",
      "id": "intro",
      "label": "t:sections.affiliate_signup.settings.intro"
    },
    {
      "type": "liquid",
      "id": "embed_code",
      "label": "t:sections.affiliate_signup.settings.embed_code",
      "info": "t:sections.affiliate_signup.settings.embed_code_info"
    },
    {
      "type": "range",
      "id": "min_height",
      "label": "t:sections.affiliate_signup.settings.min_height",
      "min": 200,
      "max": 1200,
      "step": 20,
      "unit": "px",
      "default": 600
    },
    {
      "type": "select",
      "id": "max_width",
      "label": "t:sections.affiliate_signup.settings.max_width",
      "options": [
        { "value": "standard", "label": "t:sections.affiliate_signup.settings.width_standard" },
        { "value": "wide", "label": "t:sections.affiliate_signup.settings.width_wide" },
        { "value": "full", "label": "t:sections.affiliate_signup.settings.width_full" }
      ],
      "default": "standard"
    },
    {
      "type": "header",
      "content": "t:sections.affiliate_signup.settings.colors_header"
    },
    {
      "type": "color",
      "id": "background_color",
      "label": "t:labels.background_color",
      "default": "#3E2027"
    },
    {
      "type": "color",
      "id": "text_color",
      "label": "t:labels.text_color",
      "default": "#FFFFFF"
    }
  ],
  "blocks": [
    { "type": "@app" }
  ],
  "presets": [
    { "name": "t:sections.affiliate_signup.name" }
  ]
}
{% endschema %}
```

- [ ] **Step 2: Add editor labels to the schema locale**

In `locales/en.default.schema.json`, inside the top-level `"sections"` object, add this entry (place it alphabetically near other `a*` sections, after `about_partnerships` or similar; ensure a trailing comma on the preceding entry and valid JSON):

```json
"affiliate_signup": {
  "name": "Affiliate signup",
  "settings": {
    "intro": "Intro text",
    "embed_code": "Snowball embed code",
    "embed_code_info": "Paste the iframe embed code from your Social Snowball dashboard. Or leave blank and add the Snowball app block to this section instead.",
    "min_height": "Form minimum height",
    "max_width": "Content width",
    "width_standard": "Standard",
    "width_wide": "Wide",
    "width_full": "Full",
    "colors_header": "Colors"
  }
}
```

- [ ] **Step 3: Add the storefront placeholder string**

In `locales/en.default.json`, inside the top-level `"sections"` object, add an `affiliate_signup` entry (ensure valid JSON / trailing commas):

```json
"affiliate_signup": {
  "placeholder": "Your signup form will appear here once the Social Snowball embed code is added in the theme editor."
}
```

- [ ] **Step 4: Validate JSON locale files**

Run:

```bash
python3 - <<'PY'
import re, json
for f in ['locales/en.default.json','locales/en.default.schema.json']:
    s = open(f, encoding='utf-8-sig').read()
    s = re.sub(r'/\*.*?\*/', '', s, flags=re.DOTALL)
    s = re.sub(r'(?m)^\s*//.*$', '', s)
    json.loads(s); print(f, "valid")
PY
```

Expected: both files print "valid".

- [ ] **Step 5: Run theme check**

Run: `shopify theme check 2>&1 | tail -3`
Expected: still `20 total offenses found across 10 files` (no new offenses introduced; `affiliate-signup.liquid` not listed).

- [ ] **Step 6: Manual verification in theme editor**

Push to your dev/unpublished theme (`shopify theme push --unpublished` or your usual dev flow), then in the theme editor add the **Affiliate signup** section to any page:
- The section renders with plum background, white serif heading "Join the Baudie collective".
- With no embed configured, the placeholder text shows.
- Paste a test `<iframe>` into the **Snowball embed code** field → the iframe renders full-width inside the framed container.
- Changing **Content width** to Wide/Full widens the inner container.

- [ ] **Step 7: Commit**

```bash
git add sections/affiliate-signup.liquid locales/en.default.json locales/en.default.schema.json
git commit -m "feat(affiliate): add affiliate-signup section for Snowball embed"
```

---

### Task 2: Optional CTA button on `about-hero`

**Files:**
- Modify: `sections/about-hero.liquid`
- Modify: `locales/en.default.schema.json` (add `sections.about_hero.settings.cta_header` and `button_link`)

**Interfaces:**
- Consumes: anchor `#affiliate-signup` produced by Task 1 (default `button_link`).
- Produces: an optional hero button that renders only when `button_label` is set. Existing about-hero usages (the about-us page) are unaffected.

- [ ] **Step 1: Render the button in the hero content**

In `sections/about-hero.liquid`, find the `.about-hero__content` block (the `{%- if section.settings.subheading != blank -%}` … `{%- endif -%}` is the last child before `</div>`). Add the button block immediately after the subheading's `{%- endif -%}` and before the closing `</div>` of `.about-hero__content`:

```liquid
    {%- if section.settings.button_label != blank -%}
      <a class="about-hero__button" href="{{ section.settings.button_link | default: '#affiliate-signup' }}">{{ section.settings.button_label }}</a>
    {%- endif -%}
```

- [ ] **Step 2: Add button styles**

In the `{% stylesheet %}` block of `sections/about-hero.liquid`, add these rules immediately after the `.about-hero__heading + .about-hero__subheading { ... }` rule (around line 90):

```css
.about-hero__heading + .about-hero__button,
.about-hero__subheading + .about-hero__button {
  margin-top: 28px;
}

.about-hero__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-jokker);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  text-decoration: none;
  padding: 14px 32px;
  background-color: var(--ah-text);
  color: var(--ah-bg);
  transition: opacity 0.2s ease;
}

.about-hero__button:hover {
  opacity: 0.9;
}
```

- [ ] **Step 3: Add the settings to the schema**

In the `{% schema %}` of `sections/about-hero.liquid`, add these three entries to the `"settings"` array immediately after the `subheading_bold` checkbox object (before the `image_header` header object):

```json
    {
      "type": "header",
      "content": "t:sections.about_hero.settings.cta_header"
    },
    {
      "type": "text",
      "id": "button_label",
      "label": "t:labels.button_text"
    },
    {
      "type": "url",
      "id": "button_link",
      "label": "t:sections.about_hero.settings.button_link"
    },
```

- [ ] **Step 4: Add the new schema-locale keys**

In `locales/en.default.schema.json`, inside `sections.about_hero.settings`, add two keys (mind trailing commas):

```json
"cta_header": "Button",
"button_link": "Button link"
```

(`t:labels.button_text` already exists and is reused for the label.)

- [ ] **Step 5: Validate JSON + theme check**

Run:

```bash
python3 -c "import re,json; s=open('locales/en.default.schema.json',encoding='utf-8-sig').read(); s=re.sub(r'/\*.*?\*/','',s,flags=re.DOTALL); s=re.sub(r'(?m)^\s*//.*$','',s); json.loads(s); print('schema locale valid')"
shopify theme check 2>&1 | tail -3
```

Expected: "schema locale valid"; theme check still `20 total offenses across 10 files`.

- [ ] **Step 6: Manual verification**

In the theme editor on the existing **About** page (template `our-story`), open the About hero section:
- The new **Button** section appears with **Button text** and **Button link** fields.
- Leaving **Button text** empty → no button renders (about-us page unchanged).
- Setting **Button text** to "Apply now" → an inverted (white-bg/plum-text) button renders centered under the subheading.

- [ ] **Step 7: Commit**

```bash
git add sections/about-hero.liquid locales/en.default.schema.json
git commit -m "feat(about-hero): add optional CTA button"
```

---

### Task 3: `page.affiliate.json` template

**Files:**
- Create: `templates/page.affiliate.json`

**Interfaces:**
- Consumes: section types `affiliate-signup` (Task 1) and the `button_label`/`button_link` settings on `about-hero` (Task 2); plus existing sections `about-philosophy`, `image-text-block`, `product-faq`.

- [ ] **Step 1: Create the template**

Create `templates/page.affiliate.json` with exactly this content:

```json
{
  "sections": {
    "hero": {
      "type": "about-hero",
      "settings": {
        "eyebrow": "Affiliate program",
        "heading": "Join the Baudie collective",
        "subheading": "Share the products you love and earn doing it.",
        "subheading_size": 20,
        "button_label": "Apply now",
        "button_link": "#affiliate-signup",
        "overlay_opacity": 20,
        "min_height_desktop": 480,
        "min_height_mobile": 400,
        "background_color": "#3E2027",
        "text_color": "#FFFFFF"
      }
    },
    "perks": {
      "type": "about-philosophy",
      "blocks": {
        "perk_1": { "type": "pillar", "settings": { "heading": "Generous commission", "text": "<p>Earn on every sale you drive with your unique code and link.</p>" } },
        "perk_2": { "type": "pillar", "settings": { "heading": "Free product", "text": "<p>Get the products you'll be sharing, on us.</p>" } },
        "perk_3": { "type": "pillar", "settings": { "heading": "Early access", "text": "<p>Be first to try new launches and limited drops.</p>" } },
        "perk_4": { "type": "pillar", "settings": { "heading": "Dedicated support", "text": "<p>A real person on our team to help you succeed.</p>" } }
      },
      "block_order": ["perk_1", "perk_2", "perk_3", "perk_4"],
      "settings": {
        "heading": "Why join",
        "intro": "<p>Perks designed to reward the people who spread the word.</p>",
        "background_color": "#FFFFFF",
        "text_color": "#3E2027"
      }
    },
    "who_we_are": {
      "type": "image-text-block",
      "settings": {
        "eyebrow": "Who we are",
        "heading": "Clean, confident, for every body",
        "body": "<p>Baudie makes plant-forward deodorant enhancers that work with your body. We believe in inclusivity, transparency, and feeling your most confident self.</p>",
        "image_position": "left",
        "image_aspect_ratio": "portrait",
        "container_width": "standard",
        "text_vertical_align": "center"
      }
    },
    "who_you_are": {
      "type": "image-text-block",
      "settings": {
        "eyebrow": "Who you are",
        "heading": "A voice your community trusts",
        "body": "<p>You care about clean, thoughtful products and love sharing what genuinely works. Whether you have a big following or a close-knit community, we'd love to partner with you.</p>",
        "image_position": "right",
        "image_aspect_ratio": "portrait",
        "container_width": "standard",
        "text_vertical_align": "center"
      }
    },
    "how_it_works": {
      "type": "about-philosophy",
      "blocks": {
        "step_1": { "type": "pillar", "settings": { "heading": "1. Apply", "text": "<p>Fill out the short form below to join the program.</p>" } },
        "step_2": { "type": "pillar", "settings": { "heading": "2. Share", "text": "<p>Get your unique code and link, and share what you love.</p>" } },
        "step_3": { "type": "pillar", "settings": { "heading": "3. Earn", "text": "<p>Earn commission on every sale you drive.</p>" } }
      },
      "block_order": ["step_1", "step_2", "step_3"],
      "settings": {
        "heading": "How it works",
        "background_color": "#FFFFFF",
        "text_color": "#3E2027"
      }
    },
    "signup": {
      "type": "affiliate-signup",
      "settings": {
        "heading": "Apply to the program",
        "intro": "<p>Fill out the form below and we'll be in touch.</p>",
        "embed_code": "",
        "min_height": 600,
        "max_width": "standard",
        "background_color": "#3E2027",
        "text_color": "#FFFFFF"
      }
    },
    "faq": {
      "type": "product-faq",
      "blocks": {
        "faq_1": { "type": "faq_item", "settings": { "question": "How much can I earn?", "answer": "<p>You earn a commission on every sale made with your code or link. Details are shared when you're approved.</p>" } },
        "faq_2": { "type": "faq_item", "settings": { "question": "Who can apply?", "answer": "<p>Anyone who loves Baudie and shares it authentically with their community.</p>" } },
        "faq_3": { "type": "faq_item", "settings": { "question": "How do I get paid?", "answer": "<p>Payouts are handled automatically through our affiliate platform, Social Snowball.</p>" } }
      },
      "block_order": ["faq_1", "faq_2", "faq_3"],
      "settings": {
        "title": "Frequently asked questions",
        "background_color": "#FFFFFF",
        "text_color": "#3E2027"
      }
    }
  },
  "order": ["hero", "perks", "who_we_are", "who_you_are", "how_it_works", "signup", "faq"]
}
```

- [ ] **Step 2: Validate the template JSON**

Run:

```bash
python3 -c "import json; json.load(open('templates/page.affiliate.json')); print('template valid')"
```

Expected: "template valid".

- [ ] **Step 3: Run theme check**

Run: `shopify theme check 2>&1 | tail -3`
Expected: still `20 total offenses across 10 files` (no new offenses).

- [ ] **Step 4: Manual verification (full page)**

Push to your dev theme. In Shopify admin, create a page (e.g. title "Affiliate Program", handle `affiliate-program`) and set its **template** to `affiliate`. Open `/pages/affiliate-program` (or preview):
- Sections render top-to-bottom in order: hero → perks → who we are → who you are → how it works → signup → FAQ.
- The hero **Apply now** button scrolls the page down to the signup section.
- Brand colors are correct (plum hero + signup, white content sections).
- The signup section shows the placeholder until a Snowball embed/app block is added.
- Page is responsive at mobile and desktop widths.

- [ ] **Step 5: Commit**

```bash
git add templates/page.affiliate.json
git commit -m "feat(affiliate): add affiliate-program page template"
```

---

## Post-implementation (client handoff — not code)

Document for the client (or do it if you have dashboard access):
1. Create the page in Shopify admin with handle `affiliate-program`, assign the `affiliate` template.
2. In the theme editor, open the **Affiliate signup** section and paste the Snowball iframe embed code (from the Snowball dashboard) **or** add the Snowball app block to that section.
3. Style the Snowball form to match the brand via Snowball's **Custom CSS** field (requires a paid Snowball plan) — separate from this theme work.
