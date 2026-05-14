import type { ValidationCheck, ValidationIssue } from "../types";
import { getAllQuestions } from "../utils/quizTraversal";

export const missingExplanationOnIncorrect: ValidationCheck = {
  id: "MISSING_EXPLANATION_ON_INCORRECT",
  severity: "ADVISORY",
  title: "Critical-content question lacks an explanation",
  description:
    "For modules flagged as critical, every question should have an explanation " +
    "so learners who miss it understand why.",
  run: (module) => {
    const issues: ValidationIssue[] = [];
    if (!module.isCritical) return issues;
    for (const { block, question } of getAllQuestions(module)) {
      const exp = typeof question.explanation === "string" ? question.explanation.trim() : "";
      if (!exp) {
        issues.push({
          checkId: "MISSING_EXPLANATION_ON_INCORRECT",
          severity: "ADVISORY",
          message: `Question "${truncate(question.question)}" has no explanation.`,
          remediation:
            "This module is marked critical. Add an explanation so learners who " +
            "answer incorrectly understand the underlying concept.",
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
 * @param {number} n Maximum length before truncation. Defaults to 60.
 * @return {string} The shortened display string.
 */
function truncate(s: string, n = 60): string {
  if (!s) return "(untitled)";
  return s.length > n ? s.slice(0, n) + "…" : s;
}
