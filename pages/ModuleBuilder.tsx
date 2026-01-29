import React, { useState, useEffect } from 'react';
import { Course, Module, ContentBlock, BlockType } from '../types';
import { MOCK_COURSES } from '../services/mockData';
import { auditService } from '../services/auditService';
import { Button } from '../components/ui/Button';
import { BlockEditor } from '../components/builder/BlockEditor';
import { Plus, Save, Eye, ArrowLeft, Loader2, Check, AlertTriangle } from 'lucide-react';
import { generateId } from '../utils';

interface ModuleBuilderProps {
  courseId?: string;
  moduleId?: string;
  userUid: string;
  onBack: () => void;
}

export const ModuleBuilder: React.FC<ModuleBuilderProps> = ({ courseId, moduleId, userUid, onBack }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [activeModule, setActiveModule] = useState<Module | null>(null);

  // Mock Loading
  useEffect(() => {
    // In real app, fetch from Firestore
    const course = MOCK_COURSES[0];
    const module = course.modules[0];
    // Deep copy to avoid reference issues in mock data
    setActiveModule(JSON.parse(JSON.stringify(module)));
  }, [courseId, moduleId]);

  const handleAddBlock = (type: BlockType, variant?: string) => {
    if (!activeModule) return;
    setIsSaved(false);

    const newBlock: ContentBlock = {
      id: generateId(),
      moduleId: activeModule.id,
      type,
      order: activeModule.blocks.length,
      required: true,
      data: { content: '' }
    };

    if (type === 'quiz') {
      newBlock.data = { title: 'New Assessment', questions: [], passingScore: 80 };
    }
    
    // Preset data for Callouts
    if (variant === 'callout') {
        newBlock.data = { content: 'Enter alert content...', variant: 'callout-warning' };
    }

    setActiveModule({
      ...activeModule,
      blocks: [...activeModule.blocks, newBlock]
    });
  };

  const handleUpdateBlock = (blockId: string, data: any) => {
    if (!activeModule) return;
    setIsSaved(false);
    
    const updatedBlocks = activeModule.blocks.map(b => 
      b.id === blockId ? { ...b, data } : b
    );
    setActiveModule({ ...activeModule, blocks: updatedBlocks });
  };

  const handleDeleteBlock = (blockId: string) => {
    if (!activeModule) return;
    setIsSaved(false);
    
    const updatedBlocks = activeModule.blocks.filter(b => b.id !== blockId);
    setActiveModule({ ...activeModule, blocks: updatedBlocks });
  };

  const handleSave = async () => {
    if (!activeModule) return;
    setIsLoading(true);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Audit Log
    auditService.logAction(
      userUid, 
      'Admin User', 
      'MODULE_UPDATE', 
      activeModule.id, 
      `Updated module content with ${activeModule.blocks.length} blocks.`
    );

    setIsLoading(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  if (!activeModule) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Builder Toolbar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-slate-500 hover:text-slate-800">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900">{activeModule.title}</h1>
            <p className="text-xs text-slate-500 flex items-center gap-2">
                <span className="bg-green-100 text-green-700 px-1.5 rounded-sm uppercase font-bold text-[10px] tracking-wide">Draft</span>
                Last edited just now
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => alert("Preview Mode would launch here")}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button onClick={handleSave} isLoading={isLoading} disabled={isSaved}>
            {isSaved ? <Check className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {isSaved ? 'Saved' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-8 pb-32">
          
          {/* Module Settings Header */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-8">
            <label className="block text-sm font-semibold text-slate-700 mb-1">Module Title</label>
            <input 
              value={activeModule.title}
              onChange={(e) => {
                  setActiveModule({...activeModule, title: e.target.value});
                  setIsSaved(false);
              }}
              className="text-2xl font-bold text-slate-900 w-full border-none focus:ring-0 px-0 placeholder:text-slate-300 bg-white"
              placeholder="Enter module title..."
            />
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-6">
                <div>
                     <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Passing Score</label>
                     <div className="flex items-center">
                        <input type="number" value={activeModule.passingScore} className="w-16 border rounded p-1 text-sm font-bold bg-white text-slate-900" readOnly />
                        <span className="ml-1 text-sm text-slate-500">%</span>
                     </div>
                </div>
                <div>
                     <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Est. Duration</label>
                     <div className="flex items-center">
                        <input type="number" value={activeModule.estimatedMinutes} className="w-16 border rounded p-1 text-sm font-bold bg-white text-slate-900" readOnly />
                        <span className="ml-1 text-sm text-slate-500">min</span>
                     </div>
                </div>
            </div>
          </div>

          {/* Block List */}
          <div className="space-y-4">
            {activeModule.blocks.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/50">
                    <p className="text-slate-500 mb-2">This module has no content yet.</p>
                    <p className="text-sm text-slate-400">Add a block below to get started.</p>
                </div>
            ) : (
                activeModule.blocks.map(block => (
                    <BlockEditor 
                        key={block.id} 
                        block={block} 
                        onChange={handleUpdateBlock}
                        onDelete={handleDeleteBlock}
                    />
                ))
            )}
          </div>

          {/* Add Block Menu */}
          <div className="mt-8 flex justify-center">
            <div className="bg-white p-1.5 rounded-full shadow-lg border border-slate-200 flex gap-2 overflow-x-auto max-w-full">
                {[
                    { type: 'heading', label: 'Heading' },
                    { type: 'text', label: 'Text' },
                    { type: 'image', label: 'Image' },
                    { type: 'video', label: 'Video' },
                    { type: 'quiz', label: 'Quiz' },
                ].map((item) => (
                    <button
                        key={item.type}
                        onClick={() => handleAddBlock(item.type as BlockType)}
                        className="px-4 py-2 rounded-full hover:bg-slate-100 text-sm font-medium text-slate-700 flex items-center gap-2 transition-colors whitespace-nowrap"
                    >
                        <Plus className="h-3 w-3 text-slate-400" />
                        {item.label}
                    </button>
                ))}
                
                {/* Special Clinical Alert Button */}
                <div className="w-px bg-slate-200 mx-1 my-2"></div>
                <button
                    onClick={() => handleAddBlock('text', 'callout')}
                    className="px-4 py-2 rounded-full hover:bg-amber-50 text-sm font-medium text-amber-700 flex items-center gap-2 transition-colors whitespace-nowrap"
                >
                    <AlertTriangle className="h-3 w-3" />
                    Clinical Alert
                </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};