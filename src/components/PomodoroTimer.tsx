import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Sparkles,
  CheckCircle2,
  Edit3,
  Check,
  X,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export type TimerMode = 'work' | 'shortBreak' | 'longBreak';

const MODE_CONFIG: Record<
  TimerMode,
  { label: string; en: string; defaultMinutes: number; color: string; desc: string }
> = {
  work: {
    label: '深度专注',
    en: 'DEEP WORK',
    defaultMinutes: 25,
    color: '#ff6b57',
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
  // Collapsible drawer state - defaults to collapsed to save space for tasks
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('pomodoro_drawer_expanded');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  const [mode, setMode] = useState<TimerMode>('work');
  const [timeLeft, setTimeLeft] = useState<number>(MODE_CONFIG.work.defaultMinutes * 60);
  const [customTotalDuration, setCustomTotalDuration] = useState<number>(
    MODE_CONFIG.work.defaultMinutes * 60
  );
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

  // Manual time editing states
  const [isEditingTime, setIsEditingTime] = useState<boolean>(false);
  const [editMinutes, setEditMinutes] = useState<string>('25');
  const [editSeconds, setEditSeconds] = useState<string>('00');
  const minInputRef = useRef<HTMLInputElement>(null);

  // Keep drawer compact without forced expansion
  const prevTaskRef = useRef<string | undefined>(currentTaskTitle);
  useEffect(() => {
    prevTaskRef.current = currentTaskTitle;
  }, [currentTaskTitle]);

  const handleToggleExpand = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    try {
      localStorage.setItem('pomodoro_drawer_expanded', String(next));
    } catch {}
  };

  const totalDuration = customTotalDuration || MODE_CONFIG[mode].defaultMinutes * 60;
  const progressPercent = Math.min(
    100,
    Math.max(0, ((totalDuration - timeLeft) / totalDuration) * 100)
  );

  // Sound chime with web audio
  const playChime = (type: 'finish' | 'tick') => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      if (type === 'finish') {
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
    } catch (e) {}
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
  }, [isRunning, mode, customTotalDuration]);

  const handleTimerComplete = () => {
    playChime('finish');
    const mins = Math.max(1, Math.round(totalDuration / 60));

    if (mode === 'work') {
      const newCount = completedPomodoros + 1;
      setCompletedPomodoros(newCount);
      try {
        localStorage.setItem('pomodoro_completed_count', String(newCount));
      } catch {}

      toast?.(`🎉 恭喜！已完成 1 个番茄钟专注（${mins}分钟）！`);
      onSessionComplete?.('work', mins);

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
    setIsEditingTime(false);
    setMode(newMode);
    const secs = MODE_CONFIG[newMode].defaultMinutes * 60;
    setCustomTotalDuration(secs);
    setTimeLeft(secs);
  };

  const toggleRun = () => {
    if (!isRunning && timeLeft <= 0) {
      setTimeLeft(totalDuration);
    }
    setIsRunning(prev => !prev);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setIsEditingTime(false);
    setTimeLeft(totalDuration);
  };

  const adjustMinutes = (deltaMinutes: number) => {
    if (isRunning) return;
    const newMins = Math.max(1, Math.min(180, Math.floor(timeLeft / 60) + deltaMinutes));
    const newSecs = newMins * 60;
    setCustomTotalDuration(newSecs);
    setTimeLeft(newSecs);
  };

  const handleStartEditTime = () => {
    if (isRunning) return;
    const currentM = Math.floor(timeLeft / 60);
    const currentS = timeLeft % 60;
    setEditMinutes(String(currentM));
    setEditSeconds(currentS < 10 ? `0${currentS}` : String(currentS));
    setIsEditingTime(true);
    setTimeout(() => {
      minInputRef.current?.focus();
      minInputRef.current?.select();
    }, 50);
  };

  const handleSaveCustomTime = () => {
    let m = parseInt(editMinutes, 10);
    let s = parseInt(editSeconds, 10);
    if (isNaN(m) || m < 0) m = 0;
    if (isNaN(s) || s < 0) s = 0;
    if (s > 59) s = 59;
    if (m === 0 && s === 0) {
      m = 1;
    }
    if (m > 180) m = 180;

    const total = m * 60 + s;
    setCustomTotalDuration(total);
    setTimeLeft(total);
    setIsEditingTime(false);
    toast?.(`已设定番茄钟时长为 ${m} 分 ${s > 0 ? s + ' 秒' : ''}`);
  };

  const handleApplyPresetMinutes = (minutes: number) => {
    setEditMinutes(String(minutes));
    setEditSeconds('00');
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const currentCfg = MODE_CONFIG[mode];

  return (
    <div className="border-2 border-[#e9e4d8] bg-[#1e2025] shadow-lg overflow-hidden transition-all duration-300 rounded-sm">
      {/* 
        =======================================================================
        1. COMPACT COLLAPSED SUMMARY BAR (醒目且不喧宾夺主的番茄钟下拉抽屉头部)
        =======================================================================
      */}
      {/* Drawer Handle Strip */}
      <div
        onClick={handleToggleExpand}
        className="bg-[#16181d] py-1 flex items-center justify-center cursor-pointer border-b border-[#2b2e38] group/handle hover:bg-[#20222a] transition-colors select-none"
        title={isExpanded ? '收起番茄钟抽屉' : '下拉展开番茄钟完整设置抽屉'}
      >
        <div className="flex items-center gap-2 text-[10px] font-mono text-[#8f8b80] group-hover/handle:text-[#e9e4d8]">
          <span className="w-5 h-0.5 bg-[#474b58] rounded-full group-hover/handle:bg-[#ff6b57] transition-colors" />
          <span>{isExpanded ? '▲ 点击收起番茄钟抽屉' : '▼ 下拉抽屉展开番茄钟 (专注模式设置)'}</span>
          <span className="w-5 h-0.5 bg-[#474b58] rounded-full group-hover/handle:bg-[#ff6b57] transition-colors" />
        </div>
      </div>

      <div
        onClick={handleToggleExpand}
        className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-[#20232b] via-[#242730] to-[#20232b] hover:from-[#262a34] hover:to-[#262a34] cursor-pointer transition-all select-none group relative"
      >
        {/* Top/Bottom live progress strip */}
        <div
          className="absolute bottom-0 left-0 h-1 transition-all duration-300"
          style={{
            width: `${progressPercent}%`,
            backgroundColor: currentCfg.color,
          }}
        />

        {/* Left: Unmistakable Pomodoro Tomato Badge & Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#ff6b57]/20 border border-[#ff6b57]/50 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
            <span className="text-base select-none leading-none">🍅</span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-editorial text-sm font-extrabold text-[#e9e4d8] tracking-wide">
                学习番茄钟
              </span>
              <span
                className="text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded"
                style={{
                  color: currentCfg.color,
                  backgroundColor: `${currentCfg.color}20`,
                  border: `1px solid ${currentCfg.color}40`,
                }}
              >
                {currentCfg.label}
              </span>
              {isRunning && (
                <span className="flex items-center gap-1 text-[9.5px] text-[#4ade80] font-mono font-bold animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
                  计时中
                </span>
              )}
            </div>

            {currentTaskTitle ? (
              <div className="text-[10px] text-[#6b7cff] truncate mt-0.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3 shrink-0" />
                <span className="truncate">专注：{currentTaskTitle}</span>
              </div>
            ) : (
              <div className="text-[10px] text-[#8f8b80] font-mono mt-0.5 truncate hidden sm:block">
                下拉展开调节时长与模式 · {currentCfg.desc}
              </div>
            )}
          </div>
        </div>

        {/* Right: Digital Countdown + Quick Play/Pause Button + Expand/Collapse Chevron */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Completed tomato count badge */}
          <div
            className="hidden xs:flex items-center gap-1 text-[10.5px] font-mono px-1.5 py-0.5 bg-[#17181c] border border-[#373a44] text-[#e9e4d8] rounded"
            title="今日已完成专注番茄数"
          >
            <span>🍅</span>
            <span>×{completedPomodoros}</span>
          </div>

          {/* Prominent Digital Clock in Header */}
          <div
            className="font-mono text-base sm:text-lg font-extrabold tracking-wider px-2 py-0.5 bg-[#131519] border border-[#2e313c] rounded text-[#e9e4d8]"
            style={{ color: isRunning ? currentCfg.color : '#e9e4d8' }}
          >
            {timeFormatted}
          </div>

          {/* Quick Play/Pause button directly in collapsed bar */}
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              toggleRun();
            }}
            className={`w-7 h-7 rounded flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95 ${
              isRunning
                ? 'bg-[#ff6b57] text-white hover:bg-[#e05643]'
                : 'bg-[#6b7cff] text-white hover:bg-[#5868e6]'
            }`}
            title={isRunning ? '暂停番茄钟' : '立即开始专注'}
          >
            {isRunning ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            )}
          </button>

          {/* Expand / Collapse trigger */}
          <div className="text-[#8f8b80] group-hover:text-[#e9e4d8] p-1 flex items-center gap-0.5 transition-colors">
            <span className="text-[10px] font-mono hidden md:inline">
              {isExpanded ? '收起' : '展开'}
            </span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {/* 
        =======================================================================
        2. EXPANDED DRAWER BODY (下拉抽屉展开完整控制面板)
        =======================================================================
      */}
      {isExpanded && (
        <div className="p-4 bg-[#181a1f] border-t-2 border-[#2b2e38] space-y-3.5 animate-editorial-up">
          {/* Header Controls (Sound switch & Completed badges) */}
          <div className="flex items-center justify-between text-xs text-[#8f8b80] border-b border-[#292c36] pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold text-[#e9e4d8]">
                专注模式设置
              </span>
              <span className="text-[10px] text-[#63605a]">|</span>
              <span className="text-[10px] text-[#8f8b80]">
                累计完成 <b className="text-[#4ade80]">{completedPomodoros}</b> 个番茄
              </span>
            </div>

            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="flex items-center gap-1 text-[11px] text-[#8f8b80] hover:text-[#e9e4d8] cursor-pointer transition-colors"
              title={soundEnabled ? '提示音已开启' : '已静音'}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-[#6b7cff]" />
                  <span>音效开</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-[#63605a]" />
                  <span>静音</span>
                </>
              )}
            </button>
          </div>

          {/* Mode Selector Tabs */}
          <div className="grid grid-cols-3 gap-1.5 bg-[#121317] p-1 border border-[#2b2d35] rounded-xs">
            {(['work', 'shortBreak', 'longBreak'] as const).map(m => {
              const active = mode === m;
              const cfg = MODE_CONFIG[m];
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className={`py-1.5 px-2 text-xs font-semibold tracking-wide transition-all cursor-pointer flex flex-col items-center justify-center rounded-xs ${
                    active
                      ? 'bg-[#252832] text-[#e9e4d8] shadow-xs border border-[#3b3f4e]'
                      : 'text-[#8f8b80] hover:text-[#c4c0b5] hover:bg-[#1a1c22]'
                  }`}
                >
                  <span className="font-bold">{cfg.label}</span>
                  <span className="text-[9px] font-mono opacity-60">
                    {cfg.defaultMinutes}分钟
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected Task Banner */}
          {currentTaskTitle && (
            <div className="px-3 py-1.5 bg-[#20242f] border-l-2 border-[#6b7cff] text-xs text-[#c4c0b5] flex items-center justify-between rounded-r">
              <span className="truncate">
                当前专注目标：<strong className="text-[#e9e4d8]">{currentTaskTitle}</strong>
              </span>
              <Sparkles className="w-3.5 h-3.5 text-[#6b7cff] shrink-0 ml-1" />
            </div>
          )}

          {/* Main Clock Stage & Inline Time Editor */}
          <div className="py-2 flex flex-col items-center justify-center">
            {isEditingTime ? (
              <div className="flex flex-col items-center justify-center py-1">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col items-center">
                    <label className="text-[10px] font-mono text-[#8f8b80] mb-1">分钟</label>
                    <input
                      ref={minInputRef}
                      type="number"
                      min="0"
                      max="180"
                      value={editMinutes}
                      onChange={e => setEditMinutes(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveCustomTime();
                        if (e.key === 'Escape') setIsEditingTime(false);
                      }}
                      className="w-20 sm:w-24 text-center font-mono text-3xl sm:text-4xl font-extrabold bg-[#101115] text-[#e9e4d8] border-2 border-[#6b7cff] rounded p-1 outline-none"
                    />
                  </div>

                  <span className="font-mono text-3xl sm:text-4xl font-extrabold text-[#6b7cff] pb-1">
                    :
                  </span>

                  <div className="flex flex-col items-center">
                    <label className="text-[10px] font-mono text-[#8f8b80] mb-1">秒钟</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={editSeconds}
                      onChange={e => setEditSeconds(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveCustomTime();
                        if (e.key === 'Escape') setIsEditingTime(false);
                      }}
                      className="w-20 sm:w-24 text-center font-mono text-3xl sm:text-4xl font-extrabold bg-[#101115] text-[#e9e4d8] border-2 border-[#6b7cff] rounded p-1 outline-none"
                    />
                  </div>
                </div>

                {/* Quick preset minute chips */}
                <div className="flex gap-1.5 mt-2.5 flex-wrap justify-center">
                  {[10, 15, 25, 35, 45, 60].map(pm => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => handleApplyPresetMinutes(pm)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono border cursor-pointer transition-colors ${
                        parseInt(editMinutes, 10) === pm && parseInt(editSeconds, 10) === 0
                          ? 'bg-[#6b7cff] border-[#6b7cff] text-white font-bold'
                          : 'bg-[#22252e] border-[#363a46] text-[#8f8b80] hover:text-[#e9e4d8]'
                      }`}
                    >
                      {pm}m
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <button
                    type="button"
                    onClick={handleSaveCustomTime}
                    className="px-3.5 py-1 bg-[#6b7cff] hover:bg-[#5868e6] text-white text-xs font-bold rounded flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>确认设定</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingTime(false)}
                    className="px-3 py-1 bg-[#2a2d36] hover:bg-[#343742] text-[#8f8b80] hover:text-[#e9e4d8] text-xs font-bold rounded flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>取消</span>
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={handleStartEditTime}
                className="group flex flex-col items-center justify-center cursor-pointer p-2 rounded hover:bg-[#20232c] transition-all select-none"
                title="点击数字可自定义时长"
              >
                <div
                  className="font-mono text-4xl sm:text-5xl font-extrabold tracking-wider transition-all group-hover:scale-105 flex items-center gap-2"
                  style={{ color: isRunning ? currentCfg.color : '#e9e4d8' }}
                >
                  <span>{timeFormatted}</span>
                  <Edit3 className="w-4 h-4 text-[#8f8b80] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="text-[10px] font-mono text-[#8f8b80] mt-0.5 flex items-center gap-1 group-hover:text-[#6b7cff] transition-colors">
                  <Clock className="w-3 h-3" />
                  <span>点击可手动修改时长</span>
                </div>
              </div>
            )}

            {/* Progress bar */}
            <div className="w-full mt-2.5 bg-[#121316] h-1.5 overflow-hidden border border-[#2b2d35] rounded-full">
              <div
                className="h-full transition-all duration-300 rounded-full"
                style={{
                  width: `${progressPercent}%`,
                  backgroundColor: currentCfg.color,
                }}
              />
            </div>

            {/* Quick minute adjustments when paused */}
            {!isRunning && !isEditingTime && (
              <div className="flex gap-1.5 mt-2 text-[10px] font-mono text-[#8f8b80]">
                {[-5, -1, 1, 5].map(delta => (
                  <button
                    key={delta}
                    type="button"
                    onClick={() => adjustMinutes(delta)}
                    className="px-2 py-0.5 border border-[#373a44] hover:border-[#6b7cff] hover:text-[#e9e4d8] rounded transition-colors cursor-pointer"
                  >
                    {delta > 0 ? `+${delta}m` : `${delta}m`}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons (Start / Pause & Reset) */}
          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={toggleRun}
              className={`flex-1 py-2 px-4 rounded flex items-center justify-center gap-2 font-bold text-xs sm:text-sm tracking-wide transition-all cursor-pointer shadow-sm active:scale-95 ${
                isRunning
                  ? 'bg-[#ff6b57] text-white hover:bg-[#e05643]'
                  : 'bg-[#6b7cff] text-white hover:bg-[#5868e6]'
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
              type="button"
              onClick={resetTimer}
              className="p-2 rounded border border-[#373a44] text-[#8f8b80] hover:text-[#e9e4d8] hover:border-[#e9e4d8] transition-colors cursor-pointer shrink-0"
              title="重置计时"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Collapse drawer bottom trigger */}
          <button
            type="button"
            onClick={handleToggleExpand}
            className="w-full py-1 text-center text-[10.5px] text-[#8f8b80] hover:text-[#e9e4d8] font-mono border-t border-[#2a2d36] flex items-center justify-center gap-1 cursor-pointer bg-[#14161a] hover:bg-[#1a1d22] transition-colors rounded-b"
          >
            <ChevronUp className="w-3.5 h-3.5" />
            <span>收起番茄钟抽屉</span>
          </button>
        </div>
      )}
    </div>
  );
};
