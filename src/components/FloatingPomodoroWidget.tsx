import React, { useState, useEffect } from 'react';
import { Play, Pause, Clock, X, Flame } from 'lucide-react';

interface FloatingPomodoroWidgetProps {
  setActiveTab: (tab: 'today' | 'week' | 'hw' | 'tasks' | 'mine' | 'widget' | 'remind') => void;
}

export const FloatingPomodoroWidget: React.FC<FloatingPomodoroWidgetProps> = ({ setActiveTab }) => {
  const [timerState, setTimerState] = useState<{
    isRunning: boolean;
    mode: string;
    remaining: number;
    customTotalDuration: number;
    targetEndTime: number;
    taskTitle?: string;
  } | null>(null);

  useEffect(() => {
    const checkState = () => {
      try {
        const raw = localStorage.getItem('pomodoro_running_state');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed.targetEndTime === 'number') {
            const remaining = Math.round((parsed.targetEndTime - Date.now()) / 1000);
            if (parsed.isRunning && remaining > 0) {
              setTimerState({
                isRunning: true,
                mode: parsed.mode || 'work',
                remaining: Math.max(0, remaining),
                customTotalDuration: parsed.customTotalDuration || 1500,
                targetEndTime: parsed.targetEndTime,
                taskTitle: parsed.taskTitle,
              });
              return;
            }
          }
        }
      } catch {}
      setTimerState(null);
    };

    checkState();
    const interval = setInterval(checkState, 1000);
    return () => clearInterval(interval);
  }, []);

  const dismissedTarget = sessionStorage.getItem('pomodoro_dismissed_target');
  const isDismissed = timerState && dismissedTarget === String(timerState.targetEndTime);

  if (isDismissed || !timerState || !timerState.isRunning) {
    return null;
  }

  const mins = Math.floor(timerState.remaining / 60);
  const secs = timerState.remaining % 60;
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const modeLabel =
    timerState.mode === 'work'
      ? '深度专注'
      : timerState.mode === 'shortBreak'
      ? '短休息'
      : '长休息';

  const modeColor =
    timerState.mode === 'work' ? '#ff6b57' : timerState.mode === 'shortBreak' ? '#4ade80' : '#eab308';

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (timerState) {
        sessionStorage.setItem('pomodoro_dismissed_target', String(timerState.targetEndTime));
      }
    } catch {}
    setTimerState({ ...timerState! });
  };

  return (
    <div
      onClick={() => setActiveTab('tasks')}
      className="fixed bottom-20 right-4 sm:right-6 z-50 bg-[#161820]/95 backdrop-blur-md border-2 rounded-2xl p-3 shadow-2xl flex items-center gap-3 cursor-pointer transition-all hover:scale-105 active:scale-95 animate-bounce-subtle group"
      style={{ borderColor: `${modeColor}80` }}
      title="点击打开番茄钟与任务看板"
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-inner animate-pulse"
        style={{ backgroundColor: `${modeColor}25`, color: modeColor, borderColor: `${modeColor}50`, borderWidth: '1px' }}
      >
        <Flame className="w-5 h-5 fill-current" />
      </div>

      <div className="min-w-[100px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: modeColor }}>
            {modeLabel}
          </span>
          <span className="font-mono text-sm font-extrabold text-white tracking-wider">
            {timeStr}
          </span>
        </div>
        {timerState.taskTitle ? (
          <div className="text-[11px] text-[#c8c5bc] truncate max-w-[140px] sm:max-w-[180px] mt-0.5">
            🎯 {timerState.taskTitle}
          </div>
        ) : (
          <div className="text-[10px] text-[#8f8b80] mt-0.5">
            正在专注计时中...
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        className="p-1.5 bg-[#252834] hover:bg-[#303444] text-[#8f8b80] hover:text-[#e9e4d8] rounded-lg transition-colors ml-1"
        title="关闭悬浮窗（番茄钟继续在后台计时）"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
