import type { ValidationCheck, ValidationIssue } from "../types";
import { getAllQuestions } from "../utils/quizTraversal";
import { normalizeForMatch } from "../utils/textNormalize";

export const distractorExactDuplicate: ValidationCheck = {
  id: "DISTRACTOR_EXACT_DUPLICATE",
  severity: "BLOCKING",
  title: "Two options are identical",
  description: "Distractors must be unique so the keyed answer is unambiguous.",
  run: (module) => {
    const issues: ValidationIssue[] = [];
    for (const { block, question } of getAllQuestions(module)) {
      if (!Array.isArray(question.options)) continue;
      const seen = new Map<string, number>();
      const duplicateIndices = new Set<number>();
      question.options.forEach((opt, i) => {
        const key = normalizeForMatch(opt ?? "");
        if (!key) return;
        const firstIdx = seen.get(key);
        if (firstIdx !== undefined) {
          duplicateIndices.add(firstIdx);
          duplicateIndices.add(i);
        } else {
          seen.set(key, i);
        }
      });
      if (duplicateIndices.size >= 2) {
        const sortedIdx = [...duplicateIndices].sort((a, b) => a - b);
        const positions = sortedIdx.map((i) => i + 1).join(", ");
        const qText = truncate(question.question);
        issues.push({
          checkId: "DISTRACTOR_EXACT_DUPLICATE",
          severity: "BLOCKING",
          message: `Question "${qText}" has duplicate options at positions ${positions}.`,
          remediation:
            "Each option must be unique. Identical distractors create scoring " +
            "ambiguity — one must be wrong, but the system cannot tell which.",
          location: {
            moduleId: module.id,
            blockId: block.id,
            questionId: question.id,
            optionIndex: sortedIdx[0],
          },
          context: { duplicateIndices: sortedIdx },
        });
      }
    }
    return issues;
  },
};

/**
 * Trims `s` to at most `n` characters, appending an ellipsis if truncated.
 * @param {string} s Source string (may be empty).
 * @param {number} n Maximum length before truncation. Defaults to 60.
 * @return {string} The shortened display string.
 */
function truncate(s: string, n = 60): string {
  if (!s) return "(untitled)";
  return s.length > n ? s.slice(0, n) + "…" : s;
}
