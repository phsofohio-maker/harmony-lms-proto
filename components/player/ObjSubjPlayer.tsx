/**
 * Objective vs. Subjective Validator Player
 *
 * Interactive exercise where learners categorize clinical data items
 * as "Objective" or "Subjective." Common hospice documentation training
 * competency check.
 *
 * User answers are stored as Record<itemId, 'objective' | 'subjective'>
 * via the onQuizAnswer callback.
 *
 * @module components/player/ObjSubjPlayer
 */

import React from 'react';
import { ObjSubjValidatorBlockData } from '../../functions/src/types';
import { cn } from '../../utils';
import { Eye, MessageSquare, CheckCircle } from 'lucide-react';

interface ObjSubjPlayerProps {
  blockId: string;
  data: ObjSubjValidatorBlockData;
  onAnswer: (blockId: string, questionIndex: number, answer: any) => void;
  existingAnswers?: Record<string, string>;
}

export const ObjSubjPlayer: React.FC<ObjSubjPlayerProps> = ({
  blockId,
  data,
  onAnswer,
  existingAnswers,
}) => {
  const categorizations: Record<string, string> = existingAnswers || {};
  const items = data.items || [];

  const handleSelect = (itemId: string, category: 'objective' | 'subjective') => {
    const updated = { ...categorizations, [itemId]: category };
    onAnswer(blockId, 0, updated);
  };

  const answeredCount = Object.keys(categorizations).length;
  const allAnswered = items.length > 0 && answeredCount === items.length;

  return (
    <div className="my-8 border border-[var(--color-brand-border)] rounded-xl overflow-hidden bg-white shadow-sm">
      <div className="bg-[var(--color-surface-muted)] px-6 py-4 border-b border-[var(--color-brand-border)] flex justify-between items-center">
        <h3 className="font-bold text-[var(--color-brand-dark)] flex items-center gap-2">
          <Eye className="h-5 w-5 text-[var(--color-brand-primary)]" />
          {data.title || 'Objective vs. Subjective Exercise'}
        </h3>
        <span className="text-xs font-bold text-[var(--color-brand-primary)] bg-white px-2 py-1 rounded border border-[var(--color-brand-border)]">
          {answeredCount}/{items.length} classified &middot; {data.pointsPerItem}pts each
        </span>
      </div>

      <div className="p-6">
        <p className="text-xs text-slate-500 italic mb-6">
          Classify each clinical data item as <strong>Objective</strong> (measurable, observable) or <strong>Subjective</strong> (patient-reported, opinion-based).
        </p>

        <div className="space-y-3">
          {items.map((item, idx) => {
            const selected = categorizations[item.id];

            return (
              <div
                key={item.id}
                className={cn(
                  "border rounded-lg p-4 transition-all",
                  selected ? "border-[var(--color-brand-border)] bg-[var(--color-surface-muted)]/50" : "border-slate-200"
                )}
              >
                <div className="flex items-start gap-4">
                  <span className="text-xs font-bold text-slate-400 mt-1 shrink-0">{idx + 1}.</span>
                  <div className="flex-1">
                    <p className="text-sm text-slate-800 font-medium leading-relaxed mb-3">{item.text}</p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleSelect(item.id, 'objective')}
                        className={cn(
                          "flex-1 py-2.5 px-4 rounded-lg border text-sm font-medium transition-all flex items-center justify-center gap-2",
                          selected === 'objective'
                            ? "bg-[#EDF5F8] border-[var(--color-status-info)] text-[var(--color-status-info)] ring-1 ring-[var(--color-status-info)]"
                            : "bg-white border-slate-200 text-slate-600 hover:border-[var(--color-status-info)] hover:bg-[#EDF5F8]/50"
                        )}
                      >
                        <Eye className="h-4 w-4" />
                        Objective
                        {selected === 'objective' && <CheckCircle className="h-3.5 w-3.5 text-[var(--color-status-info)]" />}
                      </button>
                      <button
                        onClick={() => handleSelect(item.id, 'subjective')}
                        className={cn(
                          "flex-1 py-2.5 px-4 rounded-lg border text-sm font-medium transition-all flex items-center justify-center gap-2",
                          selected === 'subjective'
                            ? "bg-[var(--color-surface-muted)] border-[var(--color-brand-primary)] text-[var(--color-brand-dark)] ring-1 ring-[var(--color-brand-primary)]"
                            : "bg-white border-slate-200 text-slate-600 hover:border-[var(--color-brand-border)] hover:bg-[var(--color-surface-muted)]/50"
                        )}
                      >
                        <MessageSquare className="h-4 w-4" />
                        Subjective
                        {selected === 'subjective' && <CheckCircle className="h-3.5 w-3.5 text-[var(--color-brand-primary)]" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {allAnswered && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-700 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            All items classified. Your answers will be scored on submission.
          </div>
        )}
      </div>
    </div>
  );
};
