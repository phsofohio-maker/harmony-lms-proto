/**
 * Dashboard Page
 * 
 * Main landing page showing compliance overview and assigned courses.
 * Now fetches real data from Firestore.
 * 
 * @module pages/Dashboard
 */

import React, { useState, useEffect } from 'react';
import { User, Module, Course, Enrollment } from '../functions/src/types';
import { useCourses } from '../hooks/useCourses';
import { useUserTranscript } from '../hooks/useCourseGrades';
import { useUserEnrollments } from '../hooks/useUserEnrollments';
import { usePageLoadTracking } from '../hooks/usePageLoadTracking';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { GradeSummaryCard } from '../components/grades/GradeSummaryCard';
import {
  Clock,
  AlertTriangle,
  PlayCircle,
  Award,
  AlertCircle,
  BookOpen,
  Plus,
  RefreshCw,
  GraduationCap,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../utils';
import {
  getLastActiveModuleProgress,
  getCourseProgress,
  ModuleProgressRecord,
} from '../services/progressService';
import { getModules } from '../services/courseService';
import { checkAvailability } from '../utils/availabilityUtils';

type AssignmentUrgency = 'overdue' | 'due_soon' | 'normal';

interface AssignmentCard {
  enrollment: Enrollment;
  course: Course;
  modules: Module[];
  availableModuleCount: number;
  totalModuleCount: number;
  nextModuleToComplete: Module | null;
  nextModuleProgress: ModuleProgressRecord | null;
  urgency: AssignmentUrgency;
  deadlineMessage: string | null;
  moduleProgressLine: string | null;
}

function classifyUrgency(
  course: Course,
  enrollment: Enrollment
): { urgency: AssignmentUrgency; deadlineMessage: string | null } {
  const check = checkAvailability(course.availability);

  if (check.status === 'closed' && enrollment.status !== 'completed') {
    return {
      urgency: 'overdue',
      deadlineMessage: `Overdue — closed ${check.closesAt!.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })}`,
    };
  }

  if (check.closesAt) {
    const daysRemaining = Math.ceil(
      (check.closesAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysRemaining <= 7 && daysRemaining > 0) {
      return {
        urgency: 'due_soon',
        deadlineMessage:
          daysRemaining === 1 ? 'Due tomorrow' : `Due in ${daysRemaining} days`,
      };
    }
  }

  return { urgency: 'normal', deadlineMessage: null };
}

function findNextModule(
  modules: Module[],
  courseProgressRecords: ModuleProgressRecord[]
): Module | null {
  const completedModuleIds = new Set(
    courseProgressRecords.filter((p) => p.isComplete).map((p) => p.moduleId)
  );

  for (const mod of modules) {
    if (completedModuleIds.has(mod.id)) continue;
    const modAvail = checkAvailability(mod.availability);
    if (modAvail.status === 'available') return mod;
  }

  return null;
}

interface DashboardProps {
  user: User;
  onNavigate: (path: string, context?: Record<string, any>) => void;
}

// Relative time formatting
const formatRelativeTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs} hour${diffHrs > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return date.toLocaleDateString();
};

interface AssignmentCardComponentProps {
  card: AssignmentCard;
  onNavigate: (path: string, context?: Record<string, any>) => void;
}

const AssignmentCardComponent: React.FC<AssignmentCardComponentProps> = ({ card, onNavigate }) => {
  const {
    enrollment,
    course,
    urgency,
    deadlineMessage,
    moduleProgressLine,
    nextModuleToComplete,
    availableModuleCount,
    totalModuleCount,
  } = card;

  const isOverdue = urgency === 'overdue';
  const isDueSoon = urgency === 'due_soon';

  return (
    <div
      className={cn(
        'bg-white rounded-lg border p-5 transition-all',
        isOverdue
          ? 'border-red-200 border-l-4 border-l-red-400'
          : isDueSoon
          ? 'border-amber-200 border-l-4 border-l-amber-400'
          : 'border-gray-200 hover:border-primary-300 hover:shadow-sm'
      )}
    >
      <h3 className="font-bold text-gray-900 mb-2 line-clamp-1">{course.title}</h3>

      {deadlineMessage && (
        <div
          className={cn(
            'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full mb-3',
            isOverdue ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
          )}
        >
          <Clock className="h-3 w-3" />
          {deadlineMessage}
        </div>
      )}

      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-500">Progress</span>
          <span className="font-medium text-gray-700">{enrollment.progress}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full transition-all rounded-full',
              isOverdue ? 'bg-red-400' : isDueSoon ? 'bg-amber-400' : 'bg-primary-500'
            )}
            style={{ width: `${enrollment.progress}%` }}
          />
        </div>
      </div>

      {moduleProgressLine && (
        <p className="text-xs text-gray-600 mb-1 line-clamp-1 font-medium">
          {moduleProgressLine}
        </p>
      )}

      {availableModuleCount < totalModuleCount && totalModuleCount > 0 && (
        <p className="text-xs text-gray-400 mb-3">
          {availableModuleCount} of {totalModuleCount} modules available
        </p>
      )}

      {card.nextModuleProgress?.updatedAt && (
        <p className="text-xs text-gray-400 mb-3">
          {formatRelativeTime(card.nextModuleProgress.updatedAt)}
        </p>
      )}

      <div className="flex gap-2">
        {nextModuleToComplete ? (
          <Button
            size="sm"
            className="flex-1"
            onClick={() =>
              onNavigate('/player', {
                courseId: enrollment.courseId,
                moduleId: nextModuleToComplete.id,
                courseCategory: course.category,
              })
            }
          >
            {enrollment.progress > 0 ? 'Continue' : 'Start'}
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        ) : (
          <Button
            size="sm"
            className="flex-1"
            onClick={() => onNavigate('/course', { courseId: enrollment.courseId })}
          >
            <PlayCircle className="h-3 w-3 mr-1" />
            View Course
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => onNavigate('/course', { courseId: enrollment.courseId })}
        >
          Details
        </Button>
      </div>
    </div>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({ user, onNavigate }) => {
  usePageLoadTracking('dashboard');
  const { hasRole } = useAuth();
  const { courses, isLoading, error, refetch } = useCourses();
  const { courseGrades, isLoading: gradesLoading } = useUserTranscript();
  const { enrollments, isLoading: enrollmentsLoading } = useUserEnrollments();

  const [assignmentCards, setAssignmentCards] = useState<AssignmentCard[]>([]);

  const canAuthor = hasRole(['admin', 'content_author']);

  // Active (in-progress) enrollments
  const activeEnrollments = enrollments.filter(e =>
    e.status === 'in_progress' || e.status === 'not_started' || e.status === 'needs_review'
  );

  useEffect(() => {
    if (!user?.uid || activeEnrollments.length === 0) {
      setAssignmentCards([]);
      return;
    }

    const buildCards = async () => {
      const cards: AssignmentCard[] = [];

      await Promise.all(
        activeEnrollments.map(async (enrollment) => {
          const course = courses.find((c) => c.id === enrollment.courseId);
          if (!course) return;

          try {
            const [modules, lastProgress, courseProgress] = await Promise.all([
              getModules(enrollment.courseId),
              getLastActiveModuleProgress(user.uid, enrollment.courseId),
              getCourseProgress(user.uid, enrollment.courseId),
            ]);

            const { urgency, deadlineMessage } = classifyUrgency(course, enrollment);
            const nextModule = findNextModule(modules, courseProgress);

            const availableModuleCount = modules.filter((m) => {
              const avail = checkAvailability(m.availability);
              return avail.status === 'available';
            }).length;

            const nextModuleIndex = nextModule
              ? modules.findIndex((m) => m.id === nextModule.id)
              : -1;

            const moduleProgressLine =
              nextModule && nextModuleIndex >= 0
                ? `Module ${nextModuleIndex + 1} of ${modules.length} · ${nextModule.title}`
                : null;

            cards.push({
              enrollment,
              course,
              modules,
              availableModuleCount,
              totalModuleCount: modules.length,
              nextModuleToComplete: nextModule,
              nextModuleProgress: lastProgress,
              urgency,
              deadlineMessage,
              moduleProgressLine,
            });
          } catch {
            cards.push({
              enrollment,
              course,
              modules: [],
              availableModuleCount: 0,
              totalModuleCount: 0,
              nextModuleToComplete: null,
              nextModuleProgress: null,
              urgency: 'normal',
              deadlineMessage: null,
              moduleProgressLine: null,
            });
          }
        })
      );

      const urgencyOrder: Record<AssignmentUrgency, number> = {
        overdue: 0,
        due_soon: 1,
        normal: 2,
      };
      cards.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

      setAssignmentCards(cards);
    };

    buildCards();
  }, [user?.uid, activeEnrollments.length, courses]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user.displayName}
          </h1>
          <p className="text-gray-500 mt-2">
            Here is your compliance overview for {new Date().toLocaleDateString()}
          </p>
        </div>
        {canAuthor && (
          <Button onClick={() => onNavigate('/builder')}>
            <Plus className="h-4 w-4 mr-2" />
            New Module
          </Button>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-primary-50 flex items-center justify-center text-primary-700">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Pending Courses</p>
            <p className="text-2xl font-bold text-gray-900">
              {isLoading ? '—' : courses.filter((c) => c.status !== 'archived').length}
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-primary-50 flex items-center justify-center text-primary-700">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">CE Credits Earned</p>
            <p className="text-2xl font-bold text-gray-900">0.0</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Compliance Alerts</p>
            <p className="text-2xl font-bold text-gray-900">0</p>
          </div>
        </div>
      </div>

      {/* Action Required (overdue + due_soon) */}
      {(() => {
        const urgentCards = assignmentCards.filter(
          (c) => c.urgency === 'overdue' || c.urgency === 'due_soon'
        );
        if (urgentCards.length === 0) return null;

        return (
          <div className="mb-10">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Action Required
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {urgentCards.map((card) => (
                <AssignmentCardComponent
                  key={card.enrollment.id}
                  card={card}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        );
      })()}

      {/* In Progress (normal urgency, progress > 0) */}
      {(() => {
        const inProgressCards = assignmentCards.filter(
          (c) => c.urgency === 'normal' && c.enrollment.progress > 0
        );
        if (inProgressCards.length === 0) return null;

        return (
          <div className="mb-10">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <PlayCircle className="h-4 w-4 text-primary-500" />
              In Progress
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inProgressCards.map((card) => (
                <AssignmentCardComponent
                  key={card.enrollment.id}
                  card={card}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        );
      })()}

      {/* Not Started (normal urgency, progress === 0) */}
      {(() => {
        const notStartedCards = assignmentCards.filter(
          (c) => c.urgency === 'normal' && c.enrollment.progress === 0
        );
        if (notStartedCards.length === 0) return null;

        return (
          <div className="mb-10">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-gray-400" />
              Not Started
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {notStartedCards.map((card) => (
                <AssignmentCardComponent
                  key={card.enrollment.id}
                  card={card}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        );
      })()}

      {/* Grade Summary Cards */}
      {courseGrades.length > 0 && (
        <div className="mb-10">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary-500" />
            Your Course Grades
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courseGrades.map(grade => {
              const course = courses.find(c => c.id === grade.courseId);
              return (
                <GradeSummaryCard
                  key={`${grade.userId}_${grade.courseId}`}
                  courseGrade={grade}
                  courseTitle={course?.title || 'Unknown Course'}
                  onClick={() => onNavigate('/my-grades')}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Course List Section */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">
            {canAuthor ? 'All Courses' : 'Assigned Training'}
          </h2>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={refetch}
              disabled={isLoading}
            >
              <RefreshCw className={cn('h-4 w-4 mr-1', isLoading && 'animate-spin')} />
              Refresh
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('/courses')}>
              View All
            </Button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-800">Failed to load courses</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-lg border border-gray-200 h-64 animate-pulse"
              >
                <div className="h-32 bg-gray-100" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : courses.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
            <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium mb-2">No courses available</p>
            <p className="text-sm text-gray-400 mb-6">
              {canAuthor
                ? 'Create your first course to get started'
                : 'Courses will appear here when assigned'}
            </p>
            {canAuthor && (
              <Button onClick={() => onNavigate('/builder')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Course
              </Button>
            )}
          </div>
        ) : (
          /* Course Cards */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <div
                key={course.id}
                className="group bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:shadow-sm active:translate-y-0 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                onClick={() => onNavigate('/course', { courseId: course.id })}
              >
                {/* Thumbnail */}
                <div className="h-32 bg-gray-100 relative overflow-hidden">
                  {course.thumbnailUrl ? (
                    <img
                      src={course.thumbnailUrl}
                      alt={course.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary-800">
                      <BookOpen className="h-8 w-8 text-white/50" />
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur-sm border border-white/30 text-white">
                      {course.category}
                    </span>
                    {course.status === 'draft' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/80 text-white">
                        Draft
                      </span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-bold text-gray-900 mb-1 line-clamp-1 group-hover:text-primary-600 transition-colors">
                    {course.title}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2 min-h-[40px]">
                    {course.description || 'No description'}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        {course.modules?.length || 0} modules
                      </span>
                      <span className="flex items-center gap-1">
                        <Award className="h-3 w-3" />
                        {course.ceCredits} CE
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate('/course', { courseId: course.id });
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <PlayCircle className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};