import React, { useState } from 'react';
import { ContentBlock, TextBlockData, VideoBlockData, ImageBlockData, QuizBlockData } from '../../functions/src/types';
import { cn } from '../../utils';
import { Info, AlertTriangle, AlertOctagon, FileText, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';

interface BlockRendererProps {
  block: ContentBlock;
  onQuizAnswer?: (blockId: string, questionIndex: number, optionIndex: number) => void;
  answers?: Record<string, number[]>; // blockId -> array of selected option indices per question
}

export const BlockRenderer: React.FC<BlockRendererProps> = ({ block, onQuizAnswer, answers }) => {
  const [showTranscript, setShowTranscript] = useState(false);

  switch (block.type) {
    case 'heading':
      return (
        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">
          {(block.data as any).content}
        </h2>
      );

    case 'text':
      const textData = block.data as TextBlockData;
      const variant = textData.variant || 'paragraph';

      if (variant === 'paragraph') {
        return <div className="prose prose-slate max-w-none text-slate-700 mb-6 whitespace-pre-wrap">{textData.content}</div>;
      }

      const styles = {
        'callout-info': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', icon: Info, iconColor: 'text-blue-600' },
        'callout-warning': { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', icon: AlertTriangle, iconColor: 'text-amber-600' },
        'callout-critical': { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900', icon: AlertOctagon, iconColor: 'text-red-600' },
      }[variant];

      if (!styles) return null;
      const Icon = styles.icon;

      return (
        <div className={cn("p-4 rounded-lg border flex gap-4 mb-6", styles.bg, styles.border)}>
          <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", styles.iconColor)} />
          <div className={cn("text-sm leading-relaxed font-medium", styles.text)}>
            {textData.content}
          </div>
        </div>
      );

    case 'image':
      const imgData = block.data as ImageBlockData;
      return (
        <div className="mb-8">
          <figure className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
            <img 
              src={imgData.url} 
              alt={imgData.altText || 'Course image'} 
              className="w-full h-auto max-h-[500px] object-contain mx-auto"
            />
          </figure>
          {imgData.caption && (
            <figcaption className="text-center text-xs text-slate-500 mt-2 font-medium">
              {imgData.caption}
            </figcaption>
          )}
        </div>
      );

    case 'video':
      const vidData = block.data as VideoBlockData;
      return (
        <div className="mb-8">
          <div className="aspect-video w-full rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-black">
            <iframe 
              src={vidData.url} 
              className="w-full h-full" 
              allowFullScreen 
              title={vidData.title}
            />
          </div>
          <div className="flex items-center justify-between mt-3 px-1">
             <span className="text-sm font-bold text-slate-700">{vidData.title}</span>
             {vidData.transcript && (
               <button 
                 onClick={() => setShowTranscript(!showTranscript)}
                 className="text-xs font-medium text-brand-600 flex items-center gap-1 hover:text-brand-800"
               >
                 {showTranscript ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>}
                 {showTranscript ? 'Hide Transcript' : 'Show Transcript'}
               </button>
             )}
          </div>
          {showTranscript && vidData.transcript && (
            <div className="mt-2 p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 leading-relaxed h-32 overflow-y-auto">
              {vidData.transcript}
            </div>
          )}
        </div>
      );

    case 'quiz':
      const quizData = block.data as QuizBlockData;
      const blockAnswers = answers?.[block.id] || [];

      return (
        <div className="my-8 border border-brand-200 rounded-xl overflow-hidden bg-white shadow-sm">
          <div className="bg-brand-50 px-6 py-4 border-b border-brand-100 flex justify-between items-center">
             <h3 className="font-bold text-brand-900 flex items-center gap-2">
               <CheckCircle className="h-5 w-5 text-brand-600" />
               {quizData.title || 'Knowledge Check'}
             </h3>
             <span className="text-xs font-bold text-brand-600 bg-white px-2 py-1 rounded border border-brand-200">
               Pass Score: {quizData.passingScore}%
             </span>
          </div>
          <div className="p-6 space-y-8">
            {(quizData.questions || []).map((q, qIdx) => (
              <div key={qIdx} className="space-y-3">
                <p className="font-medium text-slate-900 text-sm">
                  <span className="text-slate-400 mr-2">{qIdx + 1}.</span>
                  {q.question}
                </p>
                <div className="space-y-2 pl-6">
                  {q.options.map((opt, oIdx) => {
                    const isSelected = blockAnswers[qIdx] === oIdx;
                    return (
                      <label 
                        key={oIdx} 
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                          isSelected 
                            ? "bg-brand-50 border-brand-500 ring-1 ring-brand-500" 
                            : "bg-white border-slate-200 hover:border-brand-300 hover:bg-slate-50"
                        )}
                      >
                        <div className={cn(
                          "h-4 w-4 rounded-full border flex items-center justify-center shrink-0",
                          isSelected ? "border-brand-600 bg-brand-600" : "border-slate-300 bg-white"
                        )}>
                          {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </div>
                        <span className={cn("text-sm", isSelected ? "text-brand-900 font-medium" : "text-slate-600")}>
                          {opt}
                        </span>
                        <input 
                          type="radio" 
                          name={`q-${block.id}-${qIdx}`} 
                          className="hidden"
                          onChange={() => onQuizAnswer?.(block.id, qIdx, oIdx)}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    default:
      return null;
  }
};