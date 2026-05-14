import type { ValidationCheck, ValidationIssue } from "../types";

export const missingEstimatedDurationWhenCE: ValidationCheck = {
  id: "MISSING_ESTIMATED_DURATION_WHEN_CE",
  severity: "ADVISORY",
  title: "CE-bearing module has zero estimated minutes",
  description:
    "CE credit reporting requires a duration. Zero minutes on a CE-bearing course is a reporting defect.",
  run: (module, context) => {
    const issues: ValidationIssue[] = [];
    const ceCredits = context.course?.ceCredits ?? 0;
    if (ceCredits > 0 && (module.estimatedMinutes ?? 0) === 0) {
      issues.push({
        checkId: "MISSING_ESTIMATED_DURATION_WHEN_CE",
        severity: "ADVISORY",
        message: `Module estimated duration is 0 minutes, but the parent course offers ${ceCredits} CE credit(s).`,
        remediation:
          "Set a realistic duration in minutes. CE reporting and learner pacing both depend on this value.",
        location: { moduleId: module.id },
        context: { ceCredits, estimatedMinutes: module.estimatedMinutes },
      });
    }
    return issues;
  },
};
