'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface ShiftBarProps {
  id: string;
  shiftId: number;
  staffId: number;
  startTime: string;
  endTime: string;
  isOvertime: boolean;
  cellWidth: number;
  timeSlots: string[];
  onUpdate: (shiftId: number, startTime: string, endTime: string) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
}

// 時間を分に変換
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// 分を時間文字列に変換
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export function ShiftBar({
  id,
  shiftId,
  staffId,
  startTime,
  endTime,
  isOvertime,
  cellWidth,
  timeSlots,
  onUpdate,
  onResizeStart,
  onResizeEnd,
}: ShiftBarProps) {
  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [tempStartTime, setTempStartTime] = useState(startTime);
  const [tempEndTime, setTempEndTime] = useState(endTime);
  const barRef = useRef<HTMLDivElement>(null);

  // ドラッグ可能設定
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: {
      type: 'shift',
      shiftId,
      staffId,
      startTime,
      endTime,
    },
    disabled: isResizing !== null,
  });

  // 位置計算
  const startIndex = timeSlots.findIndex((t) => t === startTime);
  const endIndex = timeSlots.findIndex((t) => t === endTime);
  const displayStartIndex = timeSlots.findIndex((t) => t === tempStartTime);
  const displayEndIndex = timeSlots.findIndex((t) => t === tempEndTime);

  const left = (isResizing ? displayStartIndex : startIndex) * cellWidth;
  const width = ((isResizing ? displayEndIndex : endIndex) - (isResizing ? displayStartIndex : startIndex)) * cellWidth;

  // ドラッグ中のスタイル
  const style = {
    transform: CSS.Translate.toString(transform),
    left: `${left}px`,
    width: `${width}px`,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging || isResizing ? 50 : 10,
  };

  // リサイズ開始
  const handleResizeStart = useCallback((side: 'left' | 'right', e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(side);
    setResizeStartX(e.clientX);
    setTempStartTime(startTime);
    setTempEndTime(endTime);
    onResizeStart?.();
  }, [startTime, endTime, onResizeStart]);

  // リサイズ中のマウス移動
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartX;
      const cellsMoved = Math.round(deltaX / cellWidth);

      if (isResizing === 'left') {
        const currentStartIndex = timeSlots.findIndex((t) => t === startTime);
        let newStartIndex = currentStartIndex + cellsMoved;

        // 制限: 最小2時間（4セル）、最大制限なし（8時間超は残業として表示）
        const currentEndIndex = timeSlots.findIndex((t) => t === endTime);
        const maxStartIndex = currentEndIndex - 4;  // 最小2時間

        newStartIndex = Math.max(0, Math.min(maxStartIndex, newStartIndex));

        if (newStartIndex >= 0 && newStartIndex < timeSlots.length) {
          setTempStartTime(timeSlots[newStartIndex]);
        }
      } else {
        const currentEndIndex = timeSlots.findIndex((t) => t === endTime);
        let newEndIndex = currentEndIndex + cellsMoved;

        // 制限: 最小2時間（4セル）、最大制限なし（8時間超は残業として表示）
        const currentStartIndex = timeSlots.findIndex((t) => t === startTime);
        const minEndIndex = currentStartIndex + 4;  // 最小2時間

        newEndIndex = Math.max(minEndIndex, Math.min(timeSlots.length, newEndIndex));

        if (newEndIndex > 0 && newEndIndex <= timeSlots.length) {
          setTempEndTime(timeSlots[newEndIndex] || '24:00');
        }
      }
    };

    const handleMouseUp = () => {
      if (tempStartTime !== startTime || tempEndTime !== endTime) {
        onUpdate(shiftId, tempStartTime, tempEndTime);
      }
      setIsResizing(null);
      onResizeEnd?.();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeStartX, cellWidth, timeSlots, startTime, endTime, tempStartTime, tempEndTime, shiftId, onUpdate, onResizeEnd]);

  // シフト時間の計算（8時間超で残業判定）
  const duration = timeToMinutes(isResizing ? tempEndTime : endTime) - timeToMinutes(isResizing ? tempStartTime : startTime);
  const hours = Math.floor(duration / 60);
  const mins = duration % 60;
  const displayOvertime = duration > 8 * 60;

  // 8時間以内と8時間超過の幅を計算
  const normalMinutes = Math.min(duration, 8 * 60);
  const overtimeMinutes = Math.max(0, duration - 8 * 60);
  const normalWidthPercent = (normalMinutes / duration) * 100;
  const overtimeWidthPercent = (overtimeMinutes / duration) * 100;

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        if (barRef) (barRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      style={style}
      className={`absolute top-1 bottom-1 rounded-lg flex items-center cursor-grab active:cursor-grabbing select-none transition-shadow overflow-hidden ${
        isDragging ? 'shadow-lg' : ''
      } ${isResizing ? 'cursor-ew-resize' : ''}`}
      {...attributes}
      {...listeners}
    >
      {/* 背景色のセグメント */}
      <div className="absolute inset-0 flex">
        {/* 通常勤務部分（青色） */}
        <div
          className="h-full bg-[#007AFF]"
          style={{ width: `${normalWidthPercent}%` }}
        />
        {/* 残業部分（オレンジ色） - 8時間超過時のみ表示 */}
        {displayOvertime && (
          <div
            className="h-full bg-[#FF9500]"
            style={{ width: `${overtimeWidthPercent}%` }}
          />
        )}
      </div>

      {/* 外枠のシャドウ */}
      <div
        className={`absolute inset-0 rounded-lg pointer-events-none ${
          displayOvertime
            ? 'shadow-[0_0_0_2px_rgba(255,149,0,0.3)]'
            : 'shadow-[0_0_0_2px_rgba(0,122,255,0.3)]'
        }`}
      />

      {/* 左リサイズハンドル */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 rounded-l-lg flex items-center justify-center z-10"
        onMouseDown={(e) => handleResizeStart('left', e)}
      >
        <div className="w-0.5 h-3 bg-white/50 rounded" />
      </div>

      {/* 中央コンテンツ */}
      <div className="flex-1 flex items-center justify-center gap-1 px-3 min-w-0 z-10">
        <GripVertical className="w-3 h-3 text-white/70 flex-shrink-0" />
        <span className="text-[10px] text-white font-medium truncate">
          {isResizing ? tempStartTime : startTime}-{isResizing ? tempEndTime : endTime}
        </span>
        {width > 100 && (
          <span className="text-[9px] text-white/80 flex-shrink-0">
            ({hours}h{mins > 0 ? `${mins}m` : ''})
          </span>
        )}
      </div>

      {/* 右リサイズハンドル */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 rounded-r-lg flex items-center justify-center z-10"
        onMouseDown={(e) => handleResizeStart('right', e)}
      >
        <div className="w-0.5 h-3 bg-white/50 rounded" />
      </div>
    </div>
  );
}

// ドラッグオーバーレイ用コンポーネント
export function ShiftBarOverlay({
  startTime,
  endTime,
  isOvertime,
  cellWidth,
  timeSlots,
}: {
  startTime: string;
  endTime: string;
  isOvertime: boolean;
  cellWidth: number;
  timeSlots: string[];
}) {
  const startIndex = timeSlots.findIndex((t) => t === startTime);
  const endIndex = timeSlots.findIndex((t) => t === endTime);
  const width = (endIndex - startIndex) * cellWidth;

  const duration = timeToMinutes(endTime) - timeToMinutes(startTime);
  const hours = Math.floor(duration / 60);
  const mins = duration % 60;

  // 8時間以内と8時間超過の幅を計算
  const normalMinutes = Math.min(duration, 8 * 60);
  const overtimeMinutes = Math.max(0, duration - 8 * 60);
  const normalWidthPercent = (normalMinutes / duration) * 100;
  const overtimeWidthPercent = (overtimeMinutes / duration) * 100;

  return (
    <div
      style={{ width: `${width}px` }}
      className="h-6 rounded-lg flex items-center justify-center px-2 shadow-lg relative overflow-hidden"
    >
      {/* 背景色のセグメント */}
      <div className="absolute inset-0 flex">
        {/* 通常勤務部分（青色） */}
        <div
          className="h-full bg-[#007AFF]"
          style={{ width: `${normalWidthPercent}%` }}
        />
        {/* 残業部分（オレンジ色） */}
        {isOvertime && (
          <div
            className="h-full bg-[#FF9500]"
            style={{ width: `${overtimeWidthPercent}%` }}
          />
        )}
      </div>
      {/* コンテンツ */}
      <div className="relative z-10 flex items-center">
        <GripVertical className="w-3 h-3 text-white/70" />
        <span className="text-[10px] text-white font-medium ml-1">
          {startTime}-{endTime}
        </span>
        {width > 100 && (
          <span className="text-[9px] text-white/80 ml-1">
            ({hours}h{mins > 0 ? `${mins}m` : ''})
          </span>
        )}
      </div>
    </div>
  );
}
