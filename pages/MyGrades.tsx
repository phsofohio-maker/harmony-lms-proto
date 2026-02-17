
import React from 'react';
import { Enrollment, Course, User } from '../functions/src/types';
// Added Clock to imports
import { GraduationCap, Award, FileText, CheckCircle2, Download, Printer, Clock } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { formatDate } from '../utils';

interface MyGradesProps {
  user: User;
  enrollments: Enrollment[];
  courses: Course[];
}

export const MyGrades: React.FC<MyGradesProps> = ({ user, enrollments, courses }) => {
  const completed = enrollments.filter(e => e.status === 'completed');
  const inProgress = enrollments.filter(e => e.status === 'in_progress' || e.status === 'needs_review');

  const getCourse = (id: string) => courses.find(c => c.id === id);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2 leading-none">
            <GraduationCap className="h-8 w-8 text-brand-600" />
            Educational Transcript
          </h1>
          <p className="text-slate-500 mt-2">Official record of completed training and continuing education units.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2">
                <Printer className="h-4 w-4" />
                Print Transcript
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Export PDF
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-brand-600 p-6 rounded-2xl text-white shadow-lg relative overflow-hidden">
            <Award className="absolute -bottom-4 -right-4 h-24 w-24 opacity-20 rotate-12 text-white" />
            <p className="text-brand-100 text-xs font-bold uppercase tracking-widest mb-1">Total Credits</p>
            <p className="text-3xl font-bold">{completed.reduce((acc, e) => acc + (getCourse(e.courseId)?.ceCredits || 0), 0).toFixed(1)} <span className="text-lg opacity-80">CEU</span></p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Courses Passed</p>
            <p className="text-3xl font-bold text-slate-900">{completed.length}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Compliance Rate</p>
            <p className="text-3xl font-bold text-slate-900">{user.complianceScore || 100}%</p>
        </div>
      </div>

      <div className="space-y-12">
        <section>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Completed Curricula
          </h3>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
            {completed.length === 0 ? (
                <div className="p-12 text-center text-slate-400 italic">No completed courses yet.</div>
            ) : (
                completed.map(e => {
                    const c = getCourse(e.courseId);
                    return (
                        <div key={e.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 bg-green-50 rounded-lg flex items-center justify-center text-green-600">
                                    <FileText className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900">{c?.title}</p>
                                    <p className="text-xs text-slate-500">Earned: {formatDate(e.lastAccessedAt)} • {c?.ceCredits} CE Credits</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Grade</p>
                                    <p className="text-sm font-bold text-green-600">{e.score}%</p>
                                </div>
                                <Button variant="ghost" size="sm" className="text-brand-600">Certificate</Button>
                            </div>
                        </div>
                    );
                })
            )}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            In Progress & Awaiting Review
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {inProgress.length === 0 ? (
                <div className="text-slate-400 italic text-sm">No active enrollments.</div>
            ) : (
                inProgress.map(e => {
                    const c = getCourse(e.courseId);
                    return (
                        <div key={e.id} className="bg-white p-5 rounded-xl border border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden">
                                    <img src={c?.thumbnailUrl} className="w-full h-full object-cover" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900">{c?.title}</p>
                                    <p className="text-xs text-slate-500">Status: {e.status === 'needs_review' ? 'Awaiting Instructor' : 'In Progress'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="w-32">
                                    <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                                        <span>PROGRESS</span>
                                        <span>{e.progress}%</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-brand-500" style={{ width: `${e.progress}%` }} />
                                    </div>
                                </div>
                                <Button size="sm" variant="outline">Resume</Button>
                            </div>
                        </div>
                    );
                })
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
