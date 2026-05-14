import type { ValidationCheck, ValidationIssue } from "../types";
import { getAllQuestions } from "../utils/quizTraversal";
import { stripHtml, wordCount } from "../utils/textNormalize";

const CONTENT_BLOCK_TYPES = new Set(["heading", "text"]);

export const contentLengthStatistics: ValidationCheck = {
  id: "CONTENT_LENGTH_STATISTICS",
  severity: "INFORMATIONAL",
  title: "Content length statistics",
  description: "Word counts and a Flesch reading-ease estimate for the module reading.",
  run: (module) => {
    const blocks = module.blocks.filter((b) => CONTENT_BLOCK_TYPES.has(b.type));
    const blockTexts = blocks.map((b) => stripHtml(String((b.data as Record<string, unknown>)?.content ?? "")));
    const totalWords = blockTexts.reduce((sum, t) => sum + wordCount(t), 0);
    const avgWordsPerBlock = blocks.length === 0 ? 0 : Math.round(totalWords / blocks.length);
    const questionCount = getAllQuestions(module).length;
    const flesch = computeFlesch(blockTexts.join(" "));

    const fleschText = flesch ?? "n/a";
    const issue: ValidationIssue = {
      checkId: "CONTENT_LENGTH_STATISTICS",
      severity: "INFORMATIONAL",
      message:
        `${totalWords} words across ${blocks.length} content block(s); ` +
        `${questionCount} question(s); Flesch reading ease ${fleschText}.`,
      remediation: "No action required. Use these numbers to calibrate length and reading level.",
      location: { moduleId: module.id },
      context: {
        totalWords,
        avgWordsPerBlock,
        contentBlocks: blocks.length,
        questionCount,
        fleschReadingEase: flesch,
      },
    };
    return [issue];
  },
};

/**
 * Flesch Reading Ease — higher is easier. ~60–70 is "plain English".
 * Returns null if the text is too short to compute meaningfully.
 * @param {string} text Source text.
 * @return {number | null} Reading-ease score, or null if undecidable.
 */
function computeFlesch(text: string): number | null {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  const sentences = clean.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length < 20 || sentences === 0) return null;
  const syllables = words.reduce((sum, w) => sum + estimateSyllables(w), 0);
  const score =
    206.835 - 1.015 * (words.length / sentences) - 84.6 * (syllables / words.length);
  return Math.round(score * 10) / 10;
}

/**
 * Coarse syllable estimator using vowel-group heuristics. Good enough for
 * Flesch calibration; not perfect English phonology.
 * @param {string} word A single word.
 * @return {number} Estimated syllable count (minimum 1 for non-empty input).
 */
function estimateSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  const groups = w.match(/[aeiouy]+/g);
  let count = groups ? groups.length : 1;
  if (w.endsWith("e") && count > 1) count -= 1;
  return Math.max(1, count);
}
