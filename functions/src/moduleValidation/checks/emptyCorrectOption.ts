import type { ValidationCheck, ValidationIssue } from "../types";
import { getAllQuestions, getCorrectIndices } from "../utils/quizTraversal";

export const emptyCorrectOption: ValidationCheck = {
  id: "EMPTY_CORRECT_OPTION",
  severity: "BLOCKING",
  title: "Correct option is empty",
  description: "A correct option must contain visible text.",
  run: (module) => {
    const issues: ValidationIssue[] = [];
    for (const { block, question } of getAllQuestions(module)) {
      // fill-blank: check the string answer itself
      if (question.type === "fill-blank") {
        const answer = typeof question.correctAnswer === "string" ? question.correctAnswer : "";
        if (answer.trim() === "") {
          issues.push({
            checkId: "EMPTY_CORRECT_OPTION",
            severity: "BLOCKING",
            message: `Question "${truncate(question.question)}" has an empty correct answer.`,
            remediation: "Fill in the correct text for this fill-in-the-blank question.",
            location: { moduleId: module.id, blockId: block.id, questionId: question.id },
          });
        }
        continue;
      }

      const indices = getCorrectIndices(question);
      for (const idx of indices) {
        const opt = question.options?.[idx];
        if (typeof opt !== "string" || opt.trim() === "") {
          const qText = truncate(question.question);
          issues.push({
            checkId: "EMPTY_CORRECT_OPTION",
            severity: "BLOCKING",
            message: `Question "${qText}" has an empty correct option (position ${idx + 1}).`,
            remediation:
              "Fill in the text for the correct option. A blank correct answer " +
              "cannot be auto-graded and will appear as an empty choice to learners.",
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
