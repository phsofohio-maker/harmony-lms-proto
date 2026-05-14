/**
 * Validation Panel — live authoring feedback.
 *
 * Mounted in the Module Builder. Runs the deterministic validator against
 * the in-progress module on every change (debounced) and renders the issue
 * list grouped by severity. Non-blocking: authors can ignore it and keep
 * editing. The publish gate runs server-side and is the actual enforcement.
 *
 * @module components/ui/ValidationPanel
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Info,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../../utils';
import type { Course, Module } from '../../functions/src/types';
import type { GlossaryTerm } from '../../services/glossaryService';
import {
  runValidation,
  type ValidationIssue,
  type ValidationReport,
  type ValidationSeverity,
} from '../../services/moduleValidation';

interface ValidationPanelProps {
  module: Module;
  course: Course | null;
  glossaryTerms: GlossaryTerm[];
  onIssueClick?: (issue: ValidationIssue) => void;
}

const SEVERITY_ORDER: ValidationSeverity[] = ['BLOCKING', 'ADVISORY', 'INFORMATIONAL'];

export const ValidationPanel: React.FC<ValidationPanelProps> = ({
  module,
  course,
  glossaryTerms,
  onIssueClick,
}) => {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [openSeverity, setOpenSeverity] = useState<Record<ValidationSeverity, boolean>>({
    BLOCKING: true,
    ADVISORY: false,
    INFORMATIONAL: false,
  });

  // Debounced validation: rerun 400ms after the last edit.
  useEffect(() => {
    if (!course) return;
    const handle = window.setTimeout(() => {
      const r = runValidation(module, { course, glossaryTerms });
      setReport(r);
    }, 400);
    return () => window.clearTimeout(handle);
  }, [module, course, glossaryTerms]);

  const groups = useMemo(() => {
    if (!report) return null;
    const map: Record<ValidationSeverity, ValidationIssue[]> = {
      BLOCKING: [],
      ADVISORY: [],
      INFORMATIONAL: [],
    };
    for (const issue of report.issues) map[issue.severity].push(issue);
    return map;
  }, [report]);

  if (!report || !groups) {
    return (
      <aside className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 text-sm text-gray-500">
        Loading validation…
      </aside>
    );
  }

  const { blocking, advisory, informational, canPublish } = report.summary;

  return (
    <aside className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          {canPublish ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" strokeWidth={1.75} />
          ) : (
            <AlertOctagon className="h-5 w-5 text-red-600" strokeWidth={1.75} />
          )}
          <span className="text-sm font-semibold text-gray-900">
            Content Validation
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <SeverityBadge severity="BLOCKING" count={blocking} />
          <SeverityBadge severity="ADVISORY" count={advisory} />
          <SeverityBadge severity="INFORMATIONAL" count={informational} />
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-gray-400" strokeWidth={1.75} />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" strokeWidth={1.75} />
          )}
        </div>
      </button>

      {!collapsed && (
        <div className="border-t border-gray-100">
          {report.issues.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-500">
              No issues found. This module is ready to publish.
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {SEVERITY_ORDER.map(sev => {
                const issues = groups[sev];
                if (issues.length === 0) return null;
                const open = openSeverity[sev];
                return (
                  <div key={sev}>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenSeverity(prev => ({ ...prev, [sev]: !prev[sev] }))
                      }
                      className="w-full flex items-center justify-between gap-3 px-4 py-2 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <SeverityIcon severity={sev} />
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          {sevLabel(sev)} ({issues.length})
                        </span>
                      </div>
                      {open ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" strokeWidth={1.75} />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" strokeWidth={1.75} />
                      )}
                    </button>
                    {open && (
                      <ul className="pb-2">
                        {issues.map((issue, idx) => (
                          <li key={`${issue.checkId}-${idx}`}>
                            <button
                              type="button"
                              onClick={() => onIssueClick?.(issue)}
                              className={cn(
                                'w-full text-left px-6 py-2 text-xs hover:bg-primary-50 transition-colors',
                                onIssueClick ? 'cursor-pointer' : 'cursor-default'
                              )}
                            >
                              <p className="font-medium text-gray-900">{issue.message}</p>
                              <p className="text-gray-500 mt-0.5">{issue.remediation}</p>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </aside>
  );
};

function SeverityBadge({
  severity,
  count,
}: {
  severity: ValidationSeverity;
  count: number;
}) {
  const styles: Record<ValidationSeverity, string> = {
    BLOCKING: 'bg-red-50 text-red-700 border-red-100',
    ADVISORY: 'bg-amber-50 text-amber-700 border-amber-100',
    INFORMATIONAL: 'bg-sky-50 text-sky-700 border-sky-100',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium',
        styles[severity],
        count === 0 && 'opacity-50'
      )}
    >
      {count} {sevLabel(severity).toLowerCase()}
    </span>
  );
}

function SeverityIcon({ severity }: { severity: ValidationSeverity }) {
  if (severity === 'BLOCKING') {
    return <AlertOctagon className="h-4 w-4 text-red-600" strokeWidth={1.75} />;
  }
  if (severity === 'ADVISORY') {
    return <AlertTriangle className="h-4 w-4 text-amber-600" strokeWidth={1.75} />;
  }
  return <Info className="h-4 w-4 text-sky-600" strokeWidth={1.75} />;
}

function sevLabel(s: ValidationSeverity): string {
  if (s === 'BLOCKING') return 'Blocking';
  if (s === 'ADVISORY') return 'Advisory';
  return 'Info';
}
