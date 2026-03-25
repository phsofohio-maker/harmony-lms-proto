import React from 'react';
import { ContentBlock } from '../../functions/src/types';
import { cn } from '../../utils';

interface BlockSettingsPanelProps {
  block: ContentBlock;
  isOpen: boolean;
  onClose: () => void;
  onChange: (blockId: string, updates: any) => void;
}

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
    {children}
  </label>
);

const Toggle: React.FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <label className="flex items-center gap-2 cursor-pointer">
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors',
        checked ? 'bg-primary-600' : 'bg-gray-300'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform mt-0.5',
          checked ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'
        )}
      />
    </button>
    <span className="text-sm text-gray-700">{label}</span>
  </label>
);

export const BlockSettingsPanel: React.FC<BlockSettingsPanelProps> = ({
  block,
  isOpen,
  onClose,
  onChange,
}) => {
  if (!isOpen) return null;

  const data = block.data as any;

  const updateData = (updates: Record<string, any>) => {
    onChange(block.id, { ...data, ...updates });
  };

  const renderQuizSettings = () => (
    <div className="space-y-4">
      <div>
        <Label>Passing Score (%)</Label>
        <input
          type="number"
          value={data.passingScore ?? 80}
          onChange={(e) => updateData({ passingScore: parseInt(e.target.value) || 80 })}
          min={0}
          max={100}
          className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      <Toggle
        label="Shuffle questions"
        checked={data.shuffleQuestions ?? false}
        onChange={(v) => updateData({ shuffleQuestions: v })}
      />
      <Toggle
        label="Show correct answers after submit"
        checked={data.showCorrectAnswers ?? false}
        onChange={(v) => updateData({ showCorrectAnswers: v })}
      />
    </div>
  );

  const renderImageSettings = () => (
    <div className="space-y-4">
      <div>
        <Label>Alt Text</Label>
        <input
          type="text"
          value={data.altText ?? ''}
          onChange={(e) => updateData({ altText: e.target.value })}
          placeholder="Describe the image for accessibility"
          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      <div>
        <Label>Caption</Label>
        <input
          type="text"
          value={data.caption ?? ''}
          onChange={(e) => updateData({ caption: e.target.value })}
          placeholder="Optional caption below image"
          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      <div>
        <Label>Display Width</Label>
        <select
          value={data.maxWidth ?? 'full'}
          onChange={(e) => updateData({ maxWidth: e.target.value })}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="full">Full width</option>
          <option value="medium">Medium (66%)</option>
          <option value="small">Small (50%)</option>
        </select>
      </div>
    </div>
  );

  const renderVideoSettings = () => (
    <div className="space-y-4">
      <Toggle
        label="Autoplay"
        checked={data.autoplay ?? false}
        onChange={(v) => updateData({ autoplay: v })}
      />
      <Toggle
        label="Show transcript"
        checked={data.showTranscript ?? false}
        onChange={(v) => updateData({ showTranscript: v })}
      />
    </div>
  );

  const renderNoSettings = () => (
    <p className="text-sm text-gray-400 italic">No additional settings for this block type.</p>
  );

  const renderSettings = () => {
    switch (block.type) {
      case 'quiz':
        return renderQuizSettings();
      case 'image':
        return renderImageSettings();
      case 'video':
        return renderVideoSettings();
      default:
        return renderNoSettings();
    }
  };

  return (
    <div className="bg-gray-50 border-t border-gray-100 p-4 transition-all duration-200">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          Block Settings
        </h4>
      </div>
      {renderSettings()}
    </div>
  );
};
