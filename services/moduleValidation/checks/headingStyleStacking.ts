import type { ValidationCheck, ValidationIssue } from "../types";

const HEADING_WITH_BOLD = /<h[1-6][^>]*>[\s\S]*?<(strong|b)[^>]*>[\s\S]*?<\/\1>[\s\S]*?<\/h[1-6]>/i;

export const headingStyleStacking: ValidationCheck = {
  id: "HEADING_STYLE_STACKING",
  severity: "INFORMATIONAL",
  title: "Heading contains redundant bold formatting",
  description:
    "A heading already renders bold; nested <strong> markup is cosmetic noise from paste artifacts.",
  run: (module) => {
    const issues: ValidationIssue[] = [];
    for (const block of module.blocks) {
      if (block.type !== "text" && block.type !== "heading") continue;
      const html = String((block.data as Record<string, unknown>)?.content ?? "");
      if (HEADING_WITH_BOLD.test(html)) {
        issues.push({
          checkId: "HEADING_STYLE_STACKING",
          severity: "INFORMATIONAL",
          message: "A heading in this block contains nested bold formatting.",
          remediation:
            "Headings are already rendered bold. Remove the inner <strong>/<b> tags " +
            "to clean up the markup. Informational only — does not affect publishing.",
          location: { moduleId: module.id, blockId: block.id },
        });
      }
    }
    return issues;
  },
};
