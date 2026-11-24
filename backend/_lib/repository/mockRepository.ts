import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  CollectionName,
  type BaseDocument,
  type CollectionDocumentMap,
} from '../../../src/types';
import {
  SEED_ACADEMIC_YEARS,
  SEED_APP_SETTINGS,
  SEED_ATTENDANCE_RULES,
  SEED_CLASSES,
  SEED_HOLIDAYS,
  SEED_SCHOOL_LOCATIONS,
  SEED_STUDENT_ENROLLMENTS,
  SEED_STUDENTS,
  SEED_SUBJECTS,
  SEED_TEACHERS,
  SEED_TEACHING_SCHEDULES,
} from '../seed/initialData';
import type {
  CreateInput,
  ICollectionRepository,
  IDataRepository,
  ListOptions,
  ListResult,
  QueryFilter,
  UpdateInput,
} from './types';

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

class MockCollectionRepository<T extends BaseDocument> implements ICollectionRepository<T> {
  private readonly getStore: () => Map<string, T>;
  private readonly onBeforeRead?: () => void;
  private readonly onBeforeWrite?: () => void;
  private readonly onMutate?: () => void;

  constructor(
    getStore: () => Map<string, T>,
    hooks?: {
      onBeforeRead?: () => void;
      onBeforeWrite?: () => void;
      onMutate?: () => void;
    },
  ) {
    this.getStore = getStore;
    this.onBeforeRead = hooks?.onBeforeRead;
    this.onBeforeWrite = hooks?.onBeforeWrite;
    this.onMutate = hooks?.onMutate;
  }

  async getById(id: string): Promise<T | null> {
    this.onBeforeRead?.();
    const found = this.getStore().get(id);
    return found ? deepClone(found) : null;
  }

  async list(options: ListOptions<T> = {}): Promise<ListResult<T>> {
    this.onBeforeRead?.();
    let items = Array.from(this.getStore().values()).map((doc) => deepClone(doc));

    if (options.filters && options.filters.length > 0) {
      items = items.filter((doc) => options.filters!.every((f) => matchesFilter(doc, f)));
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
      typeof options.limit === 'number'
        ? items.slice(startIndex, startIndex + options.limit)
        : items.slice(startIndex);

    const hasMore = startIndex + sliced.length < total;
    const nextCursor = hasMore && sliced.length > 0 ? sliced[sliced.length - 1].id : null;

    return {
      items: sliced,
      total,
      nextCursor,
    };
  }

  async findFirst(filters: Array<QueryFilter<T>>): Promise<T | null> {
    const res = await this.list({ filters, limit: 1 });
    return res.items[0] ?? null;
  }

  async create(data: CreateInput<T>): Promise<T> {
    this.onBeforeWrite?.();
    const now = new Date().toISOString();
    const id = data.id ?? crypto.randomBytes(8).toString('hex');
    const doc = {
      ...deepClone(data),
      id,
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now,
    } as T;

    this.getStore().set(id, deepClone(doc));
    this.onMutate?.();
    return deepClone(doc);
  }

  async createIfNotExists(
    id: string,
    data: Omit<CreateInput<T>, 'id'>,
  ): Promise<{ created: boolean; doc: T }> {
    this.onBeforeWrite?.();
    const existing = this.getStore().get(id);
    if (existing) {
      return { created: false, doc: deepClone(existing) };
    }
    const created = await this.create({ ...(data as CreateInput<T>), id });
    return { created: true, doc: created };
  }

  async update(id: string, patch: UpdateInput<T>): Promise<T | null> {
    this.onBeforeWrite?.();
    const store = this.getStore();
    const existing = store.get(id);
    if (!existing) return null;

    const updated = {
      ...deepClone(existing),
      ...deepClone(patch),
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    } as T;

    store.set(id, deepClone(updated));
    this.onMutate?.();
    return deepClone(updated);
  }

  async delete(id: string): Promise<boolean> {
    this.onBeforeWrite?.();
    const deleted = this.getStore().delete(id);
    if (deleted) {
      this.onMutate?.();
    }
    return deleted;
  }

  async count(filters?: Array<QueryFilter<T>>): Promise<number> {
    const res = await this.list({ filters });
    return res.total;
  }
}

export interface MockRepositoryOptions {
  /** Optional path to persist local mock state as JSON across dev server restarts */
  persistFilePath?: string;
}

export class MockRepository implements IDataRepository {
  public readonly mode = 'mock' as const;
  private readonly collections = new Map<CollectionName, Map<string, BaseDocument>>();
  private readonly persistFilePath: string | null;
  private lastDiskMtimeMs = 0;

  constructor(options: MockRepositoryOptions = {}) {
    this.persistFilePath = options.persistFilePath ?? null;
    for (const name of Object.values(CollectionName)) {
      this.collections.set(name, new Map());
    }
    const loaded = this.loadFromDisk();
    if (!loaded) {
      this.seedInitialData();
      this.saveToDisk();
    }
  }

  private syncFromDiskIfNewer(): void {
    if (!this.persistFilePath) return;
    try {
      if (!fs.existsSync(this.persistFilePath)) return;
      const stat = fs.statSync(this.persistFilePath);
      if (stat.mtimeMs > this.lastDiskMtimeMs) {
        this.loadFromDisk();
      }
    } catch {
      // Ignore stat errors on transient disk access
    }
  }

  private loadFromDisk(): boolean {
    if (!this.persistFilePath) return false;
    try {
      if (!fs.existsSync(this.persistFilePath)) return false;
      const stat = fs.statSync(this.persistFilePath);
      const raw = fs.readFileSync(this.persistFilePath, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, BaseDocument[]>;
      if (!parsed || typeof parsed !== 'object') return false;

      let hasAnyRecords = false;
      for (const name of Object.values(CollectionName)) {
        const docs = parsed[name];
        const map = this.collections.get(name)!;
        if (Array.isArray(docs)) {
          map.clear();
          for (const doc of docs) {
            if (doc && typeof doc.id === 'string') {
              map.set(doc.id, deepClone(doc));
              hasAnyRecords = true;
            }
          }
        }
      }
      if (hasAnyRecords) {
        this.lastDiskMtimeMs = stat.mtimeMs;
      }
      return hasAnyRecords;
    } catch {
      return false;
    }
  }

  private saveToDisk(): void {
    if (!this.persistFilePath) return;
    try {
      const dir = path.dirname(this.persistFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const snapshot: Record<string, BaseDocument[]> = {};
      for (const [name, map] of this.collections.entries()) {
        snapshot[name] = Array.from(map.values());
      }
      const tempPath = `${this.persistFilePath}.${process.pid}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(snapshot), 'utf8');
      fs.renameSync(tempPath, this.persistFilePath);
      const stat = fs.statSync(this.persistFilePath);
      this.lastDiskMtimeMs = stat.mtimeMs;
    } catch {
      // Ignore disk write failures on read-only serverless filesystems
    }
  }

  private putAll<K extends CollectionName>(name: K, records: Array<CollectionDocumentMap[K]>): void {
    const map = this.collections.get(name)!;
    for (const record of records) {
      map.set(record.id, deepClone(record));
    }
  }

  private seedInitialData(): void {
    this.putAll(CollectionName.APP_SETTINGS, SEED_APP_SETTINGS);
    this.putAll(CollectionName.ACADEMIC_YEARS, SEED_ACADEMIC_YEARS);
    this.putAll(CollectionName.TEACHERS, SEED_TEACHERS);
    this.putAll(CollectionName.CLASSES, SEED_CLASSES);
    this.putAll(CollectionName.STUDENTS, SEED_STUDENTS);
    this.putAll(CollectionName.STUDENT_ENROLLMENTS, SEED_STUDENT_ENROLLMENTS);
    this.putAll(CollectionName.SUBJECTS, SEED_SUBJECTS);
    this.putAll(CollectionName.ATTENDANCE_RULES, SEED_ATTENDANCE_RULES);
    this.putAll(CollectionName.SCHOOL_LOCATIONS, SEED_SCHOOL_LOCATIONS);
    this.putAll(CollectionName.TEACHING_SCHEDULES, SEED_TEACHING_SCHEDULES);
    this.putAll(CollectionName.HOLIDAYS, SEED_HOLIDAYS);
  }

  collection<K extends CollectionName>(
    name: K,
  ): ICollectionRepository<CollectionDocumentMap[K]> {
    return new MockCollectionRepository<CollectionDocumentMap[K]>(
      () => this.collections.get(name) as Map<string, CollectionDocumentMap[K]>,
      this.persistFilePath
        ? {
            onBeforeRead: () => this.syncFromDiskIfNewer(),
            onBeforeWrite: () => this.syncFromDiskIfNewer(),
            onMutate: () => this.saveToDisk(),
          }
        : undefined,
    );
  }
}
