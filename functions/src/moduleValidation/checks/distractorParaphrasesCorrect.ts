import type { ValidationCheck, ValidationIssue } from "../types";
import { getAllQuestions, getCorrectIndices } from "../utils/quizTraversal";
import { jaccardSimilarity } from "../utils/textNormalize";

const SIMILARITY_THRESHOLD = 0.7;

export const distractorParaphrasesCorrect: ValidationCheck = {
  id: "DISTRACTOR_PARAPHRASES_CORRECT",
  severity: "ADVISORY",
  title: "Distractor closely paraphrases the correct answer",
  description:
    "A wrong option shares most of its words with the correct option, creating learner ambiguity.",
  run: (module) => {
    const issues: ValidationIssue[] = [];
    for (const { block, question } of getAllQuestions(module)) {
      if (!Array.isArray(question.options) || question.options.length < 2) continue;
      const correctSet = new Set(getCorrectIndices(question));
      if (correctSet.size === 0) continue;

      for (const correctIdx of correctSet) {
        const correctText = question.options[correctIdx];
        if (typeof correctText !== "string" || !correctText.trim()) continue;

        question.options.forEach((opt, i) => {
          if (correctSet.has(i)) return;
          if (typeof opt !== "string" || !opt.trim()) return;
          const sim = jaccardSimilarity(correctText, opt);
          if (sim > SIMILARITY_THRESHOLD) {
            const simText = sim.toFixed(2);
            issues.push({
              checkId: "DISTRACTOR_PARAPHRASES_CORRECT",
              severity: "ADVISORY",
              message:
                `Option ${i + 1} closely paraphrases the correct option ` +
                `${correctIdx + 1} (similarity ${simText}).`,
              remediation:
                "Reword this distractor so it is clearly distinguishable from the " +
                "correct answer. Near-duplicates create learner ambiguity even when " +
                "one is technically wrong.",
              location: {
                moduleId: module.id,
                blockId: block.id,
                questionId: question.id,
                optionIndex: i,
              },
              context: { similarity: sim, comparedToIndex: correctIdx },
            });
          }
        });
      }
    }
    return issues;
  },
};
