import type { ValidationCheck, ValidationIssue } from "../types";
import { getAllQuestions } from "../utils/quizTraversal";

const LETTER_PREFIX = /^[a-d][.)]\s/i;

export const letterPrefixDuplication: ValidationCheck = {
  id: "LETTER_PREFIX_DUPLICATION",
  severity: "ADVISORY",
  title: "Letter prefix duplicated in option",
  description:
    "Option text begins with “a.”, “b.”, etc. — the renderer already adds the letter.",
  run: (module) => {
    const issues: ValidationIssue[] = [];
    for (const { block, question } of getAllQuestions(module)) {
      if (!Array.isArray(question.options)) continue;
      question.options.forEach((opt, i) => {
        if (typeof opt === "string" && LETTER_PREFIX.test(opt)) {
          issues.push({
            checkId: "LETTER_PREFIX_DUPLICATION",
            severity: "ADVISORY",
            message: `Option ${i + 1} begins with "${opt.slice(0, 3)}".`,
            remediation:
              "The system adds option letters automatically. Remove the prefix from " +
              "the option text so learners do not see \"a. a. ...\" duplications.",
            location: {
              moduleId: module.id,
              blockId: block.id,
              questionId: question.id,
              optionIndex: i,
            },
          });
        }
      });
    }
    return issues;
  },
};
