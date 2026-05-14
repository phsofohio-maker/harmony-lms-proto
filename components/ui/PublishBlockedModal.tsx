/**
 * Publish Blocked Modal — shown when the Cloud Function refuses to publish.
 *
 * Lists every blocking issue. No "Publish anyway" — the author must fix the
 * issues. Jump-to-issue routes back to ModuleBuilder so the editor can scroll
 * the offending block into view.
 *
 * @module components/ui/PublishBlockedModal
 */

import React from 'react';
import { AlertOctagon, X } from 'lucide-react';
import { Button } from './Button';
import type { ValidationIssue, ValidationReport } from '../../services/moduleValidation';

interface PublishBlockedModalProps {
  report: ValidationReport;
  onClose: () => void;
  onJumpToIssue?: (issue: ValidationIssue) => void;
}

export const PublishBlockedModal: React.FC<PublishBlockedModalProps> = ({
  report,
  onClose,
  onJumpToIssue,
}) => {
  const blocking = report.issues.filter(i => i.severity === 'BLOCKING');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col border-l-4 border-red-600">
        <header className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-100">
          <div className="flex items-start gap-3">
            <AlertOctagon className="h-6 w-6 text-red-600 mt-0.5 shrink-0" strokeWidth={1.75} />
            <div>
              <h2 className="text-lg font-bold text-gray-900">Publish Blocked</h2>
              <p className="text-sm text-gray-600 mt-1">
                {blocking.length} issue{blocking.length === 1 ? '' : 's'} must be resolved before
                this module can be published.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <ul className="space-y-3">
            {blocking.map((issue, idx) => (
              <li
                key={`${issue.checkId}-${idx}`}
                className="border border-red-100 bg-red-50 rounded-md px-4 py-3"
              >
                <p className="text-sm font-semibold text-gray-900">{issue.message}</p>
                <p className="text-sm text-gray-700 mt-1">{issue.remediation}</p>
                {onJumpToIssue && (issue.location.blockId || issue.location.questionId) && (
                  <button
                    type="button"
                    onClick={() => {
                      onJumpToIssue(issue);
                      onClose();
                    }}
                    className="mt-2 text-xs font-medium text-red-700 hover:text-red-900 underline underline-offset-2"
                  >
                    Jump to issue
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        <footer className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Back to editor
          </Button>
        </footer>
      </div>
    </div>
  );
};
