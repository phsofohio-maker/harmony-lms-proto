import React, { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '../../utils';

interface TableGridPickerProps {
  onInsert: (rows: number, cols: number) => void;
  onClose: () => void;
}

const MAX_ROWS = 6;
const MAX_COLS = 6;

export const TableGridPicker: React.FC<TableGridPickerProps> = ({
  onInsert,
  onClose,
}) => {
  const [hoverRow, setHoverRow] = useState(0);
  const [hoverCol, setHoverCol] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCellClick = useCallback(() => {
    if (hoverRow > 0 && hoverCol > 0) {
      onInsert(hoverRow, hoverCol);
    }
  }, [hoverRow, hoverCol, onInsert]);

  return (
    <div
      ref={pickerRef}
      className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50"
    >
      <div className="text-xs text-gray-500 mb-2 text-center font-medium">
        {hoverRow > 0 && hoverCol > 0
          ? `${hoverRow} × ${hoverCol} table`
          : 'Select table size'}
      </div>

      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${MAX_COLS}, 1fr)`,
        }}
      >
        {Array.from({ length: MAX_ROWS * MAX_COLS }).map((_, index) => {
          const row = Math.floor(index / MAX_COLS) + 1;
          const col = (index % MAX_COLS) + 1;
          const isHighlighted = row <= hoverRow && col <= hoverCol;

          return (
            <button
              key={index}
              type="button"
              className={cn(
                'w-5 h-5 border rounded-sm transition-colors',
                isHighlighted
                  ? 'bg-primary-100 border-primary-400'
                  : 'bg-white border-gray-300 hover:border-gray-400'
              )}
              onMouseEnter={() => {
                setHoverRow(row);
                setHoverCol(col);
              }}
              onClick={handleCellClick}
              aria-label={`Insert ${row} by ${col} table`}
            />
          );
        })}
      </div>
    </div>
  );
};
