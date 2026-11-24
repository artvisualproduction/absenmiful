/**
 * Formats a class name so that it never repeats the prefix "Kelas".
 * Examples:
 * - "1" -> "Kelas 1"
 * - "Kelas 1" -> "Kelas 1"
 * - "1A" -> "Kelas 1A"
 * - "Kelas 1A" -> "Kelas 1A"
 * - undefined / null -> "-"
 */
export function formatClassName(name: string | null | undefined): string {
  if (!name) return '-';
  const trimmed = name.trim();
  if (/^kelas\b/i.test(trimmed)) {
    return trimmed;
  }
  return `Kelas ${trimmed}`;
}

/**
 * Strips the "Kelas" prefix to get raw level/name, useful when storing.
 * Examples:
 * - "Kelas 1" -> "1"
 * - "1" -> "1"
 * - "Kelas 1A" -> "1A"
 */
export function cleanClassName(name: string | null | undefined): string {
  if (!name) return '';
  return name.trim().replace(/^kelas\s+/i, '').trim();
}
