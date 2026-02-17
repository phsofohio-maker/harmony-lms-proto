import React, { useState } from 'react';
import { User, Enrollment, Course } from '../functions/src/types';
import { MOCK_USERS } from '../services/mockData';
import { Users, Search, MoreVertical, ShieldCheck, Mail, PlusCircle, Book } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { cn } from '../utils';

interface UserManagementProps {
  enrollments: Enrollment[];
  onEnroll: (courseId: string, userId: string) => void;
  courses: Course[];
}

export const UserManagement: React.FC<UserManagementProps> = ({ enrollments, onEnroll, courses }) => {
  const [enrollModalUserId, setEnrollModalUserId] = useState<string | null>(null);

  const renderEnrollModal = (userId: string) => {
    const user = MOCK_USERS.find(u => u.uid === userId);
    const userEnrollmentIds = enrollments.filter(e => e.userId === userId).map(e => e.courseId);
    const availableCourses = courses.filter(c => !userEnrollmentIds.includes(c.id));

    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 animate-in zoom-in duration-200">
          <h3 className="text-lg font-bold text-slate-900 mb-2">Enroll Staff Member</h3>
          <p className="text-sm text-slate-500 mb-6">Select a course to assign to {user?.displayName}.</p>
          
          <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
            {availableCourses.length === 0 ? (
                <p className="text-sm text-slate-400 italic text-center py-4">All available courses are already assigned.</p>
            ) : (
                availableCourses.map(course => (
                    <button 
                        key={course.id} 
                        onClick={() => {
                            onEnroll(course.id, userId);
                            setEnrollModalUserId(null);
                        }}
                        className="w-full p-3 rounded-lg border border-slate-200 hover:border-brand-500 hover:bg-brand-50 transition-all text-left flex items-center gap-3"
                    >
                        <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center text-slate-400">
                            <Book className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-900">{course.title}</p>
                            <p className="text-[10px] text-slate-500">{course.category} • {course.ceCredits} CE Credits</p>
                        </div>
                    </button>
                ))
            )}
          </div>

          <div className="flex gap-3 mt-8">
            <Button variant="outline" className="flex-1" onClick={() => setEnrollModalUserId(null)}>Cancel</Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {enrollModalUserId && renderEnrollModal(enrollModalUserId)}

      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-brand-600" />
            Staff Compliance Directory
          </h1>
          <p className="text-slate-500 mt-1">Manage user roles and track organizational training requirements.</p>
        </div>
        <Button>+ Add Staff Member</Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Filter by name, email or department..." 
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            />
          </div>
        </div>

        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-semibold text-slate-700">Staff Member</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Role</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Compliance</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Enrollments</th>
              <th className="px-6 py-4 font-semibold text-slate-700 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {MOCK_USERS.map(user => {
              const userEnrollments = enrollments.filter(e => e.userId === user.uid);
              const compliance = user.role === 'admin' ? 100 : (userEnrollments.filter(e => e.status === 'completed').length / (userEnrollments.length || 1)) * 100;
              
              return (
                <tr key={user.uid} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold">
                        {user.displayName.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{user.displayName}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                      user.role === 'admin' ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                    )}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full rounded-full",
                            compliance >= 90 ? "bg-green-500" : compliance >= 70 ? "bg-amber-500" : "bg-red-500"
                          )} 
                          style={{ width: `${compliance}%` }} 
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-700">{Math.round(compliance)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    <div className="flex items-center gap-1">
                      <ShieldCheck className="h-4 w-4 text-slate-300" />
                      {userEnrollments.length} Active
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-1.5"
                        onClick={() => setEnrollModalUserId(user.uid)}
                      >
                        <PlusCircle className="h-3.5 w-3.5" />
                        Enroll
                      </Button>
                      <button className="p-1 hover:bg-slate-100 rounded">
                        <MoreVertical className="h-4 w-4 text-slate-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};