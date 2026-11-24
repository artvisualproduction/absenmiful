import crypto from 'node:crypto';
import type { BaseDocument, CollectionDocumentMap, CollectionName } from '../../../src/types';
import { ApiError } from '../apiError';
import {
  assertRealFirestoreCredentials,
  getServerFirebaseConfig,
  type ServerFirebaseConfig,
} from '../config/firebase';
import {
  fromFirestoreDocument,
  toFirestoreFields,
  toFirestoreValue,
  type FirestoreRestDocument,
} from './firestoreConverter';
import type {
  CreateInput,
  FilterOperator,
  ICollectionRepository,
  IDataRepository,
  ListOptions,
  ListResult,
  QueryFilter,
  UpdateInput,
} from './types';

interface CachedAccessToken {
  accessToken: string;
  expiresAtMs: number;
}

const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';
const GOOGLE_TOKEN_URI = 'https://oauth2.googleapis.com/token';

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function isValidFirestoreDocumentId(id: string): boolean {
  if (typeof id !== 'string' || id.length === 0) return false;
  if (id === '.' || id === '..') return false;
  if (id.includes('\u0000')) return false;
  if (/^__.*__$/.test(id)) return false;
  if (Buffer.byteLength(id, 'utf8') > 1500) return false;
  return true;
}

function mapOperatorToFirestore(op: FilterOperator): string {
  switch (op) {
    case '==':
      return 'EQUAL';
    case '!=':
      return 'NOT_EQUAL';
    case '<':
      return 'LESS_THAN';
    case '<=':
      return 'LESS_THAN_OR_EQUAL';
    case '>':
      return 'GREATER_THAN';
    case '>=':
      return 'GREATER_THAN_OR_EQUAL';
    case 'in':
      return 'IN';
    case 'array-contains':
      return 'ARRAY_CONTAINS';
  }
}

function matchesFilter<T extends BaseDocument>(doc: T, filter: QueryFilter<T>): boolean {
  const fieldValue = (doc as Record<string, unknown>)[filter.field];
  const target = filter.value;

  switch (filter.op) {
    case '==':
      return fieldValue === target;
    case '!=':
      return fieldValue !== target;
    case '<':
      return (fieldValue as number | string) < (target as number | string);
    case '<=':
      return (fieldValue as number | string) <= (target as number | string);
    case '>':
      return (fieldValue as number | string) > (target as number | string);
    case '>=':
      return (fieldValue as number | string) >= (target as number | string);
    case 'in':
      return Array.isArray(target) && target.includes(fieldValue);
    case 'array-contains':
      return Array.isArray(fieldValue) && fieldValue.includes(target);
    default:
      return false;
  }
}

/**
 * Optional Service Account JWT -> OAuth2 access token provider (used only if explicit
 * Service Account env vars are configured; default mode uses public firebaseWebConfig apiKey).
 */
class ServiceAccountTokenClient {
  private cache: CachedAccessToken | null = null;
  private readonly config: ServerFirebaseConfig;

  constructor(config: ServerFirebaseConfig) {
    this.config = config;
  }

  async getAccessToken(): Promise<string> {
    assertRealFirestoreCredentials(this.config);

    const nowMs = Date.now();
    if (this.cache && nowMs < this.cache.expiresAtMs - 60_000) {
      return this.cache.accessToken;
    }

    const nowSec = Math.floor(nowMs / 1000);
    const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = base64UrlEncode(
      JSON.stringify({
        iss: this.config.clientEmail,
        scope: FIRESTORE_SCOPE,
        aud: GOOGLE_TOKEN_URI,
        iat: nowSec,
        exp: nowSec + 3600,
      }),
    );

    const signingInput = `${header}.${payload}`;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signingInput);
    signer.end();
    const signature = base64UrlEncode(signer.sign(this.config.privateKey));
    const assertion = `${signingInput}.${signature}`;

    const response = await fetch(GOOGLE_TOKEN_URI, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gagal memperoleh OAuth2 token Google (${response.status}): ${errorText}`);
    }

    const tokenJson = (await response.json()) as { access_token: string; expires_in?: number };
    const expiresInSec = tokenJson.expires_in ?? 3600;
    this.cache = {
      accessToken: tokenJson.access_token,
      expiresAtMs: nowMs + expiresInSec * 1000,
    };

    return this.cache.accessToken;
  }
}

class FirestoreRestCollectionRepository<T extends BaseDocument>
  implements ICollectionRepository<T>
{
  private readonly collectionName: string;
  private readonly config: ServerFirebaseConfig;
  private readonly tokenClient: ServiceAccountTokenClient;

  constructor(
    collectionName: string,
    config: ServerFirebaseConfig,
    tokenClient: ServiceAccountTokenClient,
  ) {
    this.collectionName = collectionName;
    this.config = config;
    this.tokenClient = tokenClient;
  }

  private get documentsRootUrl(): string {
    const dbId = this.config.databaseId?.trim() || '(default)';
    return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      this.config.projectId,
    )}/databases/${encodeURIComponent(dbId)}/documents`;
  }

  private buildAuthenticatedUrl(url: string): string {
    if (this.config.authMode === 'web_api_key') {
      const sep = url.includes('?') ? '&' : '?';
      return `${url}${sep}key=${encodeURIComponent(this.config.apiKey)}`;
    }
    return url;
  }

  private async buildAuthHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
    assertRealFirestoreCredentials(this.config);
    if (this.config.authMode === 'service_account') {
      const token = await this.tokenClient.getAccessToken();
      return {
        Authorization: `Bearer ${token}`,
        ...extra,
      };
    }
    return { ...extra };
  }

  private async request<R>(url: string, init: RequestInit = {}): Promise<R> {
    const authHeaders = await this.buildAuthHeaders({
      'Content-Type': 'application/json',
    });
    const response = await fetch(this.buildAuthenticatedUrl(url), {
      ...init,
      headers: {
        ...authHeaders,
        ...(init.headers as Record<string, string> | undefined),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Firestore REST error (${response.status}): ${text}`);
    }

    if (response.status === 204) {
      return undefined as R;
    }

    return (await response.json()) as R;
  }

  async getById(id: string): Promise<T | null> {
    if (!isValidFirestoreDocumentId(id)) {
      return null;
    }
    const headers = await this.buildAuthHeaders();
    const url = this.buildAuthenticatedUrl(
      `${this.documentsRootUrl}/${this.collectionName}/${encodeURIComponent(id)}`,
    );
    const response = await fetch(url, { headers });

    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Firestore REST getById error (${response.status}): ${text}`);
    }

    const doc = (await response.json()) as FirestoreRestDocument;
    return fromFirestoreDocument<T>(doc);
  }

  async list(options: ListOptions<T> = {}): Promise<ListResult<T>> {
    const filters = options.filters ?? [];
    const structuredQuery: Record<string, unknown> = {
      from: [{ collectionId: this.collectionName }],
    };

    // Push down only a single equality/comparison filter to avoid Firestore composite index errors.
    // Remaining filters, sorting, cursor, offset, and limit are evaluated cleanly in JS.
    let pushedFilterIndex = -1;
    if (filters.length === 1) {
      pushedFilterIndex = 0;
    } else if (filters.length > 1) {
      pushedFilterIndex = filters.findIndex((f) => f.op === '==');
    }

    if (pushedFilterIndex >= 0) {
      const f = filters[pushedFilterIndex]!;
      structuredQuery.where = {
        fieldFilter: {
          field: { fieldPath: f.field },
          op: mapOperatorToFirestore(f.op),
          value: toFirestoreValue(f.value),
        },
      };
    }

    // Only push down single-field limit when no JS post-filtering/sorting/cursor is needed
    if (
      filters.length <= 1 &&
      !options.sort &&
      !options.cursor &&
      !options.offset &&
      typeof options.limit === 'number' &&
      options.limit > 0
    ) {
      structuredQuery.limit = options.limit;
    }

    const rows = await this.request<Array<{ document?: FirestoreRestDocument }>>(
      `${this.documentsRootUrl}:runQuery`,
      {
        method: 'POST',
        body: JSON.stringify({ structuredQuery }),
      },
    );

    let items = rows
      .filter((row): row is { document: FirestoreRestDocument } => Boolean(row.document))
      .map((row) => fromFirestoreDocument<T>(row.document));

    if (filters.length > 0) {
      items = items.filter((doc) => filters.every((f) => matchesFilter(doc, f)));
    }

    if (options.sort) {
      const { field, direction } = options.sort;
      items.sort((a, b) => {
        const av = (a as Record<string, unknown>)[field];
        const bv = (b as Record<string, unknown>)[field];
        if (av === bv) return 0;
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        const cmp = String(av).localeCompare(String(bv), 'id', { numeric: true });
        return direction === 'desc' ? -cmp : cmp;
      });
    }

    const total = items.length;
    let startIndex = options.offset ?? 0;

    if (options.cursor) {
      const cursorIdx = items.findIndex((item) => item.id === options.cursor);
      if (cursorIdx >= 0) {
        startIndex = cursorIdx + 1;
      }
    }

    const sliced =
      typeof options.limit === 'number' && options.limit > 0
        ? items.slice(startIndex, startIndex + options.limit)
        : items.slice(startIndex);

    const hasMore = startIndex + sliced.length < total;
    const nextCursor = hasMore && sliced.length > 0 ? sliced[sliced.length - 1]!.id : null;

    return {
      items: sliced,
      total,
      nextCursor,
    };
  }

  async findFirst(filters: Array<QueryFilter<T>>): Promise<T | null> {
    const result = await this.list({ filters, limit: 1 });
    return result.items[0] ?? null;
  }

  async create(data: CreateInput<T>): Promise<T> {
    if (data.id !== undefined && !isValidFirestoreDocumentId(data.id)) {
      throw ApiError.badRequest('ID dokumen tidak valid untuk penyimpanan database.');
    }
    const now = new Date().toISOString();
    const payload = {
      ...data,
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now,
    } as Record<string, unknown>;

    // Always pass an explicit, URL-safe documentId so Cloud Firestore Security Rules
    // can validate {docId} with isValidId(docId) on POST /documents/{collection}.
    const resolvedId =
      data.id && data.id.trim().length > 0
        ? data.id.trim()
        : `${this.collectionName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toLowerCase() || 'doc'}_${crypto.randomBytes(10).toString('hex')}`;
    const querySuffix = `?documentId=${encodeURIComponent(resolvedId)}`;
    const doc = await this.request<FirestoreRestDocument>(
      `${this.documentsRootUrl}/${this.collectionName}${querySuffix}`,
      {
        method: 'POST',
        body: JSON.stringify({ fields: toFirestoreFields(payload) }),
      },
    );

    return fromFirestoreDocument<T>(doc);
  }

  async createIfNotExists(
    id: string,
    data: Omit<CreateInput<T>, 'id'>,
  ): Promise<{ created: boolean; doc: T }> {
    if (!isValidFirestoreDocumentId(id)) {
      throw ApiError.badRequest('ID dokumen tidak valid untuk penyimpanan database.');
    }
    const headers = await this.buildAuthHeaders({ 'Content-Type': 'application/json' });
    const now = new Date().toISOString();
    const payload = {
      ...data,
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now,
    } as Record<string, unknown>;

    const url = this.buildAuthenticatedUrl(
      `${this.documentsRootUrl}/${this.collectionName}?documentId=${encodeURIComponent(id)}`,
    );
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ fields: toFirestoreFields(payload) }),
    });

    if (response.status === 409) {
      const existing = await this.getById(id);
      if (existing) {
        return { created: false, doc: existing };
      }
      throw new Error(`Dokumen ${this.collectionName}/${id} mengalami konflik pembuatan.`);
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Firestore REST createIfNotExists error (${response.status}): ${text}`);
    }

    const doc = (await response.json()) as FirestoreRestDocument;
    return { created: true, doc: fromFirestoreDocument<T>(doc) };
  }

  async update(id: string, patch: UpdateInput<T>): Promise<T | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const payload = {
      ...patch,
      updatedAt: new Date().toISOString(),
    } as Record<string, unknown>;

    const fieldPaths = Object.keys(payload).filter((k) => k !== 'id' && payload[k] !== undefined);
    const maskParams = fieldPaths
      .map((fp) => `updateMask.fieldPaths=${encodeURIComponent(fp)}`)
      .join('&');

    const doc = await this.request<FirestoreRestDocument>(
      `${this.documentsRootUrl}/${this.collectionName}/${encodeURIComponent(id)}?${maskParams}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ fields: toFirestoreFields(payload) }),
      },
    );

    return fromFirestoreDocument<T>(doc);
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) return false;

    await this.request<void>(
      `${this.documentsRootUrl}/${this.collectionName}/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
    return true;
  }

  async count(filters?: Array<QueryFilter<T>>): Promise<number> {
    const result = await this.list({ filters });
    return result.total;
  }
}

export class FirestoreRestRepository implements IDataRepository {
  public readonly mode = 'real' as const;
  private readonly config: ServerFirebaseConfig;
  private readonly tokenClient: ServiceAccountTokenClient;

  constructor(config = getServerFirebaseConfig()) {
    this.config = config;
    this.tokenClient = new ServiceAccountTokenClient(config);
  }

  collection<K extends CollectionName>(
    name: K,
  ): ICollectionRepository<CollectionDocumentMap[K]> {
    return new FirestoreRestCollectionRepository<CollectionDocumentMap[K]>(
      name,
      this.config,
      this.tokenClient,
    );
  }
}
