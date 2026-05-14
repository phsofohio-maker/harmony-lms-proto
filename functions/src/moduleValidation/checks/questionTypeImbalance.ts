import type { ValidationCheck, ValidationIssue } from "../types";
import { getAllQuestions } from "../utils/quizTraversal";

const TF_RATIO_THRESHOLD = 0.7;
const MIN_QUESTIONS_TO_FLAG = 4;

export const questionTypeImbalance: ValidationCheck = {
  id: "QUESTION_TYPE_IMBALANCE",
  severity: "ADVISORY",
  title: "Quiz is dominated by true/false",
  description:
    "True/false questions have a 50% guess rate. A module mostly composed of T/F is a weak competency assessment.",
  run: (module) => {
    const issues: ValidationIssue[] = [];
    const questions = getAllQuestions(module).map((q) => q.question);
    if (questions.length < MIN_QUESTIONS_TO_FLAG) return issues;
    const tfCount = questions.filter((q) => q.type === "true-false").length;
    const ratio = tfCount / questions.length;
    if (ratio > TF_RATIO_THRESHOLD) {
      issues.push({
        checkId: "QUESTION_TYPE_IMBALANCE",
        severity: "ADVISORY",
        message: `${tfCount} of ${questions.length} questions are true/false (${Math.round(ratio * 100)}%).`,
        remediation:
          "Consider adding multiple-choice or fill-blank questions. A quiz dominated " +
          "by true/false has a high guess rate and weak diagnostic value.",
        location: { moduleId: module.id },
        context: { trueFalseCount: tfCount, totalQuestions: questions.length, ratio },
      });
    }
    return issues;
  },
};
