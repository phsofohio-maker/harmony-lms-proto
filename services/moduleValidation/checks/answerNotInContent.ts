import type { ValidationCheck, ValidationIssue } from "../types";
import { getAllQuestions, getCorrectAnswerText } from "../utils/quizTraversal";
import { normalizeForMatch } from "../utils/textNormalize";
import { expandWithSynonyms } from "../utils/synonymMap";

const CONTENT_BLOCK_TYPES = new Set(["heading", "text"]);

export const answerNotInContent: ValidationCheck = {
  id: "ANSWER_NOT_IN_CONTENT",
  severity: "ADVISORY",
  title: "Correct answer not found in module content",
  description:
    "A correct answer was not located in any content block. The learner may have no way to derive it from the reading.",
  run: (module) => {
    const issues: ValidationIssue[] = [];

    const contentCorpus = module.blocks
      .filter((b) => CONTENT_BLOCK_TYPES.has(b.type))
      .map((b) => normalizeForMatch(String((b.data as Record<string, unknown>)?.content ?? "")))
      .join(" ");
    if (!contentCorpus.trim()) return issues;

    for (const { block, question } of getAllQuestions(module)) {
      const answerText = getCorrectAnswerText(question);
      if (!answerText.trim()) continue;
      const normalizedAnswer = normalizeForMatch(answerText);
      if (!normalizedAnswer) continue;

      const variants = expandWithSynonyms(normalizedAnswer);
      const matched = variants.some((v) => v.length > 0 && contentCorpus.includes(v));
      if (!matched) {
        issues.push({
          checkId: "ANSWER_NOT_IN_CONTENT",
          severity: "ADVISORY",
          message: `Correct answer "${truncate(answerText)}" was not found in the module's reading content.`,
          remediation:
            "Either add the answer to a content block so learners can derive it " +
            "from the reading, or confirm the connection during review. False " +
            "positives are possible — this is a heuristic.",
          location: { moduleId: module.id, blockId: block.id, questionId: question.id },
        });
      }
    }
    return issues;
  },
};

/**
 * Trims `s` to at most `n` characters, appending an ellipsis if truncated.
 * @param {string} s Source string (may be empty).
 * @param {number} n Maximum length before truncation. Defaults to 50.
 * @return {string} The shortened display string.
 */
function truncate(s: string, n = 50): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}
