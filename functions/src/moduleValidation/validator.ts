/**
 * Module Content Validator — orchestrator.
 *
 * Pure function. Runs every registered check against a module + context and
 * returns a structured report. No I/O. Same code runs client-side (live
 * authoring panel) and server-side (Cloud Function publish gate).
 *
 * @module services/moduleValidation/validator
 */

import type { Module } from "../types";
import { CHECKS } from "./registry";
import type { ValidationContext, ValidationIssue, ValidationReport } from "./types";

const VALIDATOR_VERSION = "1.0.0" as const;

/**
 * Runs every registered check against `module` + `context` and returns a
 * structured report. Pure function: no I/O, no side effects. Wrap each check
 * in try/catch so a single buggy check cannot crash the run.
 * @param {Module} module The module under validation.
 * @param {ValidationContext} context Parent course + glossary terms.
 * @return {ValidationReport} Issue list, summary counts, and a canPublish flag.
 */
export function runValidation(
  module: Module,
  context: ValidationContext
): ValidationReport {
  const issues: ValidationIssue[] = [];

  for (const check of CHECKS) {
    try {
      const checkIssues = check.run(module, context);
      if (Array.isArray(checkIssues) && checkIssues.length) {
        issues.push(...checkIssues);
      }
    } catch (err) {
      // A bug in one check must not crash the validator. Log and continue.
      console.error(`[validator] check ${check.id} threw:`, err);
    }
  }

  const summary = {
    blocking: issues.filter((i) => i.severity === "BLOCKING").length,
    advisory: issues.filter((i) => i.severity === "ADVISORY").length,
    informational: issues.filter((i) => i.severity === "INFORMATIONAL").length,
    canPublish: issues.every((i) => i.severity !== "BLOCKING"),
  };

  return {
    moduleId: module.id,
    validatedAt: new Date().toISOString(),
    validatorVersion: VALIDATOR_VERSION,
    issues,
    summary,
  };
}
