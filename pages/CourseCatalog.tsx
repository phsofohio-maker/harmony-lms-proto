import React from 'react';
import { Course } from '../types';
import { MOCK_COURSES } from '../services/mockData';
import { Clock, BookOpen, Award, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/Button';

interface CourseCatalogProps {
  onNavigate: (path: string) => void;
}

export const CourseCatalog: React.FC<CourseCatalogProps> = ({ onNavigate }) => {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Course Catalog</h1>
        <p className="text-slate-500 mt-1">Browse and enroll in available clinical training modules.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MOCK_COURSES.map(course => (
          <div key={course.id} className="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all flex flex-col h-full">
            <div className="h-40 bg-slate-100 relative overflow-hidden">
               <img 
                 src={course.thumbnailUrl} 
                 alt={course.title} 
                 className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
               />
               <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
               <div className="absolute bottom-3 left-3 text-white">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur-sm border border-white/30">
                    {course.category}
                  </span>
               </div>
            </div>
            
            <div className="p-5 flex-1 flex flex-col">
               <h3 className="font-bold text-lg text-slate-900 mb-2 leading-tight">{course.title}</h3>
               <p className="text-sm text-slate-500 mb-4 line-clamp-2 flex-1">{course.description}</p>
               
               <div className="space-y-3 mt-auto">
                  <div className="flex items-center gap-4 text-xs text-slate-500 border-t border-slate-100 pt-3">
                     <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{course.modules.reduce((acc, m) => acc + m.estimatedMinutes, 0)} min</span>
                     </div>
                     <div className="flex items-center gap-1">
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>{course.modules.length} Modules</span>
                     </div>
                     <div className="flex items-center gap-1 text-brand-600 font-medium">
                        <Award className="h-3.5 w-3.5" />
                        <span>{course.ceCredits} CEU</span>
                     </div>
                  </div>
                  
                  <Button 
                    className="w-full justify-between group-hover:bg-brand-700" 
                    onClick={() => onNavigate('/player')}
                  >
                    Start Training
                    <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity -ml-4 group-hover:ml-0" />
                  </Button>
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};