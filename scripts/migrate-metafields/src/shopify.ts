import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnv(): void {
  try {
    const envPath = resolve(process.cwd(), '.env');
    const raw = readFileSync(envPath, 'utf-8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env optional if vars are already set
  }
}

loadEnv();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

function normalizeShop(input: string): string {
  return input.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

const apiVersion = process.env.API_VERSION || '2025-10';

export const sourceConfig = {
  shop: normalizeShop(requireEnv('SOURCE_STORE')),
  token: requireEnv('SOURCE_TOKEN'),
};

export const destConfig = {
  shop: normalizeShop(requireEnv('DEST_STORE')),
  token: requireEnv('DEST_TOKEN'),
};

export interface GqlResponse<T> {
  data?: T;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
  extensions?: {
    cost?: {
      throttleStatus?: {
        currentlyAvailable: number;
        restoreRate: number;
        maximumAvailable: number;
      };
    };
  };
}

export class ShopifyClient {
  private endpoint: string;

  constructor(
    private shop: string,
    private token: string,
  ) {
    this.endpoint = `https://${shop}/admin/api/${apiVersion}/graphql.json`;
  }

  async query<T = unknown>(
    query: string,
    variables: Record<string, unknown> = {},
    attempt = 0,
  ): Promise<T> {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.token,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after') || '2');
      console.warn(`[${this.shop}] 429 rate limited, retrying in ${retryAfter}s`);
      await sleep(retryAfter * 1000);
      return this.query<T>(query, variables, attempt + 1);
    }

    if (res.status >= 500 && attempt < 4) {
      const backoff = 2 ** attempt * 500;
      console.warn(`[${this.shop}] ${res.status} server error, retrying in ${backoff}ms`);
      await sleep(backoff);
      return this.query<T>(query, variables, attempt + 1);
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`[${this.shop}] HTTP ${res.status}: ${text}`);
    }

    const json = (await res.json()) as GqlResponse<T>;

    const throttled = json.errors?.some((e) => e.extensions?.code === 'THROTTLED');
    if (throttled && attempt < 6) {
      const status = json.extensions?.cost?.throttleStatus;
      const wait = status
        ? Math.ceil(((status.maximumAvailable - status.currentlyAvailable) / status.restoreRate) * 1000)
        : 1000;
      console.warn(`[${this.shop}] THROTTLED, waiting ${wait}ms`);
      await sleep(wait);
      return this.query<T>(query, variables, attempt + 1);
    }

    if (json.errors && json.errors.length > 0) {
      throw new Error(`[${this.shop}] GraphQL errors: ${JSON.stringify(json.errors)}`);
    }

    if (!json.data) {
      throw new Error(`[${this.shop}] Empty response: ${JSON.stringify(json)}`);
    }

    return json.data;
  }
}

export const sourceClient = new ShopifyClient(sourceConfig.shop, sourceConfig.token);
export const destClient = new ShopifyClient(destConfig.shop, destConfig.token);

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function csvEscape(value: unknown): string {
  const str = value == null ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
