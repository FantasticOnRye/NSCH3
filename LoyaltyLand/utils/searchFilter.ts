/**
 * Simple search filter utility for filtering lists by name/text fields.
 */

export interface Searchable {
  name?: string;
  businessName?: string;
  [key: string]: any;
}

/**
 * Filters an array of items by a search query.
 * Matches against 'name' or 'businessName' fields (case-insensitive).
 *
 * @param items - Array of items to filter
 * @param query - Search query string
 * @returns Filtered array of items matching the query
 */
export function filterByName<T extends Searchable>(items: T[], query: string): T[] {
  if (!query.trim()) {
    return items;
  }

  const normalizedQuery = query.toLowerCase().trim();

  return items.filter((item) => {
    const name = item.name || item.businessName || '';
    return name.toLowerCase().includes(normalizedQuery);
  });
}

/**
 * Highlights matching text in a string (returns indices for highlighting).
 * Useful for showing search matches in UI.
 *
 * @param text - The full text
 * @param query - The search query
 * @returns Object with match start and end indices, or null if no match
 */
export function findMatchIndices(
  text: string,
  query: string
): { start: number; end: number } | null {
  if (!query.trim()) {
    return null;
  }

  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.toLowerCase().trim();
  const start = normalizedText.indexOf(normalizedQuery);

  if (start === -1) {
    return null;
  }

  return {
    start,
    end: start + normalizedQuery.length,
  };
}
