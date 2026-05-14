/**
 * Export Course Dialog
 *
 * Confirmation modal for exporting a course to Markdown.
 * Triggers the browser download via Blob + anchor click.
 *
 * @module components/ui/ExportCourseDialog
 */

import React, { useState } from 'react';
import { Download, X, FileText } from 'lucide-react';
import { Button } from './Button';
import { Course } from '../../functions/src/types';
import { exportCourseToMarkdown } from '../../services/courseExportService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';

interface ExportCourseDialogProps {
  course: Course | null;
  onClose: () => void;
}

export const ExportCourseDialog: React.FC<ExportCourseDialogProps> = ({ course, onClose }) => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  if (!course) return null;

  const handleExport = async () => {
    if (!user || isExporting) return;
    setIsExporting(true);
    try {
      const result = await exportCourseToMarkdown({
        courseId: course.id,
        actorId: user.uid,
        actorName: user.displayName,
      });

      const blob = new Blob([result.markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addToast({ type: 'success', title: 'Course exported', message: result.filename });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      addToast({ type: 'error', title: 'Export failed', message });
      console.error('Failed to export course:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const moduleCount = course.modules?.length ?? 0;

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-gray-200 shadow-lg p-6 w-[480px] max-w-full animate-in zoom-in duration-200">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary-600" strokeWidth={1.75} />
            <h3 className="text-lg font-bold text-gray-900">Export Course</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="mb-5 space-y-3">
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">
              Course
            </div>
            <div className="font-bold text-gray-900">{course.title}</div>
            <div className="text-xs text-gray-500 mt-1">
              {moduleCount} {moduleCount === 1 ? 'module' : 'modules'} ·{' '}
              {course.status === 'published' ? 'Published' : 'Draft'}
            </div>
          </div>

          <p className="text-sm text-gray-600">
            Generates a Markdown file containing all module content, questions, answer keys,
            and glossary terms. The export is recorded in the audit log.
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 gap-1.5 bg-primary-800 hover:bg-primary-700 text-white"
            onClick={handleExport}
            isLoading={isExporting}
          >
            <Download className="h-[18px] w-[18px]" strokeWidth={1.75} />
            Download Markdown
          </Button>
        </div>
      </div>
    </div>
  );
};
