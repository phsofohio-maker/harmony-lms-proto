import type { ContentBlock } from "../../types";
import type { ValidationCheck, ValidationIssue } from "../types";

export const glossaryTermUntagged: ValidationCheck = {
  id: "GLOSSARY_TERM_UNTAGGED",
  severity: "ADVISORY",
  title: "Glossary term not tagged in content",
  description:
    "A defined glossary term appears in module content without a clinical-term " +
    "tag, so learners will not see its definition popover.",
  run: (module, context) => {
    const issues: ValidationIssue[] = [];
    const terms = context.glossaryTerms ?? [];
    if (terms.length === 0) return issues;

    for (const block of module.blocks) {
      const rawHtml = extractHtml(block);
      if (!rawHtml) continue;
      const plainText = stripHtmlPreserveSpaces(rawHtml).toLowerCase();
      if (!plainText) continue;

      const taggedTermIds = extractTaggedTermIds(rawHtml);

      for (const term of terms) {
        if (!term.term) continue;
        if (taggedTermIds.has(term.id)) continue;
        if (matchesWholeWord(plainText, term.term.toLowerCase())) {
          issues.push({
            checkId: "GLOSSARY_TERM_UNTAGGED",
            severity: "ADVISORY",
            message: `Glossary term "${term.term}" appears in content but is not tagged.`,
            remediation:
              "Select the term in the editor and apply the Clinical Term mark " +
              "so learners see the definition popover.",
            location: { moduleId: module.id, blockId: block.id },
            context: { termId: term.id, term: term.term },
          });
        }
      }
    }
    return issues;
  },
};

/**
 * Concatenates every text-bearing string field of `block` into one HTML blob
 * that the term scanner can search.
 * @param {ContentBlock} block Source block.
 * @return {string} Combined HTML (may be empty).
 */
function extractHtml(block: ContentBlock): string {
  const data = block.data as Record<string, unknown>;
  const candidates = [data?.content, data?.title, data?.caption, data?.transcript];
  return candidates.filter((v) => typeof v === "string").join(" ");
}

/**
 * Strips tags while preserving spacing so adjacent words don't run together.
 * @param {string} html HTML input.
 * @return {string} Plain text with single-space separators.
 */
function stripHtmlPreserveSpaces(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Pull every term ID referenced by a `data-term-id` attribute. Guide 13's
 * ClinicalTermExtension renders tagged terms with this attribute.
 * @param {string} html HTML to scan.
 * @return {Set<string>} Set of term IDs already tagged in the markup.
 */
function extractTaggedTermIds(html: string): Set<string> {
  const ids = new Set<string>();
  const re = /data-term-id\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    ids.add(m[1]);
  }
  return ids;
}

/**
 * Case-insensitive whole-word substring match. Escapes regex metachars in
 * `needle` so a term like "C++" is matched literally.
 * @param {string} haystack Text to search.
 * @param {string} needle Word/phrase to find.
 * @return {boolean} True if `needle` appears as a whole word in `haystack`.
 */
function matchesWholeWord(haystack: string, needle: string): boolean {
  if (!needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`, "i");
  return re.test(haystack);
}
