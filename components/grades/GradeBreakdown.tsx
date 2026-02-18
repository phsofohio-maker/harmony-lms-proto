/**
 * GradeBreakdown Component
 *
 * Displays the module-by-module breakdown of a course grade.
 * Shows each module's raw score, weight, weighted contribution,
 * critical flag, and pass/fail status.
 *
 * @module components/grades/GradeBreakdown
 */
import React from 'react';
import { CourseGradeCalculation, ModuleScore } from '../../functions/src/types';
import { Shield, CheckCircle, XCircle, Minus } from 'lucide-react';
import { cn } from '../../utils';

interface GradeBreakdownProps {
  calculation: CourseGradeCalculation;
  showWeights?: boolean;
}

const getStatusColor = (passed: boolean | null): string => {
  if (passed === null) return 'text-amber-600 bg-amber-50 border-amber-200';
  return passed ? 'text-green-600 bg-green-50 border-green-200' : 'text-red-600 bg-red-50 border-red-200';
};

const getStatusLabel = (passed: boolean | null): string => {
  if (passed === null) return 'Pending';
  return passed ? 'Passed' : 'Failed';
};

const getScoreDisplay = (score: number | null): string => {
  if (score === null) return '--';
  return `${score}%`;
};

const getWeightedDisplay = (weighted: number | null): string => {
  if (weighted === null) return '--';
  return weighted.toFixed(1);
};

export const GradeBreakdown: React.FC<GradeBreakdownProps> = ({
  calculation,
  showWeights = true,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
        <h3 className="text-white font-bold text-sm">Module Grade Breakdown</h3>
        <span className="text-slate-400 text-xs font-medium">
          {calculation.gradedModules}/{calculation.totalModules} modules graded
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 font-semibold text-slate-700">Module</th>
              <th className="px-6 py-3 font-semibold text-slate-700 text-center">Score</th>
              {showWeights && (
                <>
                  <th className="px-6 py-3 font-semibold text-slate-700 text-center">Weight</th>
                  <th className="px-6 py-3 font-semibold text-slate-700 text-center">Weighted</th>
                </>
              )}
              <th className="px-6 py-3 font-semibold text-slate-700 text-center">Critical</th>
              <th className="px-6 py-3 font-semibold text-slate-700 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {calculation.moduleBreakdown.map((mod: ModuleScore) => (
              <tr
                key={mod.moduleId}
                className={cn(
                  'hover:bg-slate-50/50 transition-colors',
                  mod.isCritical && 'bg-slate-50/30'
                )}
              >
                {/* Module Name */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {mod.isCritical && (
                      <Shield className="h-4 w-4 text-amber-500 shrink-0" />
                    )}
                    <span className="font-medium text-slate-900">{mod.moduleTitle}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Passing: {mod.passingScore}%
                  </p>
                </td>

                {/* Raw Score */}
                <td className="px-6 py-4 text-center">
                  <span className={cn(
                    'font-bold',
                    mod.score === null
                      ? 'text-slate-400'
                      : mod.passed
                        ? 'text-green-600'
                        : mod.passed === false
                          ? 'text-red-600'
                          : 'text-slate-700'
                  )}>
                    {getScoreDisplay(mod.score)}
                  </span>
                </td>

                {/* Weight */}
                {showWeights && (
                  <>
                    <td className="px-6 py-4 text-center text-slate-500 font-mono text-xs">
                      {mod.weight}%
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-xs font-bold text-slate-700">
                      {getWeightedDisplay(mod.weightedScore)}
                    </td>
                  </>
                )}

                {/* Critical Flag */}
                <td className="px-6 py-4 text-center">
                  {mod.isCritical ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                      <Shield className="h-3 w-3" />
                      Required
                    </span>
                  ) : (
                    <Minus className="h-4 w-4 text-slate-300 mx-auto" />
                  )}
                </td>

                {/* Status */}
                <td className="px-6 py-4 text-center">
                  <span className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border',
                    getStatusColor(mod.passed)
                  )}>
                    {mod.passed === null ? (
                      <Minus className="h-3 w-3" />
                    ) : mod.passed ? (
                      <CheckCircle className="h-3 w-3" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    {getStatusLabel(mod.passed)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Overall Score */}
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Overall Score</p>
              <p className={cn(
                'text-2xl font-bold',
                calculation.overallPassed ? 'text-green-600' : 'text-red-600'
              )}>
                {calculation.overallScore}%
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Completion</p>
              <p className="text-lg font-bold text-slate-700">
                {calculation.completionPercent}%
              </p>
            </div>
          </div>

          {/* Critical Modules Status */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Critical Modules</p>
              <p className={cn(
                'text-sm font-bold',
                calculation.allCriticalModulesPassed ? 'text-green-600' : 'text-red-600'
              )}>
                {calculation.criticalModulesPassed}/{calculation.totalCriticalModules} passed
              </p>
            </div>
            <div className={cn(
              'h-10 w-10 rounded-full flex items-center justify-center',
              calculation.allCriticalModulesPassed
                ? 'bg-green-100 text-green-600'
                : 'bg-red-100 text-red-600'
            )}>
              {calculation.allCriticalModulesPassed ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
