/**
 * Validation check registry.
 *
 * Imports every check and exposes them as an ordered array. The validator
 * core iterates this array in order; new checks are added with one line.
 *
 * @module services/moduleValidation/registry
 */

import type { ValidationCheck } from "./types";

import { zeroQuestions } from "./checks/zeroQuestions";
import { zeroContentBlocks } from "./checks/zeroContentBlocks";
import { emptyCorrectOption } from "./checks/emptyCorrectOption";
import { answerReferencesMissingOption } from "./checks/answerReferencesMissingOption";
import { distractorExactDuplicate } from "./checks/distractorExactDuplicate";
import { emojiInContent } from "./checks/emojiInContent";

import { letterPrefixDuplication } from "./checks/letterPrefixDuplication";
import { questionTypeImbalance } from "./checks/questionTypeImbalance";
import { missingExplanationOnIncorrect } from "./checks/missingExplanationOnIncorrect";
import { missingEstimatedDurationWhenCE } from "./checks/missingEstimatedDurationWhenCE";
import { glossaryTermUntagged } from "./checks/glossaryTermUntagged";
import { distractorParaphrasesCorrect } from "./checks/distractorParaphrasesCorrect";
import { answerNotInContent } from "./checks/answerNotInContent";

import { blockWithoutQuestion } from "./checks/blockWithoutQuestion";
import { contentLengthStatistics } from "./checks/contentLengthStatistics";
import { headingStyleStacking } from "./checks/headingStyleStacking";

export const CHECKS: ReadonlyArray<ValidationCheck> = [
  // BLOCKING
  zeroQuestions,
  zeroContentBlocks,
  emptyCorrectOption,
  answerReferencesMissingOption,
  distractorExactDuplicate,
  emojiInContent,
  // ADVISORY
  letterPrefixDuplication,
  questionTypeImbalance,
  missingExplanationOnIncorrect,
  missingEstimatedDurationWhenCE,
  glossaryTermUntagged,
  distractorParaphrasesCorrect,
  answerNotInContent,
  // INFORMATIONAL
  blockWithoutQuestion,
  contentLengthStatistics,
  headingStyleStacking,
];
