import type { ValidationCheck, ValidationIssue } from "../types";
import { getAllQuestions, getCorrectIndices } from "../utils/quizTraversal";

export const answerReferencesMissingOption: ValidationCheck = {
  id: "ANSWER_REFERENCES_MISSING_OPTION",
  severity: "BLOCKING",
  title: "Correct answer points to a missing option",
  description:
    "The correct answer index is out of range for the question’s option list.",
  run: (module) => {
    const issues: ValidationIssue[] = [];
    for (const { block, question } of getAllQuestions(module)) {
      const indices = getCorrectIndices(question);
      if (indices.length === 0) continue;
      const optCount = Array.isArray(question.options) ? question.options.length : 0;
      for (const idx of indices) {
        if (idx < 0 || idx >= optCount) {
          const qText = truncate(question.question);
          issues.push({
            checkId: "ANSWER_REFERENCES_MISSING_OPTION",
            severity: "BLOCKING",
            message:
              `Question "${qText}" marks option ${idx + 1} as correct, ` +
              `but only ${optCount} option(s) exist.`,
            remediation:
              "Set the correct answer to one of the existing options, or add " +
              "the option that is supposed to be correct.",
            location: {
              moduleId: module.id,
              blockId: block.id,
              questionId: question.id,
              optionIndex: idx,
            },
          });
        }
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
