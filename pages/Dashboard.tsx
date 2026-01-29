import React from 'react';
import { User, Course } from '../types';
import { MOCK_COURSES } from '../services/mockData';
import { Clock, CheckCircle, AlertTriangle, PlayCircle, Award } from 'lucide-react';
import { Button } from '../components/ui/Button';

interface DashboardProps {
  user: User;
  onNavigate: (path: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onNavigate }) => {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Welcome back, {user.displayName}</h1>
        <p className="text-slate-500 mt-2">Here is your compliance overview for {new Date().toLocaleDateString()}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                <Clock className="h-6 w-6" />
            </div>
            <div>
                <p className="text-sm text-slate-500 font-medium">Pending Courses</p>
                <p className="text-2xl font-bold text-slate-900">2</p>
            </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                <Award className="h-6 w-6" />
            </div>
            <div>
                <p className="text-sm text-slate-500 font-medium">CE Credits Earned</p>
                <p className="text-2xl font-bold text-slate-900">12.5</p>
            </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
                <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
                <p className="text-sm text-slate-500 font-medium">Compliance Alerts</p>
                <p className="text-2xl font-bold text-slate-900">0</p>
            </div>
        </div>
      </div>

      {/* Course List */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800">Assigned Training</h2>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('/courses')}>View All</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {MOCK_COURSES.map(course => (
                <div key={course.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full">
                    <div className="h-32 bg-slate-200 relative">
                        <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
                        <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded text-xs font-bold text-slate-700 uppercase">
                            {course.category}
                        </div>
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                        <h3 className="font-bold text-lg text-slate-900 mb-2">{course.title}</h3>
                        <p className="text-sm text-slate-500 mb-4 flex-1">{course.description}</p>
                        
                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100">
                             <div className="flex items-center gap-1 text-xs text-slate-500">
                                <Award className="h-3 w-3" />
                                <span>{course.ceCredits} CE Units</span>
                             </div>
                             <Button size="sm" onClick={() => onNavigate(`/courses/${course.id}`)}>
                                Start Module
                             </Button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};