import type { ValidationCheck, ValidationIssue } from "../types";
import { getQuizBlocks } from "../utils/quizTraversal";

export const zeroQuestions: ValidationCheck = {
  id: "ZERO_QUESTIONS",
  severity: "BLOCKING",
  title: "No questions in module",
  description: "A competency module must have at least one quiz question.",
  run: (module) => {
    const issues: ValidationIssue[] = [];
    const total = getQuizBlocks(module).reduce(
      (sum, { data }) => sum + (data.questions?.length ?? 0),
      0
    );
    if (total === 0) {
      issues.push({
        checkId: "ZERO_QUESTIONS",
        severity: "BLOCKING",
        message: "This module has no quiz questions.",
        remediation:
          "Add at least one quiz block with at least one question. A module with " +
          "no questions cannot assess learner competency.",
        location: { moduleId: module.id },
      });
    }
    return issues;
  },
};
