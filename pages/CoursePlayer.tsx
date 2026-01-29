import React, { useState, useEffect } from 'react';
import { MOCK_COURSES } from '../services/mockData';
import { Module, QuizBlockData } from '../types';
import { BlockRenderer } from '../components/player/BlockRenderer';
import { auditService } from '../services/auditService';
import { Button } from '../components/ui/Button';
import { ArrowLeft, CheckCircle, AlertCircle, Award } from 'lucide-react';
import { cn } from '../utils';

interface CoursePlayerProps {
  userUid: string;
  onBack: () => void;
}

export const CoursePlayer: React.FC<CoursePlayerProps> = ({ userUid, onBack }) => {
  // Mock loading specific course module
  const moduleData: Module = MOCK_COURSES[0].modules[0];

  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [grade, setGrade] = useState<{ score: number; passed: boolean } | null>(null);

  const handleQuizAnswer = (blockId: string, questionIndex: number, optionIndex: number) => {
    if (isSubmitted) return; // Freeze after submission

    setAnswers(prev => {
      const blockAnswers = prev[blockId] ? [...prev[blockId]] : [];
      blockAnswers[questionIndex] = optionIndex;
      return { ...prev, [blockId]: blockAnswers };
    });
  };

  const calculateGrade = () => {
    let totalPoints = 0;
    let earnedPoints = 0;
    let hasQuiz = false;

    moduleData.blocks.forEach(block => {
      if (block.type === 'quiz') {
        hasQuiz = true;
        const quiz = block.data as QuizBlockData;
        const blockAnswers = answers[block.id] || [];
        
        quiz.questions.forEach((q, idx) => {
          totalPoints += 1; // Simplified: 1 point per question
          if (blockAnswers[idx] === q.correctAnswer) {
            earnedPoints += 1;
          }
        });
      }
    });

    if (!hasQuiz) return { score: 100, passed: true };

    const score = Math.round((earnedPoints / totalPoints) * 100);
    return { score, passed: score >= moduleData.passingScore };
  };

  const handleSubmit = () => {
    const result = calculateGrade();
    setGrade(result);
    setIsSubmitted(true);

    if (result.passed) {
      auditService.logAction(
        userUid,
        'Staff User',
        'GRADE_ENTRY',
        moduleData.id,
        `Completed module "${moduleData.title}" with score: ${result.score}%`
      );
    } else {
        auditService.logAction(
            userUid,
            'Staff User',
            'GRADE_ENTRY',
            moduleData.id,
            `Failed module "${moduleData.title}" with score: ${result.score}%`
        );
    }
  };

  // Check if all questions in all quizzes are answered
  const canSubmit = moduleData.blocks.every(block => {
    if (block.type !== 'quiz') return true;
    const quiz = block.data as QuizBlockData;
    const blockAnswers = answers[block.id] || [];
    // Ensure we have an answer for every question index
    return quiz.questions.every((_, idx) => blockAnswers[idx] !== undefined);
  });

  if (grade && grade.passed) {
      return (
          <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center border border-slate-200">
                  <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Award className="h-10 w-10 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Module Completed!</h2>
                  <p className="text-slate-500 mb-6">
                      You have successfully passed <strong>{moduleData.title}</strong> with a score of <span className="text-green-600 font-bold">{grade.score}%</span>.
                  </p>
                  <div className="bg-slate-50 rounded border border-slate-200 p-4 mb-6 text-xs text-slate-500">
                      Certificate ID: {Math.random().toString(36).substr(2, 12).toUpperCase()} <br/>
                      Verified by Harmony Audit Trail
                  </div>
                  <Button onClick={onBack} className="w-full">Return to Catalog</Button>
              </div>
          </div>
      )
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Player Header */}
      <div className="h-16 border-b border-slate-200 flex items-center justify-between px-6 bg-white sticky top-0 z-20">
        <div className="flex items-center gap-4">
           <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
             <ArrowLeft className="h-5 w-5" />
           </button>
           <div>
             <h1 className="text-sm font-bold text-slate-900 line-clamp-1">{moduleData.title}</h1>
             <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                In Progress
             </div>
           </div>
        </div>
        <div className="hidden md:flex items-center gap-2">
           <div className="text-right mr-2">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Progress</p>
             <p className="text-xs font-bold text-brand-600">Step {Object.keys(answers).length > 0 ? '2' : '1'} of {moduleData.blocks.length}</p>
           </div>
           <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
             <div className="h-full bg-brand-500 w-1/3"></div>
           </div>
        </div>
      </div>

      {/* Content Scroll Area */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        <div className="max-w-3xl mx-auto py-12 px-6">
           <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 md:p-12 min-h-[80vh]">
              {grade && !grade.passed && (
                  <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-800">
                      <AlertCircle className="h-5 w-5" />
                      <div>
                          <p className="font-bold text-sm">Assignment Failed</p>
                          <p className="text-xs">You scored {grade.score}%. A minimum of {moduleData.passingScore}% is required. Please review and try again.</p>
                      </div>
                      <Button size="sm" variant="outline" className="ml-auto bg-white border-red-200 text-red-700 hover:bg-red-50" onClick={() => { setIsSubmitted(false); setGrade(null); }}>Retry</Button>
                  </div>
              )}

              {moduleData.blocks.map(block => (
                <BlockRenderer 
                  key={block.id} 
                  block={block} 
                  onQuizAnswer={handleQuizAnswer}
                  answers={answers}
                />
              ))}

              <div className="mt-16 pt-8 border-t border-slate-100 flex flex-col items-center gap-4">
                 <p className="text-sm text-slate-500 italic">
                    By submitting, you acknowledge that you have reviewed all training materials above.
                 </p>
                 <Button 
                   size="lg" 
                   className="w-full md:w-auto px-12" 
                   onClick={handleSubmit}
                   disabled={!canSubmit || isSubmitted}
                 >
                   {isSubmitted ? 'Grading...' : 'Complete & Submit Module'}
                 </Button>
                 {!canSubmit && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Please answer all knowledge check questions to proceed.
                    </p>
                 )}
              </div>
           </div>
           
           <div className="text-center mt-8 text-xs text-slate-400">
              Harmony Health LMS &bull; v1.2.0 &bull; Secure Audit Logging Enabled
           </div>
        </div>
      </div>
    </div>
  );
};