import type { BaseDocument, CollectionDocumentMap, CollectionName } from '../../../src/types';

export type FilterOperator = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains';

export interface QueryFilter<T = Record<string, unknown>> {
  field: keyof T & string;
  op: FilterOperator;
  value: unknown;
}

export interface QuerySort<T = Record<string, unknown>> {
  field: keyof T & string;
  direction: 'asc' | 'desc';
}

export interface ListOptions<T extends BaseDocument> {
  filters?: Array<QueryFilter<T>>;
  sort?: QuerySort<T>;
  limit?: number;
  offset?: number;
  cursor?: string;
}

export interface ListResult<T extends BaseDocument> {
  items: T[];
  total: number;
  nextCursor: string | null;
}

export type CreateInput<T extends BaseDocument> = Omit<T, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type UpdateInput<T extends BaseDocument> = Partial<Omit<T, 'id' | 'createdAt'>>;

export interface ICollectionRepository<T extends BaseDocument> {
  getById(id: string): Promise<T | null>;
  list(options?: ListOptions<T>): Promise<ListResult<T>>;
  findFirst(filters: Array<QueryFilter<T>>): Promise<T | null>;
  create(data: CreateInput<T>): Promise<T>;
  /**
   * Atomically creates a document with a deterministic ID only if it does not already exist.
   * Used for transaction-safe uniqueness locks (e.g., preventing duplicate attendance scans).
   */
  createIfNotExists(
    id: string,
    data: Omit<CreateInput<T>, 'id'>,
  ): Promise<{ created: boolean; doc: T }>;
  update(id: string, patch: UpdateInput<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
  count(filters?: Array<QueryFilter<T>>): Promise<number>;
}

export interface IDataRepository {
  readonly mode: 'mock' | 'real' | 'mysql';
  collection<K extends CollectionName>(name: K): ICollectionRepository<CollectionDocumentMap[K]>;
}
