/**
 * Curated synonym map for the `ANSWER_NOT_IN_CONTENT` check.
 *
 * Groups of equivalent terms — if the correct answer contains any term in a
 * group, the validator tries each other term in the same group when searching
 * the module content. Keeps false positives low without invoking an LLM.
 *
 * Grow this list as the audit sweep surfaces real false positives.
 *
 * @module services/moduleValidation/utils/synonymMap
 */

export const SYNONYMS: ReadonlyArray<ReadonlyArray<string>> = [
  ["20 seconds", "twenty seconds", "20 secs"],
  ["prn", "as needed", "pro re nata"],
  ["npo", "nothing by mouth", "no food or drink"],
  ["bid", "twice daily", "two times a day"],
  ["tid", "three times daily", "three times a day"],
  ["qid", "four times daily", "four times a day"],
  ["q4h", "every four hours"],
  ["hospice aide", "home health aide", "cna"],
  ["terminal illness", "life-limiting illness", "end-stage illness"],
  ["three days", "3 days"],
  ["60-100", "60 to 100", "sixty to one hundred"],
];

/**
 * Returns every variant of `text` produced by substituting one synonym group
 * member for another. The original is always included. Comparison is
 * case-insensitive; output is lowercased.
 * @param {string} text Source text (typically a normalized answer).
 * @return {string[]} The lowercased original plus every synonym substitution.
 */
export function expandWithSynonyms(text: string): string[] {
  const normalized = text.toLowerCase();
  const variants = new Set<string>([normalized]);
  for (const group of SYNONYMS) {
    const lowered = group.map((t) => t.toLowerCase());
    const matched = lowered.find((term) => normalized.includes(term));
    if (!matched) continue;
    for (const replacement of lowered) {
      if (replacement === matched) continue;
      variants.add(normalized.split(matched).join(replacement));
    }
  }
  return [...variants];
}
