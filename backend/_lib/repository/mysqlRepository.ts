import mysql, { type Pool, type RowDataPacket, type ResultSetHeader } from 'mysql2/promise';
import crypto from 'node:crypto';
import {
  CollectionName,
  type BaseDocument,
  type CollectionDocumentMap,
} from '../../../src/types';
import type {
  CreateInput,
  ICollectionRepository,
  IDataRepository,
  ListOptions,
  ListResult,
  QueryFilter,
  UpdateInput,
} from './types';

export interface MysqlRepositoryConfig {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

interface CollectionRow extends RowDataPacket {
  id: string;
  data: string;
  created_at: string | null;
  updated_at: string | null;
}

class MysqlCollectionRepository<T extends BaseDocument> implements ICollectionRepository<T> {
  private readonly pool: Pool;
  private readonly collectionName: string;
  private readonly ensureReady: () => Promise<void>;

  constructor(pool: Pool, collectionName: string, ensureReady: () => Promise<void>) {
    this.pool = pool;
    this.collectionName = collectionName;
    this.ensureReady = ensureReady;
  }

  async getById(id: string): Promise<T | null> {
    await this.ensureReady();
    const [rows] = await this.pool.execute<CollectionRow[]>(
      'SELECT data FROM app_collections WHERE collection = ? AND id = ? LIMIT 1',
      [this.collectionName, id],
    );

    if (!rows || rows.length === 0) return null;
    try {
      return JSON.parse(rows[0].data) as T;
    } catch {
      return null;
    }
  }

  async list(options: ListOptions<T> = {}): Promise<ListResult<T>> {
    await this.ensureReady();
    const [rows] = await this.pool.execute<CollectionRow[]>(
      'SELECT data FROM app_collections WHERE collection = ? ORDER BY created_at ASC',
      [this.collectionName],
    );

    let items: T[] = [];
    for (const row of rows) {
      try {
        items.push(JSON.parse(row.data) as T);
      } catch {
        // Skip corrupted row if any
      }
    }

    if (options.filters && options.filters.length > 0) {
      items = items.filter((doc) => options.filters!.every((f) => matchesFilter(doc, f)));
    }

    if (options.sort) {
      const { field, direction } = options.sort;
      items.sort((a, b) => {
        const av = (a as Record<string, unknown>)[field];
        const bv = (b as Record<string, unknown>)[field];
        if (av === bv) return 0;
        if (av === undefined || av === null) return 1;
        if (bv === undefined || bv === null) return -1;
        const cmp = av < bv ? -1 : 1;
        return direction === 'asc' ? cmp : -cmp;
      });
    }

    const total = items.length;
    const offset = options.offset ?? 0;
    const limit = options.limit ?? items.length;
    const paginated = items.slice(offset, offset + limit);

    return {
      items: paginated.map((d) => deepClone(d)),
      total,
      nextCursor: null,
    };
  }

  async findFirst(filters: Array<QueryFilter<T>>): Promise<T | null> {
    const res = await this.list({ filters, limit: 1 });
    return res.items[0] ?? null;
  }

  async create(data: CreateInput<T>): Promise<T> {
    await this.ensureReady();
    const id = data.id ?? `doc_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();
    const createdAt = data.createdAt ?? now;
    const updatedAt = data.updatedAt ?? now;

    const fullDoc = {
      ...deepClone(data),
      id,
      createdAt,
      updatedAt,
    } as T;

    const serialized = JSON.stringify(fullDoc);

    await this.pool.execute<ResultSetHeader>(
      `INSERT INTO app_collections (collection, id, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = VALUES(updated_at)`,
      [this.collectionName, id, serialized, createdAt, updatedAt],
    );

    return deepClone(fullDoc);
  }

  async createIfNotExists(
    id: string,
    data: Omit<CreateInput<T>, 'id'>,
  ): Promise<{ created: boolean; doc: T }> {
    await this.ensureReady();
    const now = new Date().toISOString();
    const createdAt = (data as { createdAt?: string }).createdAt ?? now;
    const updatedAt = (data as { updatedAt?: string }).updatedAt ?? now;

    const fullDoc = {
      ...deepClone(data),
      id,
      createdAt,
      updatedAt,
    } as T;

    const serialized = JSON.stringify(fullDoc);

    const [res] = await this.pool.execute<ResultSetHeader>(
      `INSERT IGNORE INTO app_collections (collection, id, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [this.collectionName, id, serialized, createdAt, updatedAt],
    );

    if (res.affectedRows === 1) {
      return { created: true, doc: deepClone(fullDoc) };
    }

    const existing = await this.getById(id);
    if (!existing) {
      return { created: false, doc: deepClone(fullDoc) };
    }
    return { created: false, doc: existing };
  }

  async update(id: string, patch: UpdateInput<T>): Promise<T | null> {
    await this.ensureReady();
    const existing = await this.getById(id);
    if (!existing) return null;

    const updatedAt = new Date().toISOString();
    const merged = {
      ...existing,
      ...deepClone(patch),
      id,
      updatedAt,
    } as T;

    const serialized = JSON.stringify(merged);

    await this.pool.execute<ResultSetHeader>(
      'UPDATE app_collections SET data = ?, updated_at = ? WHERE collection = ? AND id = ?',
      [serialized, updatedAt, this.collectionName, id],
    );

    return deepClone(merged);
  }

  async delete(id: string): Promise<boolean> {
    await this.ensureReady();
    const [res] = await this.pool.execute<ResultSetHeader>(
      'DELETE FROM app_collections WHERE collection = ? AND id = ?',
      [this.collectionName, id],
    );
    return res.affectedRows > 0;
  }

  async count(filters?: Array<QueryFilter<T>>): Promise<number> {
    await this.ensureReady();
    if (!filters || filters.length === 0) {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM app_collections WHERE collection = ?',
        [this.collectionName],
      );
      return Number(rows[0]?.total ?? 0);
    }
    const res = await this.list({ filters });
    return res.total;
  }
}

export class MysqlRepository implements IDataRepository {
  readonly mode = 'mysql' as const;
  private readonly pool: Pool;
  private readonly collections = new Map<string, MysqlCollectionRepository<any>>();
  private readyPromise: Promise<void> | null = null;
  private readonly dbName: string;

  constructor(config: MysqlRepositoryConfig = {}) {
    const host = config.host || process.env.MYSQL_HOST || '127.0.0.1';
    const port = Number(config.port || process.env.MYSQL_PORT || 3306);
    const user = config.user || process.env.MYSQL_USER || 'root';
    const password = config.password ?? process.env.MYSQL_PASSWORD ?? '';
    this.dbName = config.database || process.env.MYSQL_DATABASE || 'absen_miful';

    this.pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database: this.dbName,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4',
    });
  }

  private async ensureSchema(): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = (async () => {
        // 1. Ensure database exists
        const host = process.env.MYSQL_HOST || '127.0.0.1';
        const port = Number(process.env.MYSQL_PORT || 3306);
        const user = process.env.MYSQL_USER || 'root';
        const password = process.env.MYSQL_PASSWORD ?? '';

        try {
          const initConn = await mysql.createConnection({ host, port, user, password });
          await initConn.query(
            `CREATE DATABASE IF NOT EXISTS \`${this.dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
          );
          await initConn.end();
        } catch (err) {
          console.warn('[MysqlRepository] Warning during CREATE DATABASE check:', err);
        }

        // 2. Ensure table exists
        await this.pool.execute(`
          CREATE TABLE IF NOT EXISTS \`app_collections\` (
            \`collection\` VARCHAR(64) NOT NULL,
            \`id\` VARCHAR(128) NOT NULL,
            \`data\` LONGTEXT NOT NULL,
            \`created_at\` VARCHAR(64) NULL,
            \`updated_at\` VARCHAR(64) NULL,
            PRIMARY KEY (\`collection\`, \`id\`),
            INDEX \`idx_coll_created\` (\`collection\`, \`created_at\`)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
      })();
    }
    return this.readyPromise;
  }

  collection<K extends CollectionName>(name: K): ICollectionRepository<CollectionDocumentMap[K]> {
    let repo = this.collections.get(name);
    if (!repo) {
      repo = new MysqlCollectionRepository<CollectionDocumentMap[K]>(
        this.pool,
        name,
        () => this.ensureSchema(),
      );
      this.collections.set(name, repo);
    }
    return repo as unknown as ICollectionRepository<CollectionDocumentMap[K]>;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
