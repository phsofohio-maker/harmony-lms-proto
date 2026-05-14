/**
 * Shared traversal helpers for quiz blocks.
 *
 * Quiz questions live at `block.data.questions` (QuizBlockData). The block
 * `data` field is a discriminated union; cast at this seam so checks don't
 * each re-implement the narrowing.
 *
 * @module services/moduleValidation/utils/quizTraversal
 */

import type {
  ContentBlock,
  Module,
  QuizBlockData,
  QuizQuestion,
} from "../../../functions/src/types";

export interface QuizBlockWithData {
  block: ContentBlock;
  data: QuizBlockData;
}

export interface QuestionLocation {
  block: ContentBlock;
  question: QuizQuestion;
}

/**
 * Returns every quiz block in the module paired with its narrowed `QuizBlockData`.
 * Blocks whose data is missing or has no questions array are skipped.
 * @param {Module} module Module to traverse.
 * @return {QuizBlockWithData[]} Paired block + narrowed quiz data.
 */
export function getQuizBlocks(module: Module): QuizBlockWithData[] {
  return module.blocks
    .filter((b) => b.type === "quiz")
    .map((b) => ({ block: b, data: (b.data as QuizBlockData) }))
    .filter(({ data }) => data && Array.isArray(data.questions));
}

/**
 * Flattens all quiz questions across all quiz blocks, preserving the
 * originating block so checks can locate each question.
 * @param {Module} module Module to traverse.
 * @return {QuestionLocation[]} Flat list of `{ block, question }` pairs.
 */
export function getAllQuestions(module: Module): QuestionLocation[] {
  return getQuizBlocks(module).flatMap(({ block, data }) =>
    data.questions.map((question) => ({ block, question }))
  );
}

/**
 * Returns the correct option index for multiple-choice / true-false questions,
 * or `null` for question types whose `correctAnswer` is not a single index.
 * @param {QuizQuestion} q The question to inspect.
 * @return {number | null} The keyed option index, or null when not applicable.
 */
export function getSingleCorrectIndex(q: QuizQuestion): number | null {
  if (q.type === "multiple-choice" || q.type === "true-false") {
    return typeof q.correctAnswer === "number" ? q.correctAnswer : null;
  }
  return null;
}

/**
 * Returns every option index that the question marks as correct, across all
 * relevant question types. Empty array if not applicable.
 * @param {QuizQuestion} q The question to inspect.
 * @return {number[]} Every option index keyed as correct.
 */
export function getCorrectIndices(q: QuizQuestion): number[] {
  if (q.type === "multiple-choice" || q.type === "true-false") {
    return typeof q.correctAnswer === "number" ? [q.correctAnswer] : [];
  }
  if (q.type === "multiple-answer") {
    return Array.isArray(q.correctAnswer) ?
      (q.correctAnswer as unknown[]).filter((v): v is number => typeof v === "number") :
      [];
  }
  return [];
}

/**
 * Returns the human-readable "correct answer text" for a question, for
 * heuristics like answer-in-content. For multiple-choice we return the
 * option text; for fill-blank we return the string answer directly.
 * @param {QuizQuestion} q The question to inspect.
 * @return {string} The plain-text correct answer (may be empty).
 */
export function getCorrectAnswerText(q: QuizQuestion): string {
  const indices = getCorrectIndices(q);
  if (indices.length > 0) {
    return indices
      .map((i) => q.options?.[i])
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .join(" ");
  }
  if (q.type === "fill-blank" && typeof q.correctAnswer === "string") {
    return q.correctAnswer;
  }
  return "";
}
