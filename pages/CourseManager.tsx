import React, { useState } from 'react';
import { Course } from '../functions/src/types';
import { Settings, FileEdit, Trash2, Plus, Search, Layers, AlertCircle, Globe, Lock } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { cn } from '../utils';

interface CourseManagerProps {
  courses: Course[];
  onEditCurriculum: (courseId: string, moduleId: string) => void;
  onDeleteCourse: (courseId: string) => void;
  onUpdateMetadata: (course: Course) => void;
  onCreateCourse: () => void;
  onTogglePublish: (id: string) => void;
}

export const CourseManager: React.FC<CourseManagerProps> = ({ 
  courses, 
  onEditCurriculum, 
  onDeleteCourse,
  onUpdateMetadata,
  onCreateCourse,
  onTogglePublish
}) => {
  const [filter, setFilter] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    onDeleteCourse(id);
    setConfirmDeleteId(null);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in duration-200">
            <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4 mx-auto">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-center text-slate-900 mb-2">Delete Course?</h3>
            <p className="text-sm text-slate-500 text-center mb-6">
              This action cannot be undone. All modules and data for this course will be permanently removed.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
              <Button variant="danger" className="flex-1" onClick={() => handleDelete(confirmDeleteId)}>Delete</Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="h-6 w-6 text-brand-600" />
            Curriculum Manager
          </h1>
          <p className="text-slate-500 mt-1">Design courses, configure CE credits, and manage module publishing.</p>
        </div>
        <Button onClick={onCreateCourse} className="gap-2">
          <Plus className="h-4 w-4" />
          Create New Course
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by title or category..." 
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>

        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-semibold text-slate-700">Course Detail</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Category</th>
              <th className="px-6 py-4 font-semibold text-slate-700">CE Units</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Status</th>
              <th className="px-6 py-4 font-semibold text-slate-700 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {courses.filter(c => c.title.toLowerCase().includes(filter.toLowerCase())).map(course => (
              <tr key={course.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <img src={course.thumbnailUrl} className="h-10 w-16 rounded object-cover bg-slate-100" />
                    <div>
                      <div className="font-bold text-slate-900">{course.title}</div>
                      <div className="text-xs text-slate-500">{course.modules.length} Modules</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded capitalize">
                    {course.category.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 font-mono font-bold text-brand-700">
                  {course.ceCredits.toFixed(1)}
                </td>
                <td className="px-6 py-4">
                  {course.status === 'published' ? (
                    <span className="flex items-center gap-1.5 text-green-600 font-medium text-xs">
                      <Globe className="h-3 w-3" />
                      Published
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-slate-400 font-medium text-xs">
                      <Lock className="h-3 w-3" />
                      Draft
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => onTogglePublish(course.id)}
                      className={cn("gap-1.5", course.status === 'published' ? "text-amber-600 hover:text-amber-700" : "text-green-600 hover:text-green-700")}
                    >
                      {course.status === 'published' ? 'Unpublish' : 'Publish'}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => onEditCurriculum(course.id, course.modules[0]?.id)}
                      className="gap-1.5"
                    >
                      <FileEdit className="h-3.5 w-3.5" />
                      Curriculum
                    </Button>
                    <button 
                      onClick={() => setConfirmDeleteId(course.id)}
                      className="p-2 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};