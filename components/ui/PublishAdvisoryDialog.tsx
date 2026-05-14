/**
 * Publish Advisory Dialog — confirm publish despite advisory warnings.
 *
 * Shown when the local validator finds zero blocking but at least one
 * advisory issue. Author may proceed (override) or cancel and fix.
 *
 * @module components/ui/PublishAdvisoryDialog
 */

import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, X } from 'lucide-react';
import { Button } from './Button';
import type { ValidationIssue } from '../../services/moduleValidation';

interface PublishAdvisoryDialogProps {
  advisoryIssues: ValidationIssue[];
  onCancel: () => void;
  onPublishAnyway: () => void;
  isPublishing?: boolean;
}

export const PublishAdvisoryDialog: React.FC<PublishAdvisoryDialogProps> = ({
  advisoryIssues,
  onCancel,
  onPublishAnyway,
  isPublishing,
}) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-xl w-full max-h-[85vh] flex flex-col">
        <header className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-100">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="h-6 w-6 text-amber-600 mt-0.5 shrink-0"
              strokeWidth={1.75}
            />
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Publish with {advisoryIssues.length} warning
                {advisoryIssues.length === 1 ? '' : 's'}?
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                These are advisory only and will not block publishing, but they may indicate
                content quality issues worth reviewing first.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </header>

        <div className="px-6 py-4 border-b border-gray-100">
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
            )}
            {expanded ? 'Hide' : 'Show'} warning details
          </button>

          {expanded && (
            <ul className="mt-3 space-y-2 max-h-72 overflow-y-auto">
              {advisoryIssues.map((issue, idx) => (
                <li
                  key={`${issue.checkId}-${idx}`}
                  className="border border-amber-100 bg-amber-50 rounded-md px-3 py-2"
                >
                  <p className="text-sm font-medium text-gray-900">{issue.message}</p>
                  <p className="text-xs text-gray-700 mt-0.5">{issue.remediation}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="px-6 py-4 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isPublishing}>
            Cancel
          </Button>
          <Button onClick={onPublishAnyway} isLoading={isPublishing}>
            Publish with warnings
          </Button>
        </footer>
      </div>
    </div>
  );
};
