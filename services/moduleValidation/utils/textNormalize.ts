/**
 * Text normalization helpers for content validation checks.
 *
 * All matching against module content (answer-in-content, glossary-term,
 * distractor similarity) flows through `normalizeForMatch`. Strip HTML first
 * so quiz options aren't compared against `<p>` and `<strong>` markup.
 *
 * @module services/moduleValidation/utils/textNormalize
 */

/**
 * Removes HTML tags and decodes the most common entities from `html`.
 * @param {string} html Raw HTML string.
 * @return {string} Plain text with single-space separators between former tags.
 */
export function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

/**
 * Strips HTML, lowercases, removes punctuation and articles, collapses
 * whitespace. The canonical form used for all content-matching heuristics.
 * @param {string} text Source text (HTML allowed).
 * @return {string} Normalized lowercase string suitable for substring matching.
 */
export function normalizeForMatch(text: string): string {
  if (!text) return "";
  return stripHtml(text)
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, "\"")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Splits `text` into normalized tokens. Empty tokens are filtered out.
 * @param {string} text Source text.
 * @return {string[]} Lowercased word tokens, no punctuation or articles.
 */
export function tokenize(text: string): string[] {
  return normalizeForMatch(text).split(" ").filter(Boolean);
}

/**
 * Computes the Jaccard similarity coefficient between two strings, treating
 * them as sets of normalized tokens. Returns 1 when both sets are empty, 0
 * when exactly one is empty, otherwise |∩| / |∪| in the range [0, 1].
 * @param {string} a First string.
 * @param {string} b Second string.
 * @return {number} Similarity score between 0 and 1.
 */
export function jaccardSimilarity(a: string, b: string): number {
  const aSet = new Set(tokenize(a));
  const bSet = new Set(tokenize(b));
  if (aSet.size === 0 && bSet.size === 0) return 1;
  if (aSet.size === 0 || bSet.size === 0) return 0;
  const intersection = new Set([...aSet].filter((x) => bSet.has(x)));
  const union = new Set([...aSet, ...bSet]);
  return intersection.size / union.size;
}

/**
 * Counts normalized word tokens in `text`.
 * @param {string} text Source text.
 * @return {number} Word count after normalization.
 */
export function wordCount(text: string): number {
  return tokenize(text).length;
}
