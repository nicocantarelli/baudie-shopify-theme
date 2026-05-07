# Metafields migration

One-off scripts to migrate **product metafield definitions** and **values** from one Shopify store to another via the Admin GraphQL API. No paid app required.

## What it does

- **Phase 1 (`npm run definitions`)** — copies all product metafield definitions (namespace, key, name, description, type, validations, pin status, access) from source → destination. Skips definitions that already exist.
- **Phase 2 (`npm run values`)** — for each product on the destination store, finds the matching product on the source store **by handle**, then copies the metafield values via `metafieldsSet`. Idempotent — safe to re-run; existing values are overwritten with source values.

Both phases write a CSV log (`phase1-results.csv` / `phase2-results.csv`) so you can review what got copied, skipped, or errored.

## What it doesn't do (yet)

Phase 2 auto-resolves these reference types by handle:
- `product_reference` / `list.product_reference`
- `collection_reference` / `list.collection_reference`

These types are **logged and skipped** — handle them manually or extend the script:
- `file_reference` / `list.file_reference` — files have to be re-uploaded to the destination first
- `metaobject_reference` / `list.metaobject_reference` — migrate metaobjects first
- `mixed_reference`, `variant_reference`

## Setup

### 1. Install dependencies

```bash
cd scripts/migrate-metafields
npm install
```

### 2. Create custom apps on both stores

For each store: **Settings → Apps and sales channels → Develop apps → Create an app**.

**Source store (old)** — Admin API access scopes:
- `read_products`
- `read_metaobjects` (only if you have metaobject references)

**Destination store (new)** — Admin API access scopes:
- `read_products`
- `write_products`
- `read_collections`

After saving, click **Install app** and copy the Admin API access token (starts with `shpat_…`).

### 3. Configure `.env`

```bash
cp .env.example .env
```

Edit `.env` and fill in the four values.

## Run

```bash
# Phase 1: copy the 27 definitions to the destination store
npm run definitions

# Phase 2: copy values once products are on the destination store
npm run values
```

## Recommended order

1. Run **Phase 1** on the destination store **before** anything else.
2. Migrate products via Shopify's CSV export/import (this populates simple metafield values automatically since the definitions exist).
3. Run **Phase 2** to backfill anything the CSV didn't carry over (especially `product_reference` / `collection_reference` types).

## Output

- `phase1-results.csv` — `namespace,key,type,status,message` (status: `created` / `skipped` / `error`)
- `phase2-results.csv` — `dest_handle,dest_title,namespace,key,type,status,message` (status: `set` / `skipped` / `error`)

Open in any spreadsheet to filter the failures.
