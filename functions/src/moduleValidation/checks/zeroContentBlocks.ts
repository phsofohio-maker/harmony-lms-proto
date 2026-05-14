import type { ValidationCheck, ValidationIssue } from "../types";

const CONTENT_BLOCK_TYPES = new Set(["heading", "text", "image", "video"]);

export const zeroContentBlocks: ValidationCheck = {
  id: "ZERO_CONTENT_BLOCKS",
  severity: "BLOCKING",
  title: "No content blocks",
  description: "A module with only a quiz tests prior knowledge, not module mastery.",
  run: (module) => {
    const issues: ValidationIssue[] = [];
    const contentBlocks = module.blocks.filter((b) => CONTENT_BLOCK_TYPES.has(b.type));
    if (contentBlocks.length === 0) {
      issues.push({
        checkId: "ZERO_CONTENT_BLOCKS",
        severity: "BLOCKING",
        message: "This module has no content blocks (heading, text, image, or video).",
        remediation:
          "Add at least one content block before the quiz. A quiz without reading material is not audit-defensible.",
        location: { moduleId: module.id },
      });
    }
    return issues;
  },
};
