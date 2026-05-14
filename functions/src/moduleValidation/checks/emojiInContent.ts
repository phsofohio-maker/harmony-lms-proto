import type { ContentBlock, Module, QuizBlockData } from "../../types";
import type { ValidationCheck, ValidationIssue } from "../types";

// Unicode property escape; flags `u` to enable. Matches the vast majority of
// emoji-class characters. Excludes plain digits and most punctuation.
const EMOJI_REGEX = /\p{Extended_Pictographic}/u;

export const emojiInContent: ValidationCheck = {
  id: "EMOJI_IN_CONTENT",
  severity: "BLOCKING",
  title: "Emoji found in content",
  description:
    "Brand Guide forbids emoji in learner-visible content. Use Lucide icons in the UI layer instead.",
  run: (module) => {
    const issues: ValidationIssue[] = [];

    if (containsEmoji(module.title)) {
      issues.push(emojiIssue(module, "module title", { moduleId: module.id }));
    }
    if (containsEmoji(module.description)) {
      issues.push(emojiIssue(module, "module description", { moduleId: module.id }));
    }

    for (const block of module.blocks) {
      scanBlock(module, block, issues);
    }
    return issues;
  },
};

/**
 * Scans every text-bearing field of `block` for emoji and pushes a
 * BLOCKING issue per occurrence into `issues`.
 * @param {Module} module Parent module (for location.moduleId).
 * @param {ContentBlock} block Block under inspection.
 * @param {ValidationIssue[]} issues Output array; mutated in place.
 * @return {void}
 */
function scanBlock(module: Module, block: ContentBlock, issues: ValidationIssue[]): void {
  const baseLoc = { moduleId: module.id, blockId: block.id };
  const data = block.data as Record<string, unknown>;

  const stringFields = ["content", "caption", "altText", "title", "transcript"];
  for (const field of stringFields) {
    const v = data?.[field];
    if (typeof v === "string" && containsEmoji(v)) {
      issues.push(emojiIssue(module, `${block.type} block (${field})`, baseLoc));
    }
  }

  if (block.type === "quiz") {
    const quiz = block.data as QuizBlockData;
    if (Array.isArray(quiz.questions)) {
      quiz.questions.forEach((q) => {
        if (containsEmoji(q.question)) {
          issues.push(
            emojiIssue(module, "question prompt", {
              moduleId: module.id,
              blockId: block.id,
              questionId: q.id,
            })
          );
        }
        if (Array.isArray(q.options)) {
          q.options.forEach((opt, i) => {
            if (typeof opt === "string" && containsEmoji(opt)) {
              issues.push(
                emojiIssue(module, `option ${i + 1}`, {
                  moduleId: module.id,
                  blockId: block.id,
                  questionId: q.id,
                  optionIndex: i,
                })
              );
            }
          });
        }
        if (typeof q.explanation === "string" && containsEmoji(q.explanation)) {
          issues.push(
            emojiIssue(module, "explanation", {
              moduleId: module.id,
              blockId: block.id,
              questionId: q.id,
            })
          );
        }
      });
    }
  }
}

/**
 * Cheap emoji-presence test using the Extended_Pictographic property.
 * @param {unknown} text Value to inspect; non-strings return false.
 * @return {boolean} True if `text` contains at least one emoji character.
 */
function containsEmoji(text: unknown): boolean {
  if (typeof text !== "string" || text.length === 0) return false;
  return EMOJI_REGEX.test(text);
}

/**
 * Builds a BLOCKING emoji issue with a consistent message and remediation.
 * @param {Module} module Parent module (unused but kept for symmetry).
 * @param {string} locationLabel Human-readable location for the message.
 * @param {object} loc Location pointer.
 * @return {ValidationIssue} The constructed issue.
 */
function emojiIssue(
  module: Module,
  locationLabel: string,
  loc: ValidationIssue["location"]
): ValidationIssue {
  return {
    checkId: "EMOJI_IN_CONTENT",
    severity: "BLOCKING",
    message: `Emoji found in ${locationLabel}.`,
    remediation:
      "Remove the emoji. Per Brand Guide §0 Rule 1, emoji must not appear in " +
      "learner-visible content. Use a Lucide icon in the UI layer if iconography " +
      "is needed.",
    location: loc,
  };
}
