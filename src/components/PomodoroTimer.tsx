import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Sparkles, CheckCircle2 } from 'lucide-react';

type TimerMode = 'work' | 'shortBreak' | 'longBreak';

const MODE_CONFIG: Record<TimerMode, { label: string; en: string; defaultMinutes: number; color: string; desc: string }> = {
  work: {
    label: '深度专注',
    en: 'DEEP WORK',
    defaultMinutes: 25,
    color: '#6b7cff',
    desc: '沉浸式学习，屏蔽一切干扰',
  },
  shortBreak: {
    label: '短休息',
    en: 'SHORT BREAK',
    defaultMinutes: 5,
    color: '#4ade80',
    desc: '喝杯水，眺望远方或活动四肢',
  },
  longBreak: {
    label: '长休息',
    en: 'LONG BREAK',
    defaultMinutes: 15,
    color: '#eab308',
    desc: '充分放松身心，准备下一轮学习',
  },
};

interface PomodoroTimerProps {
  currentTaskTitle?: string;
  onSessionComplete?: (mode: TimerMode, durationMinutes: number) => void;
  toast?: (msg: string) => void;
}

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({
  currentTaskTitle,
  onSessionComplete,
  toast,
}) => {
  const [mode, setMode] = useState<TimerMode>('work');
  const [timeLeft, setTimeLeft] = useState<number>(MODE_CONFIG.work.defaultMinutes * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [completedPomodoros, setCompletedPomodoros] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('pomodoro_completed_count');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const totalDuration = MODE_CONFIG[mode].defaultMinutes * 60;
  const progressPercent = Math.min(100, Math.max(0, ((totalDuration - timeLeft) / totalDuration) * 100));

  // Sound chime with web audio
  const playChime = (type: 'finish' | 'tick') => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      if (type === 'finish') {
        // Multi-tone cheerful chime
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
          gain.gain.setValueAtTime(0.001, ctx.currentTime + i * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + i * 0.12 + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.6);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + i * 0.12);
          osc.stop(ctx.currentTime + i * 0.12 + 0.65);
        });
      }
    } catch (e) {
      // Audio playback blocked or unallowed
    }
  };

  // Timer tick effect
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setIsRunning(false);
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, mode]);

  const handleTimerComplete = () => {
    playChime('finish');
    const mins = MODE_CONFIG[mode].defaultMinutes;

    if (mode === 'work') {
      const newCount = completedPomodoros + 1;
      setCompletedPomodoros(newCount);
      try {
        localStorage.setItem('pomodoro_completed_count', String(newCount));
      } catch {}

      toast?.(`🎉 恭喜！已完成 1 个番茄钟专注（${mins}分钟）！`);
      onSessionComplete?.('work', mins);

      // Recommend break
      if (newCount % 4 === 0) {
        switchMode('longBreak');
      } else {
        switchMode('shortBreak');
      }
    } else {
      toast?.('🔔 休息结束，精力已充满，继续专注吧！');
      onSessionComplete?.(mode, mins);
      switchMode('work');
    }
  };

  const switchMode = (newMode: TimerMode) => {
    setIsRunning(false);
    setMode(newMode);
    setTimeLeft(MODE_CONFIG[newMode].defaultMinutes * 60);
  };

  const toggleRun = () => {
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(MODE_CONFIG[mode].defaultMinutes * 60);
  };

  const adjustMinutes = (delta: number) => {
    if (isRunning) return;
    const newSeconds = Math.max(60, Math.min(120 * 60, timeLeft + delta * 60));
    setTimeLeft(newSeconds);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const currentCfg = MODE_CONFIG[mode];

  return (
    <div className="bg-[#1e2025] border-2 border-[#e9e4d8] p-4 sm:p-5 relative overflow-hidden transition-all shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
      {/* Top accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1 transition-all duration-500"
        style={{ backgroundColor: currentCfg.color }}
      />

      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#2d3038]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-editorial font-bold text-[#e9e4d8]">
              🍅 学习番茄钟
            </span>
            <span
              className="text-[9px] font-mono font-bold tracking-wider px-1.5 py-0.5 rounded-xs"
              style={{
                color: currentCfg.color,
                backgroundColor: `${currentCfg.color}20`,
                border: `1px solid ${currentCfg.color}40`,
              }}
            >
              {currentCfg.en}
            </span>
          </div>
          <div className="text-[10px] text-[#8f8b80] mt-0.5 font-mono">
            {currentCfg.desc}
          </div>
        </div>

        {/* Sound toggle & Completed badge */}
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 bg-[#252830] border border-[#373a42] text-[#e9e4d8]"
            title="今日累计完成番茄数"
          >
            <CheckCircle2 className="w-3 h-3 text-[#4ade80]" />
            <span>×{completedPomodoros}</span>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1 text-[#8f8b80] hover:text-[#e9e4d8] transition-colors cursor-pointer"
            title={soundEnabled ? '提示音已开启' : '已静音'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-[#6b7cff]" /> : <VolumeX className="w-4 h-4 text-[#63605a]" />}
          </button>
        </div>
      </div>

      {/* Mode Selector Tabs */}
      <div className="grid grid-cols-3 gap-1.5 my-3 bg-[#17181c] p-1 border border-[#2b2d35]">
        {(['work', 'shortBreak', 'longBreak'] as const).map(m => {
          const active = mode === m;
          const cfg = MODE_CONFIG[m];
          return (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`py-1.5 px-2 text-xs font-semibold tracking-wide transition-all cursor-pointer flex flex-col items-center justify-center ${
                active
                  ? 'bg-[#282b33] text-[#e9e4d8] shadow-xs'
                  : 'text-[#8f8b80] hover:text-[#c4c0b5] hover:bg-[#1e2025]'
              }`}
            >
              <span>{cfg.label}</span>
              <span className="text-[9px] font-mono opacity-60">
                {cfg.defaultMinutes}m
              </span>
            </button>
          );
        })}
      </div>

      {/* Task association banner if currentTaskTitle is selected */}
      {currentTaskTitle && (
        <div className="mb-3 px-2.5 py-1.5 bg-[#252830] border-l-2 border-[#6b7cff] text-[11px] text-[#c4c0b5] flex items-center justify-between">
          <span className="truncate">当前专注：<strong className="text-[#e9e4d8]">{currentTaskTitle}</strong></span>
          <Sparkles className="w-3.5 h-3.5 text-[#6b7cff] shrink-0 ml-1" />
        </div>
      )}

      {/* Main Timer Display */}
      <div className="relative py-4 flex flex-col items-center justify-center">
        {/* Big Digital Clock */}
        <div
          className="font-mono text-5xl sm:text-6xl font-extrabold tracking-wider select-none transition-colors"
          style={{ color: isRunning ? currentCfg.color : '#e9e4d8' }}
        >
          {timeFormatted}
        </div>

        {/* Progress Bar */}
        <div className="w-full mt-3 bg-[#141518] h-1.5 overflow-hidden border border-[#2b2d35]">
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${progressPercent}%`,
              backgroundColor: currentCfg.color,
            }}
          />
        </div>

        {/* Adjust minute pills when paused */}
        {!isRunning && (
          <div className="flex gap-2 mt-2.5 text-[10px] font-mono text-[#8f8b80]">
            <button
              onClick={() => adjustMinutes(-5)}
              className="px-2 py-0.5 border border-[#373a42] hover:border-[#6b7cff] hover:text-[#e9e4d8] transition-colors cursor-pointer"
            >
              -5m
            </button>
            <button
              onClick={() => adjustMinutes(-1)}
              className="px-2 py-0.5 border border-[#373a42] hover:border-[#6b7cff] hover:text-[#e9e4d8] transition-colors cursor-pointer"
            >
              -1m
            </button>
            <button
              onClick={() => adjustMinutes(1)}
              className="px-2 py-0.5 border border-[#373a42] hover:border-[#6b7cff] hover:text-[#e9e4d8] transition-colors cursor-pointer"
            >
              +1m
            </button>
            <button
              onClick={() => adjustMinutes(5)}
              className="px-2 py-0.5 border border-[#373a42] hover:border-[#6b7cff] hover:text-[#e9e4d8] transition-colors cursor-pointer"
            >
              +5m
            </button>
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-center gap-3 pt-2">
        <button
          onClick={toggleRun}
          className={`flex-1 py-2.5 px-4 flex items-center justify-center gap-2 font-bold text-sm tracking-wide transition-all cursor-pointer ${
            isRunning
              ? 'bg-[#2e313b] text-[#e9e4d8] border border-[#444854] hover:bg-[#383c48]'
              : 'bg-[#e9e4d8] text-[#1d1f24] hover:bg-[#6b7cff] hover:text-white shadow-md'
          }`}
        >
          {isRunning ? (
            <>
              <Pause className="w-4 h-4" /> 暂停专注
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" /> 开始专注
            </>
          )}
        </button>

        <button
          onClick={resetTimer}
          className="p-2.5 border border-[#373a42] text-[#8f8b80] hover:text-[#e9e4d8] hover:border-[#e9e4d8] transition-colors cursor-pointer shrink-0"
          title="重置计时"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
