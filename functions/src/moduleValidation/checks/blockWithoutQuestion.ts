import type { ValidationCheck, ValidationIssue } from "../types";
import { getAllQuestions, getCorrectAnswerText } from "../utils/quizTraversal";
import { normalizeForMatch, tokenize } from "../utils/textNormalize";

const CONTENT_BLOCK_TYPES = new Set(["heading", "text"]);
const MIN_TOKENS_TO_FLAG = 25;

export const blockWithoutQuestion: ValidationCheck = {
  id: "BLOCK_WITHOUT_QUESTION",
  severity: "INFORMATIONAL",
  title: "Content block is not directly tested",
  description:
    "No question’s correct answer matches tokens in this content block. Often intentional; surfaced for awareness.",
  run: (module) => {
    const issues: ValidationIssue[] = [];

    const answerTokens = getAllQuestions(module)
      .map(({ question }) => normalizeForMatch(getCorrectAnswerText(question)))
      .flatMap((text) => tokenize(text));
    const answerTokenSet = new Set(answerTokens.filter((t) => t.length > 3));
    if (answerTokenSet.size === 0) return issues;

    for (const block of module.blocks) {
      if (!CONTENT_BLOCK_TYPES.has(block.type)) continue;
      const text = String((block.data as Record<string, unknown>)?.content ?? "");
      const blockTokens = tokenize(text);
      if (blockTokens.length < MIN_TOKENS_TO_FLAG) continue;

      const overlap = blockTokens.some((t) => answerTokenSet.has(t));
      if (!overlap) {
        issues.push({
          checkId: "BLOCK_WITHOUT_QUESTION",
          severity: "INFORMATIONAL",
          message: `This ${block.type} block is not directly tested by any quiz question.`,
          remediation:
            "No action required. This may be background context. Listed for author awareness only.",
          location: { moduleId: module.id, blockId: block.id },
        });
      }
    }
    return issues;
  },
};
