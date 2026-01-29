import React from 'react';
import { BlockType, ContentBlock, QuizBlockData, TextBlockData, ImageBlockData, VideoBlockData } from '../../types';
import { 
  Trash2, GripVertical, CheckSquare, Image as ImageIcon, 
  Type, Video, Hash, Bold, Italic, List, Link as LinkIcon,
  AlertTriangle, Info, AlertOctagon, FileText
} from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../utils';

interface BlockEditorProps {
  block: ContentBlock;
  onChange: (id: string, data: any) => void;
  onDelete: (id: string) => void;
}

export const BlockEditor: React.FC<BlockEditorProps> = ({ block, onChange, onDelete }) => {
  
  // Generic handler for text inputs
  const handleChange = (field: string, value: any) => {
    onChange(block.id, { ...block.data, [field]: value });
  };

  const renderRichTextToolbar = () => (
    <div className="flex items-center gap-1 p-2 border-b border-slate-200 bg-slate-50 rounded-t-md">
      <button className="p-1.5 hover:bg-slate-200 rounded text-slate-600" title="Bold"><Bold className="h-4 w-4" /></button>
      <button className="p-1.5 hover:bg-slate-200 rounded text-slate-600" title="Italic"><Italic className="h-4 w-4" /></button>
      <div className="w-px h-4 bg-slate-300 mx-1"></div>
      <button className="p-1.5 hover:bg-slate-200 rounded text-slate-600" title="List"><List className="h-4 w-4" /></button>
      <button className="p-1.5 hover:bg-slate-200 rounded text-slate-600" title="Link"><LinkIcon className="h-4 w-4" /></button>
    </div>
  );

  const renderContent = () => {
    switch (block.type) {
      case 'heading':
        return (
          <div className="space-y-2">
            <input 
              type="text" 
              className="w-full px-0 py-2 text-2xl font-bold border-b-2 border-slate-100 focus:border-brand-500 outline-none bg-transparent placeholder:text-slate-300 text-slate-900"
              value={(block.data as TextBlockData).content || ''}
              onChange={(e) => handleChange('content', e.target.value)}
              placeholder="Heading Title"
            />
          </div>
        );
      
      case 'text':
        const textData = block.data as TextBlockData;
        const currentVariant = textData.variant || 'paragraph';
        
        return (
          <div className="space-y-3">
             {/* Variant Selector */}
             <div className="flex gap-2">
                {[
                  { id: 'paragraph', icon: FileText, label: 'Text', color: 'bg-slate-100 text-slate-700' },
                  { id: 'callout-info', icon: Info, label: 'Info', color: 'bg-blue-100 text-blue-700' },
                  { id: 'callout-warning', icon: AlertTriangle, label: 'Warning', color: 'bg-amber-100 text-amber-700' },
                  { id: 'callout-critical', icon: AlertOctagon, label: 'Critical', color: 'bg-red-100 text-red-700' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => handleChange('variant', opt.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                      currentVariant === opt.id ? opt.color : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    <opt.icon className="h-3 w-3" />
                    {opt.label}
                  </button>
                ))}
             </div>

             <div className={cn(
                "rounded-md border transition-colors bg-white",
                currentVariant === 'callout-info' && "border-l-4 border-l-blue-500 border-slate-200",
                currentVariant === 'callout-warning' && "border-l-4 border-l-amber-500 border-slate-200",
                currentVariant === 'callout-critical' && "border-l-4 border-l-red-500 border-slate-200",
                currentVariant === 'paragraph' && "border-slate-300 focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500"
             )}>
                {renderRichTextToolbar()}
                <textarea 
                  className="w-full p-4 min-h-[120px] outline-none resize-y rounded-b-md text-slate-700 text-sm leading-relaxed bg-white"
                  value={textData.content || ''}
                  onChange={(e) => handleChange('content', e.target.value)}
                  placeholder="Start typing your content here..."
                />
             </div>
          </div>
        );

      case 'image':
        const imgData = block.data as ImageBlockData;
        return (
          <div className="space-y-4">
             <div className="p-6 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 text-center hover:bg-slate-100 transition-colors cursor-pointer group">
                {imgData.url ? (
                  <div className="relative">
                     <img src={imgData.url} alt="Preview" className="max-h-64 mx-auto rounded shadow-sm" />
                     <button 
                        onClick={() => handleChange('url', '')}
                        className="absolute top-2 right-2 bg-white p-1 rounded-full shadow hover:text-red-600"
                     >
                        <Trash2 className="h-4 w-4" />
                     </button>
                  </div>
                ) : (
                  <div className="py-4">
                    <div className="mx-auto h-12 w-12 text-slate-300 group-hover:text-brand-500 transition-colors mb-2">
                       <ImageIcon className="h-full w-full" />
                    </div>
                    <p className="text-sm font-medium text-slate-700">Click to upload or drag and drop</p>
                    <p className="text-xs text-slate-500 mt-1">SVG, PNG, JPG or GIF (max. 5MB)</p>
                    <input 
                       type="text" 
                       placeholder="Or paste image URL..." 
                       className="mt-4 w-full max-w-sm text-sm p-2 border rounded text-center bg-white"
                       onChange={(e) => handleChange('url', e.target.value)}
                    />
                  </div>
                )}
             </div>
             
             <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Caption</label>
                   <input 
                      className="w-full text-sm p-2 border border-slate-300 rounded focus:ring-1 focus:ring-brand-500 outline-none bg-white text-slate-900" 
                      placeholder="Visible below image"
                      value={imgData.caption || ''}
                      onChange={(e) => handleChange('caption', e.target.value)}
                   />
                </div>
                <div>
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                      Alt Text
                      <span className="text-brand-600 text-[9px] bg-brand-50 px-1 rounded border border-brand-100">REQUIRED</span>
                   </label>
                   <input 
                      className="w-full text-sm p-2 border border-slate-300 rounded focus:ring-1 focus:ring-brand-500 outline-none bg-white text-slate-900" 
                      placeholder="Describe image for screen readers"
                      value={imgData.altText || ''}
                      onChange={(e) => handleChange('altText', e.target.value)}
                   />
                </div>
             </div>
          </div>
        );

      case 'video':
        const vidData = block.data as VideoBlockData;
        return (
          <div className="space-y-4">
             <div className="grid grid-cols-12 gap-4">
                <div className="col-span-8">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Video Title</label>
                    <input 
                        type="text" 
                        className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-brand-500 outline-none bg-white text-slate-900"
                        value={vidData.title || ''}
                        onChange={(e) => handleChange('title', e.target.value)}
                    />
                </div>
                <div className="col-span-4">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Duration (Min)</label>
                    <input 
                        type="number" 
                        className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-brand-500 outline-none bg-white text-slate-900"
                        value={vidData.duration ? vidData.duration / 60 : 0}
                        onChange={(e) => handleChange('duration', parseInt(e.target.value) * 60)}
                    />
                </div>
             </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Embed URL</label>
              <input 
                type="text" 
                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-brand-500 outline-none font-mono text-sm text-brand-600 bg-slate-50"
                value={vidData.url || ''}
                onChange={(e) => handleChange('url', e.target.value)}
                placeholder="https://www.youtube.com/embed/..."
              />
            </div>
            <div>
               <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                 Transcript / Summary
                 <span className="ml-2 text-slate-400 font-normal normal-case italic">(Recommended for compliance)</span>
               </label>
               <textarea 
                  className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-brand-500 outline-none text-sm h-20 bg-white text-slate-900"
                  placeholder="Paste video transcript here..."
                  value={vidData.transcript || ''}
                  onChange={(e) => handleChange('transcript', e.target.value)}
               />
            </div>
          </div>
        );

      case 'quiz':
        const quizData = block.data as QuizBlockData;
        return (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-brand-50 to-white p-4 rounded border border-brand-100 flex justify-between items-center">
               <div>
                  <h4 className="text-sm font-bold text-brand-900">Assessment Configuration</h4>
                  <p className="text-xs text-brand-600">Configure passing requirements for this block</p>
               </div>
               <div className="flex items-center gap-2">
                 <span className="text-xs font-semibold text-slate-600 uppercase">Pass Score:</span>
                 <input 
                   type="number"
                   className="w-16 p-1 text-sm border border-brand-200 rounded text-center font-bold bg-white text-slate-900"
                   value={quizData.passingScore || 80}
                   onChange={(e) => handleChange('passingScore', parseInt(e.target.value))}
                 />
                 <span className="text-sm font-bold text-slate-400">%</span>
               </div>
            </div>
            
            <div className="space-y-3">
              {(quizData.questions || []).map((q, qIdx) => (
                <div key={q.id || qIdx} className="border border-slate-200 p-4 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex gap-3 mb-3">
                    <div className="h-6 w-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold mt-1">
                      {qIdx + 1}
                    </div>
                    <textarea 
                      className="flex-1 text-sm font-medium border-none focus:ring-0 p-0 resize-none bg-transparent placeholder:text-slate-400 text-slate-900"
                      rows={2}
                      value={q.question}
                      placeholder="Enter the question here..."
                      onChange={(e) => {
                        const newQuestions = [...(quizData.questions || [])];
                        newQuestions[qIdx] = { ...q, question: e.target.value };
                        handleChange('questions', newQuestions);
                      }}
                    />
                  </div>
                  
                  <div className="pl-9 space-y-2">
                      {q.options.map((opt, oIdx) => (
                          <div key={oIdx} className={cn(
                             "flex items-center gap-3 p-2 rounded border transition-colors",
                             q.correctAnswer === oIdx ? "bg-green-50 border-green-200" : "bg-white border-transparent hover:bg-slate-50"
                          )}>
                               <input 
                                  type="radio" 
                                  name={`q-${block.id}-${qIdx}`}
                                  checked={q.correctAnswer === oIdx}
                                  onChange={() => {
                                      const newQuestions = [...(quizData.questions || [])];
                                      newQuestions[qIdx] = { ...q, correctAnswer: oIdx };
                                      handleChange('questions', newQuestions);
                                  }}
                                  className="text-green-600 focus:ring-green-500"
                               />
                               <input 
                                  className="text-sm w-full border-none bg-transparent focus:ring-0 text-slate-700"
                                  value={opt}
                                  onChange={(e) => {
                                      const newQuestions = [...(quizData.questions || [])];
                                      const newOptions = [...q.options];
                                      newOptions[oIdx] = e.target.value;
                                      newQuestions[qIdx] = { ...q, options: newOptions };
                                      handleChange('questions', newQuestions);
                                  }}
                               />
                               {q.correctAnswer === oIdx && <span className="text-xs font-bold text-green-600 px-2">CORRECT</span>}
                          </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
            
            <Button 
                size="sm" 
                variant="outline" 
                className="w-full border-dashed border-slate-300 text-slate-500 hover:border-brand-400 hover:text-brand-600"
                onClick={() => {
                    const newQ = { id: Math.random().toString(), question: '', options: ['Option A', 'Option B', 'Option C'], correctAnswer: 0, points: 10 };
                    handleChange('questions', [...(quizData.questions || []), newQ]);
                }}
            >
                + Add Question
            </Button>
          </div>
        );

      default:
        return <div className="text-slate-400 italic p-4">Editor not implemented for {block.type}</div>;
    }
  };

  const Icon = {
    heading: Type,
    text: Hash,
    image: ImageIcon,
    video: Video,
    quiz: CheckSquare,
    checklist: CheckSquare
  }[block.type] || Hash;

  return (
    <div className="group border border-slate-200 rounded-lg bg-white shadow-sm transition-all hover:border-brand-300 hover:shadow-md">
      {/* Block Handle */}
      <div className="flex items-center justify-between p-2 pl-4 bg-white border-b border-slate-100 rounded-t-lg">
        <div className="flex items-center gap-3">
            <div className="cursor-move p-1 hover:bg-slate-100 rounded text-slate-300 hover:text-slate-500">
               <GripVertical className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-2">
               <Icon className="h-3 w-3" />
               {block.type}
            </span>
        </div>
        <div className="flex items-center gap-2">
            <button className="text-xs text-slate-400 hover:text-brand-600 px-2 py-1 hover:bg-slate-50 rounded">Settings</button>
            <button onClick={() => onDelete(block.id)} className="p-1.5 text-slate-400 hover:text-critical-500 hover:bg-critical-50 rounded transition-colors">
                <Trash2 className="h-4 w-4" />
            </button>
        </div>
      </div>
      
      <div className="p-5">
        {renderContent()}
      </div>
    </div>
  );
};