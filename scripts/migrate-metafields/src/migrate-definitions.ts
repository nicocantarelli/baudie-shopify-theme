import { writeFileSync } from 'node:fs';
import { sourceClient, destClient, csvEscape } from './shopify.js';

const GET_DEFINITIONS = `
  query GetDefinitions($cursor: String) {
    metafieldDefinitions(ownerType: PRODUCT, first: 250, after: $cursor) {
      edges {
        node {
          id
          name
          namespace
          key
          description
          type { name }
          pinnedPosition
          validations { name value }
          access { admin storefront }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const CREATE_DEFINITION = `
  mutation CreateDefinition($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition { id namespace key }
      userErrors { field message code }
    }
  }
`;

interface SourceDefinition {
  id: string;
  name: string;
  namespace: string;
  key: string;
  description: string | null;
  type: { name: string };
  pinnedPosition: number | null;
  validations: Array<{ name: string; value: string }>;
  access: { admin: string | null; storefront: string | null } | null;
}

interface GetDefinitionsResp {
  metafieldDefinitions: {
    edges: Array<{ node: SourceDefinition }>;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

interface CreateDefinitionResp {
  metafieldDefinitionCreate: {
    createdDefinition: { id: string; namespace: string; key: string } | null;
    userErrors: Array<{ field: string[] | null; message: string; code: string | null }>;
  };
}

async function fetchAllDefinitions(): Promise<SourceDefinition[]> {
  const all: SourceDefinition[] = [];
  let cursor: string | null = null;
  do {
    const resp = await sourceClient.query<GetDefinitionsResp>(GET_DEFINITIONS, { cursor });
    all.push(...resp.metafieldDefinitions.edges.map((e) => e.node));
    cursor = resp.metafieldDefinitions.pageInfo.hasNextPage ? resp.metafieldDefinitions.pageInfo.endCursor : null;
  } while (cursor);
  return all;
}

interface ResultRow {
  namespace: string;
  key: string;
  type: string;
  status: 'created' | 'skipped' | 'error';
  message: string;
}

async function createOnDestination(def: SourceDefinition): Promise<ResultRow> {
  const access = def.access
    ? {
        ...(def.access.admin ? { admin: def.access.admin } : {}),
        ...(def.access.storefront ? { storefront: def.access.storefront } : {}),
      }
    : undefined;

  const definition = {
    name: def.name,
    namespace: def.namespace,
    key: def.key,
    description: def.description ?? undefined,
    type: def.type.name,
    ownerType: 'PRODUCT',
    pin: def.pinnedPosition !== null,
    validations: def.validations.map((v) => ({ name: v.name, value: v.value })),
    ...(access && Object.keys(access).length > 0 ? { access } : {}),
  };

  try {
    const resp = await destClient.query<CreateDefinitionResp>(CREATE_DEFINITION, { definition });
    const errors = resp.metafieldDefinitionCreate.userErrors;
    if (errors.length > 0) {
      const codes = errors.map((e) => e.code).filter(Boolean);
      const isAlreadyExists = codes.includes('TAKEN') || errors.some((e) => /already.*taken|already.*exists/i.test(e.message));
      if (isAlreadyExists) {
        return {
          namespace: def.namespace,
          key: def.key,
          type: def.type.name,
          status: 'skipped',
          message: 'already exists on destination',
        };
      }
      return {
        namespace: def.namespace,
        key: def.key,
        type: def.type.name,
        status: 'error',
        message: errors.map((e) => `${e.code ?? 'ERR'}: ${e.message}`).join('; '),
      };
    }
    return {
      namespace: def.namespace,
      key: def.key,
      type: def.type.name,
      status: 'created',
      message: '',
    };
  } catch (err) {
    return {
      namespace: def.namespace,
      key: def.key,
      type: def.type.name,
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main(): Promise<void> {
  console.log('→ Fetching definitions from source store…');
  const defs = await fetchAllDefinitions();
  console.log(`  Found ${defs.length} product metafield definition(s)\n`);

  if (defs.length === 0) {
    console.log('Nothing to migrate. Exiting.');
    return;
  }

  console.log('→ Creating on destination store…');
  const results: ResultRow[] = [];
  for (const def of defs) {
    const result = await createOnDestination(def);
    results.push(result);
    const icon = result.status === 'created' ? '✓' : result.status === 'skipped' ? '·' : '✗';
    const detail = result.message ? ` (${result.message})` : '';
    console.log(`  ${icon} ${def.namespace}.${def.key} [${def.type.name}]${detail}`);
  }

  const created = results.filter((r) => r.status === 'created').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const failed = results.filter((r) => r.status === 'error').length;

  console.log(`\nDone: ${created} created, ${skipped} skipped, ${failed} errors`);

  const csv = ['namespace,key,type,status,message']
    .concat(results.map((r) => [r.namespace, r.key, r.type, r.status, r.message].map(csvEscape).join(',')))
    .join('\n');
  writeFileSync('phase1-results.csv', csv);
  console.log('Wrote phase1-results.csv');

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
