import { writeFileSync } from 'node:fs';
import { sourceClient, destClient, csvEscape } from './shopify.js';

const DEST_PRODUCTS = `
  query DestProducts($cursor: String) {
    products(first: 50, after: $cursor) {
      edges { node { id handle title } }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const SOURCE_PRODUCT_BY_HANDLE = `
  query SourceProduct($query: String!) {
    products(first: 1, query: $query) {
      edges {
        node {
          id
          handle
          metafields(first: 100) {
            edges {
              node {
                namespace
                key
                type
                value
                reference {
                  __typename
                  ... on Product { handle }
                  ... on Collection { handle }
                }
              }
            }
          }
        }
      }
    }
  }
`;

const DEST_PRODUCT_BY_HANDLE = `
  query DestProduct($query: String!) {
    products(first: 1, query: $query) {
      edges { node { id handle } }
    }
  }
`;

const DEST_COLLECTION_BY_HANDLE = `
  query DestCollection($query: String!) {
    collections(first: 1, query: $query) {
      edges { node { id handle } }
    }
  }
`;

const SET_METAFIELDS = `
  mutation SetMetafields($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id namespace key }
      userErrors { field message code }
    }
  }
`;

interface DestProduct {
  id: string;
  handle: string;
  title: string;
}

interface SourceMetafield {
  namespace: string;
  key: string;
  type: string;
  value: string;
  reference: { __typename: string; handle?: string } | null;
}

interface MetafieldsSetInput {
  ownerId: string;
  namespace: string;
  key: string;
  type: string;
  value: string;
}

interface ResultRow {
  destProductHandle: string;
  destProductTitle: string;
  namespace: string;
  key: string;
  type: string;
  status: 'set' | 'skipped' | 'error';
  message: string;
}

const destHandleCache = new Map<string, string | null>();
const destCollectionCache = new Map<string, string | null>();

async function fetchAllDestProducts(): Promise<DestProduct[]> {
  const all: DestProduct[] = [];
  let cursor: string | null = null;
  do {
    const resp = await destClient.query<{
      products: {
        edges: Array<{ node: DestProduct }>;
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    }>(DEST_PRODUCTS, { cursor });
    all.push(...resp.products.edges.map((e) => e.node));
    cursor = resp.products.pageInfo.hasNextPage ? resp.products.pageInfo.endCursor : null;
  } while (cursor);
  return all;
}

async function findSourceByHandle(handle: string): Promise<{
  id: string;
  metafields: SourceMetafield[];
} | null> {
  const resp = await sourceClient.query<{
    products: {
      edges: Array<{
        node: {
          id: string;
          handle: string;
          metafields: { edges: Array<{ node: SourceMetafield }> };
        };
      }>;
    };
  }>(SOURCE_PRODUCT_BY_HANDLE, { query: `handle:${handle}` });
  const edge = resp.products.edges[0];
  if (!edge || edge.node.handle !== handle) return null;
  return {
    id: edge.node.id,
    metafields: edge.node.metafields.edges.map((e) => e.node),
  };
}

async function findDestProductIdByHandle(handle: string): Promise<string | null> {
  if (destHandleCache.has(handle)) return destHandleCache.get(handle)!;
  const resp = await destClient.query<{
    products: { edges: Array<{ node: { id: string; handle: string } }> };
  }>(DEST_PRODUCT_BY_HANDLE, { query: `handle:${handle}` });
  const edge = resp.products.edges[0];
  const id = edge && edge.node.handle === handle ? edge.node.id : null;
  destHandleCache.set(handle, id);
  return id;
}

async function findDestCollectionIdByHandle(handle: string): Promise<string | null> {
  if (destCollectionCache.has(handle)) return destCollectionCache.get(handle)!;
  const resp = await destClient.query<{
    collections: { edges: Array<{ node: { id: string; handle: string } }> };
  }>(DEST_COLLECTION_BY_HANDLE, { query: `handle:${handle}` });
  const edge = resp.collections.edges[0];
  const id = edge && edge.node.handle === handle ? edge.node.id : null;
  destCollectionCache.set(handle, id);
  return id;
}

const SKIP_TYPES = new Set([
  'file_reference',
  'list.file_reference',
  'metaobject_reference',
  'list.metaobject_reference',
  'mixed_reference',
  'list.mixed_reference',
  'variant_reference',
  'list.variant_reference',
]);

async function resolveValue(
  mf: SourceMetafield,
): Promise<{ ok: true; value: string } | { ok: false; reason: string }> {
  if (SKIP_TYPES.has(mf.type)) {
    return { ok: false, reason: `${mf.type} not auto-resolved (file/metaobject/variant references must be migrated separately)` };
  }

  if (mf.type === 'product_reference') {
    const handle = mf.reference?.handle;
    if (!handle) return { ok: false, reason: 'source product reference missing handle' };
    const destId = await findDestProductIdByHandle(handle);
    if (!destId) return { ok: false, reason: `referenced product "${handle}" not found on destination` };
    return { ok: true, value: destId };
  }

  if (mf.type === 'list.product_reference') {
    const sourceIds = JSON.parse(mf.value) as string[];
    const handlesResp = await sourceClient.query<{
      nodes: Array<{ id: string; handle?: string } | null>;
    }>(
      `query LookupHandles($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Product { id handle }
        }
      }`,
      { ids: sourceIds },
    );
    const handles = handlesResp.nodes.map((n) => n?.handle).filter((h): h is string => !!h);
    const destIds: string[] = [];
    for (const h of handles) {
      const id = await findDestProductIdByHandle(h);
      if (!id) return { ok: false, reason: `referenced product "${h}" not found on destination` };
      destIds.push(id);
    }
    return { ok: true, value: JSON.stringify(destIds) };
  }

  if (mf.type === 'collection_reference') {
    const handle = mf.reference?.handle;
    if (!handle) return { ok: false, reason: 'source collection reference missing handle' };
    const destId = await findDestCollectionIdByHandle(handle);
    if (!destId) return { ok: false, reason: `referenced collection "${handle}" not found on destination` };
    return { ok: true, value: destId };
  }

  if (mf.type === 'list.collection_reference') {
    const sourceIds = JSON.parse(mf.value) as string[];
    const handlesResp = await sourceClient.query<{
      nodes: Array<{ id: string; handle?: string } | null>;
    }>(
      `query LookupCollHandles($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Collection { id handle }
        }
      }`,
      { ids: sourceIds },
    );
    const handles = handlesResp.nodes.map((n) => n?.handle).filter((h): h is string => !!h);
    const destIds: string[] = [];
    for (const h of handles) {
      const id = await findDestCollectionIdByHandle(h);
      if (!id) return { ok: false, reason: `referenced collection "${h}" not found on destination` };
      destIds.push(id);
    }
    return { ok: true, value: JSON.stringify(destIds) };
  }

  return { ok: true, value: mf.value };
}

async function setMetafieldsBatch(metafields: MetafieldsSetInput[]): Promise<{
  ok: boolean;
  errors: Array<{ field: string[] | null; message: string; code: string | null }>;
}> {
  const resp = await destClient.query<{
    metafieldsSet: {
      metafields: Array<{ id: string }> | null;
      userErrors: Array<{ field: string[] | null; message: string; code: string | null }>;
    };
  }>(SET_METAFIELDS, { metafields });
  const errors = resp.metafieldsSet.userErrors;
  return { ok: errors.length === 0, errors };
}

async function main(): Promise<void> {
  console.log('→ Listing all products on destination store…');
  const destProducts = await fetchAllDestProducts();
  console.log(`  Found ${destProducts.length} product(s) on destination\n`);

  if (destProducts.length === 0) {
    console.log('No products on destination yet. Migrate products via CSV first, then re-run.');
    return;
  }

  const results: ResultRow[] = [];
  let processed = 0;

  for (const product of destProducts) {
    processed += 1;
    console.log(`[${processed}/${destProducts.length}] ${product.handle}`);

    const source = await findSourceByHandle(product.handle);
    if (!source) {
      console.log(`  · skipped: no matching source product`);
      results.push({
        destProductHandle: product.handle,
        destProductTitle: product.title,
        namespace: '',
        key: '',
        type: '',
        status: 'skipped',
        message: 'no matching source product (handle not found)',
      });
      continue;
    }

    if (source.metafields.length === 0) {
      console.log(`  · no metafields on source`);
      continue;
    }

    const inputs: MetafieldsSetInput[] = [];
    const inputMeta: SourceMetafield[] = [];

    for (const mf of source.metafields) {
      const resolved = await resolveValue(mf);
      if (!resolved.ok) {
        console.log(`  · skipped ${mf.namespace}.${mf.key}: ${resolved.reason}`);
        results.push({
          destProductHandle: product.handle,
          destProductTitle: product.title,
          namespace: mf.namespace,
          key: mf.key,
          type: mf.type,
          status: 'skipped',
          message: resolved.reason,
        });
        continue;
      }
      inputs.push({
        ownerId: product.id,
        namespace: mf.namespace,
        key: mf.key,
        type: mf.type,
        value: resolved.value,
      });
      inputMeta.push(mf);
    }

    for (let i = 0; i < inputs.length; i += 25) {
      const batch = inputs.slice(i, i + 25);
      const batchMeta = inputMeta.slice(i, i + 25);
      const { ok, errors } = await setMetafieldsBatch(batch);
      if (ok) {
        for (let j = 0; j < batch.length; j += 1) {
          const mf = batchMeta[j];
          console.log(`  ✓ set ${mf.namespace}.${mf.key} [${mf.type}]`);
          results.push({
            destProductHandle: product.handle,
            destProductTitle: product.title,
            namespace: mf.namespace,
            key: mf.key,
            type: mf.type,
            status: 'set',
            message: '',
          });
        }
      } else {
        const msg = errors.map((e) => `${e.code ?? 'ERR'}: ${e.message}${e.field ? ` (field: ${e.field.join('.')})` : ''}`).join('; ');
        console.log(`  ✗ batch error: ${msg}`);
        for (const mf of batchMeta) {
          results.push({
            destProductHandle: product.handle,
            destProductTitle: product.title,
            namespace: mf.namespace,
            key: mf.key,
            type: mf.type,
            status: 'error',
            message: msg,
          });
        }
      }
    }
  }

  const set = results.filter((r) => r.status === 'set').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const failed = results.filter((r) => r.status === 'error').length;

  console.log(`\nDone: ${set} metafield(s) set, ${skipped} skipped, ${failed} errors`);

  const csv = ['dest_handle,dest_title,namespace,key,type,status,message']
    .concat(
      results.map((r) =>
        [r.destProductHandle, r.destProductTitle, r.namespace, r.key, r.type, r.status, r.message]
          .map(csvEscape)
          .join(','),
      ),
    )
    .join('\n');
  writeFileSync('phase2-results.csv', csv);
  console.log('Wrote phase2-results.csv');

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
