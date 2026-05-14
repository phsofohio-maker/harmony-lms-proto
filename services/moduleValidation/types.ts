/**
 * Module Validation — Type Definitions
 *
 * Pure type contracts shared by the validator core, every check, the
 * Cloud Function publish gate, and the authoring UI. No runtime code here.
 *
 * Guide 14 — Module Content Validation.
 *
 * @module services/moduleValidation/types
 */

import type { Course, Module } from "../../functions/src/types";

/**
 * Minimal glossary shape the validator needs. Structurally compatible with
 * the full `GlossaryTerm` interface from glossaryService — declared locally
 * so this module has no browser-SDK dependencies and is reusable from
 * Cloud Functions.
 */
export interface ValidatorGlossaryTerm {
  id: string;
  term: string;
}

export type ValidationSeverity = "BLOCKING" | "ADVISORY" | "INFORMATIONAL";

export type ValidationCheckId =
  // BLOCKING
  | "ZERO_QUESTIONS"
  | "ZERO_CONTENT_BLOCKS"
  | "ANSWER_REFERENCES_MISSING_OPTION"
  | "EMPTY_CORRECT_OPTION"
  | "DISTRACTOR_EXACT_DUPLICATE"
  | "EMOJI_IN_CONTENT"
  // ADVISORY
  | "ANSWER_NOT_IN_CONTENT"
  | "DISTRACTOR_PARAPHRASES_CORRECT"
  | "QUESTION_TYPE_IMBALANCE"
  | "LETTER_PREFIX_DUPLICATION"
  | "MISSING_EXPLANATION_ON_INCORRECT"
  | "MISSING_ESTIMATED_DURATION_WHEN_CE"
  | "GLOSSARY_TERM_UNTAGGED"
  // INFORMATIONAL
  | "BLOCK_WITHOUT_QUESTION"
  | "CONTENT_LENGTH_STATISTICS"
  | "HEADING_STYLE_STACKING";

export interface ValidationIssue {
  checkId: ValidationCheckId;
  severity: ValidationSeverity;
  message: string;
  remediation: string;
  location: {
    moduleId: string;
    blockId?: string;
    questionId?: string;
    optionIndex?: number;
  };
  context?: Record<string, unknown>;
}

export interface ValidationReport {
  moduleId: string;
  validatedAt: string;
  validatorVersion: "1.0.0";
  issues: ValidationIssue[];
  summary: {
    blocking: number;
    advisory: number;
    informational: number;
    canPublish: boolean;
  };
}

export interface ValidationContext {
  course: Course;
  glossaryTerms: ValidatorGlossaryTerm[];
}

export interface ValidationCheck {
  id: ValidationCheckId;
  severity: ValidationSeverity;
  title: string;
  description: string;
  run: (module: Module, context: ValidationContext) => ValidationIssue[];
}
