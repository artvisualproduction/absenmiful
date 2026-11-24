/**
 * Pure converters between Cloud Firestore REST API JSON Value/Document representation
 * and TypeScript plain objects.
 *
 * Strictly uses REST JSON structures — NO Firebase Admin SDK.
 */

export type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { stringValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

export interface FirestoreRestDocument {
  name?: string;
  fields?: Record<string, FirestoreValue>;
  createTime?: string;
  updateTime?: string;
}

const ISO_TIMESTAMP_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

/** Converts a single TypeScript/JS value into a Firestore REST Value object */
export function toFirestoreValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }

  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return { nullValue: null };
    }
    if (Number.isInteger(value)) {
      return { integerValue: String(value) };
    }
    return { doubleValue: value };
  }

  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }

  if (typeof value === 'string') {
    if (ISO_TIMESTAMP_REGEX.test(value)) {
      return { timestampValue: value };
    }
    return { stringValue: value };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((item) => toFirestoreValue(item)),
      },
    };
  }

  if (typeof value === 'object') {
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }

  return { stringValue: String(value) };
}

/** Converts a Firestore REST Value object back into a TypeScript/JS value */
export function fromFirestoreValue(value: FirestoreValue | undefined): unknown {
  if (!value || 'nullValue' in value) {
    return null;
  }
  if ('booleanValue' in value) {
    return value.booleanValue;
  }
  if ('integerValue' in value) {
    return Number(value.integerValue);
  }
  if ('doubleValue' in value) {
    return Number(value.doubleValue);
  }
  if ('timestampValue' in value) {
    return value.timestampValue;
  }
  if ('stringValue' in value) {
    return value.stringValue;
  }
  if ('arrayValue' in value) {
    return (value.arrayValue.values ?? []).map((item) => fromFirestoreValue(item));
  }
  if ('mapValue' in value) {
    const out: Record<string, unknown> = {};
    const fields = value.mapValue.fields ?? {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = fromFirestoreValue(v);
    }
    return out;
  }
  return null;
}

/** Extracts the trailing document ID from a full Firestore resource name */
export function extractDocumentId(resourceName?: string): string {
  if (!resourceName) return '';
  const segments = resourceName.split('/');
  return segments[segments.length - 1] ?? '';
}

/** Converts a plain TypeScript record (excluding id) to Firestore REST fields map */
export function toFirestoreFields(
  obj: Record<string, unknown>,
): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (key === 'id' || val === undefined) continue;
    fields[key] = toFirestoreValue(val);
  }
  return fields;
}

/** Converts a Firestore REST document to a typed application document */
export function fromFirestoreDocument<T extends { id: string }>(
  doc: FirestoreRestDocument,
): T {
  const result: Record<string, unknown> = {
    id: extractDocumentId(doc.name),
  };

  if (doc.fields) {
    for (const [key, val] of Object.entries(doc.fields)) {
      result[key] = fromFirestoreValue(val);
    }
  }

  if (!result.createdAt && doc.createTime) {
    result.createdAt = doc.createTime;
  }
  if (!result.updatedAt && doc.updateTime) {
    result.updatedAt = doc.updateTime;
  }

  return result as T;
}
