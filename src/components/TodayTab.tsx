import React, { useState, useEffect, useMemo } from 'react';
import { Course, Homework, Notice, User } from '../types';
import {
  WEEKDAYS,
  WEEKDAYS_FULL,
  MONTHS_EN,
  SLOTS,
  getWeekNo,
  pad2,
  toMinutes,
  dueDays,
  isCourseInWeek,
  formatDueText,
  isSundayEvening,
  getNextDayInfo
} from '../utils/time';
import {
  Clock,
  CheckCircle2,
  Sparkles,
  Coffee,
  Moon,
  Calendar,
  ArrowRight,
  RotateCcw,
  Bell,
  X,
  Volume2
} from 'lucide-react';

interface TodayTabProps {
  user: User;
  courses: Course[];
  homework: Homework[];
  notices: Notice[];
  dismissedNoticeId: number | null;
  onDismissNotice: (id: number) => void;
  onOpenCourse: (course: Course) => void;
  onOpenWeekSchedule?: () => void;
}

export const TodayTab: React.FC<TodayTabProps> = ({
  user,
  courses,
  homework,
  notices,
  dismissedNoticeId,
  onDismissNotice,
  onOpenCourse,
  onOpenWeekSchedule,
}) => {
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [previewTomorrow, setPreviewTomorrow] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const now = currentTime;
  const currentWeek = Math.max(1, Math.min(25, getWeekNo(now)));
  const todayDayIdx = (now.getDay() + 6) % 7; // 0=Mon..6=Sun
  const isSunday = todayDayIdx === 6;
  const isSundayEve = isSundayEvening(now, 17); // Sunday >= 17:00

  // Next day information
  const nextDay = useMemo(() => getNextDayInfo(now), [now]);

  // Tomorrow courses
  const tomorrowCourses = useMemo(() => {
    return courses
      .filter(c => c.day === nextDay.dayIdx && isCourseInWeek(nextDay.weekNo, c.weeks))
      .sort((a, b) => a.s - b.s);
  }, [courses, nextDay]);
  const tomorrowFirstCourse = tomorrowCourses[0];

  // Active viewing target: today or tomorrow preview
  const targetDate = previewTomorrow ? nextDay.date : now;
  const viewWeek = previewTomorrow ? nextDay.weekNo : currentWeek;
  const viewDayIdx = previewTomorrow ? nextDay.dayIdx : todayDayIdx;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Active courses for viewing day
  const displayCourses = courses
    .filter(c => c.day === viewDayIdx && isCourseInWeek(viewWeek, c.weeks))
    .sort((a, b) => a.s - b.s);

  const hwMap = React.useMemo(() => {
    const map: Record<string, { days: number; text: string; urgent: boolean; soon: boolean }> = {};
    homework.forEach(h => {
      if (h.done || !h.course) return;
      const d = dueDays(h.due);
      const existing = map[h.course];
      if (!existing || d < existing.days) {
        map[h.course] = {
          days: d,
          text: formatDueText(d),
          urgent: d <= 0,
          soon: d > 0 && d <= 2,
        };
      }
    });
    return map;
  }, [homework]);

  // Find active / next course
  const activeCourse = !previewTomorrow
    ? displayCourses.find(c => {
        const sMin = toMinutes(SLOTS[c.s].s);
        const eMin = toMinutes(SLOTS[c.e].e);
        return sMin <= currentMinutes && currentMinutes <= eMin;
      })
    : undefined;

  const nextCourse = !previewTomorrow
    ? displayCourses.find(c => {
        const sMin = toMinutes(SLOTS[c.s].s);
        return sMin > currentMinutes;
      })
    : displayCourses[0];

  // Schedule progress stats
  const progressStats = useMemo(() => {
    if (previewTomorrow) {
      return {
        totalMinutes: displayCourses.reduce((acc, c) => acc + (toMinutes(SLOTS[c.e].e) - toMinutes(SLOTS[c.s].s)), 0),
        completedMinutes: 0,
        pct: 0,
        doneCount: 0,
        doingCount: 0,
        upcomingCount: displayCourses.length,
        statusText: `明日共 ${displayCourses.length} 门课程 · 首节 ${displayCourses[0] ? SLOTS[displayCourses[0].s].s : '未定'}`,
        statusType: 'upcoming' as const,
      };
    }

    if (displayCourses.length === 0) {
      return {
        totalMinutes: 0,
        completedMinutes: 0,
        pct: 100,
        doneCount: 0,
        doingCount: 0,
        upcomingCount: 0,
        statusText: isSunday
          ? '周日无课休息 · 下周课表已准备就绪'
          : '今天没有课程安排，尽情享受自由时光',
        statusType: 'free' as const,
      };
    }

    let totalMins = 0;
    let completedMins = 0;
    let done = 0;
    let doing = 0;
    let upcoming = 0;

    displayCourses.forEach(c => {
      const sMin = toMinutes(SLOTS[c.s].s);
      const eMin = toMinutes(SLOTS[c.e].e);
      const duration = Math.max(1, eMin - sMin);
      totalMins += duration;

      if (currentMinutes >= eMin) {
        completedMins += duration;
        done++;
      } else if (currentMinutes <= sMin) {
        upcoming++;
      } else {
        completedMins += Math.max(0, currentMinutes - sMin);
        doing++;
      }
    });

    const pct = totalMins > 0 ? Math.min(100, Math.max(0, Math.round((completedMins / totalMins) * 100))) : 0;

    let statusType: 'done' | 'doing' | 'break' | 'upcoming' | 'free' = 'upcoming';
    let statusText = '';

    if (done === displayCourses.length) {
      statusType = 'done';
      statusText = `今日全天 ${displayCourses.length} 门课程已全部结课`;
    } else if (doing > 0) {
      statusType = 'doing';
      statusText = activeCourse
        ? `正在上《${activeCourse.name}》· 第${activeCourse.s}-${activeCourse.e}节`
        : '正在上课中';
    } else if (done > 0 && upcoming > 0) {
      statusType = 'break';
      statusText = nextCourse
        ? `课间休息中 · 下一节《${nextCourse.name}》(${SLOTS[nextCourse.s].s})`
        : '课间休息中';
    } else {
      statusType = 'upcoming';
      statusText = nextCourse
        ? `今日课程尚未开课 · 首节于 ${SLOTS[nextCourse.s].s} 开始`
        : '今日课程尚未开始';
    }

    return {
      totalMinutes: totalMins,
      completedMinutes: completedMins,
      pct,
      doneCount: done,
      doingCount: doing,
      upcomingCount: upcoming,
      statusText,
      statusType,
    };
  }, [displayCourses, currentMinutes, activeCourse, nextCourse, previewTomorrow, isSunday]);

  const activeNotice = notices.find(n => n.id !== dismissedNoticeId);

  return (
    <div className="space-y-4 pb-6 select-none">
      {/* Notice Bar */}
      {activeNotice && (
        <div className="bg-[#2a2c33] border-2 border-[#e9e4d8] p-3 text-xs flex items-start gap-2.5 leading-relaxed rounded text-[#d8d4c8] shadow-sm">
          <Bell className="w-4 h-4 text-[#6b7cff] shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="font-bold text-[#e9e4d8]">【公告】</span>
            <span>{activeNotice.text}</span>
          </div>
          <button
            onClick={() => onDismissNotice(activeNotice.id)}
            className="p-0.5 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Date Header */}
      <div className="flex items-end justify-between border-b-[2.5px] border-[#e9e4d8] pb-3.5">
        <div className="font-editorial text-[68px] sm:text-[76px] font-extrabold leading-[0.85] text-[#e9e4d8]">
          {pad2(targetDate.getDate())}
        </div>
        <div className="text-right">
          <div className="text-[11px] font-mono font-bold tracking-[3.5px] text-[#8f8b80]">
            {MONTHS_EN[targetDate.getMonth()]} · {targetDate.getFullYear()}
          </div>
          <div className="font-editorial text-lg sm:text-xl font-bold mt-1 text-[#e9e4d8]">
            {WEEKDAYS_FULL[viewDayIdx]}
            <span className="text-xs text-[#8f8b80] font-sans font-normal ml-2">
              第{viewWeek}周
            </span>
          </div>
          <div className="text-xs text-[#8f8b80] mt-0.5">
            {previewTomorrow ? (
              <span className="text-[#8ea4ff] font-bold">✨ 正在提前预览明日日程</span>
            ) : (
              <span>你好，{user.name} {user.role === 'admin' ? '（管理员）' : '（同学）'}</span>
            )}
          </div>
        </div>
      </div>

      {/* Preview Toggle Banner if Previewing Tomorrow */}
      {previewTomorrow && (
        <div className="bg-[#1b2234] border border-[#6b7cff] p-3 rounded flex items-center justify-between text-xs text-[#8ea4ff] shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#6b7cff]" />
            <span>当前正在提前查看：<strong>{nextDay.isMonday ? '明天周一（新一周第' + nextDay.weekNo + '周）' : '明天'}</strong> 课程安排</span>
          </div>
          <button
            onClick={() => setPreviewTomorrow(false)}
            className="px-2.5 py-1 bg-[#6b7cff] hover:bg-[#5b6cee] text-white font-bold rounded text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>切回今日</span>
          </button>
        </div>
      )}

      {/* Featured: Sunday Evening / Eve Class Preview Card */}
      {!previewTomorrow && (isSunday || isSundayEve || now.getHours() >= 18) && (
        <div className="bg-gradient-to-r from-[#1c223a] to-[#171922] border-2 border-[#6b7cff] p-4 rounded-lg shadow-xl text-[#e9e4d8] space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Moon className="w-4 h-4 text-[#6b7cff]" />
              <h4 className="font-editorial font-bold text-base text-[#e9e4d8]">
                {isSunday ? '周日晚间备课 · 明日早课已提前就绪' : '晚间早课预告 · 明日课程抢先看'}
              </h4>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-[#6b7cff]/20 text-[#8ea4ff] font-bold">
              {nextDay.isMonday ? `下周第${nextDay.weekNo}周` : '明日早课'}
            </span>
          </div>

          {tomorrowFirstCourse ? (
            <div className="p-3 bg-[#222530] border border-[#333748] rounded space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold text-[#8ea4ff]">
                  {nextDay.isMonday ? '明天（周一）首节课' : '明天首节课'}
                </span>
                <span className="font-mono font-bold text-[#e9e4d8]">
                  {SLOTS[tomorrowFirstCourse.s].s} - {SLOTS[tomorrowFirstCourse.e].e} (第{tomorrowFirstCourse.s}-{tomorrowFirstCourse.e}节)
                </span>
              </div>
              <div className="font-editorial text-lg font-bold text-[#e9e4d8]">
                {tomorrowFirstCourse.name}
              </div>
              <div className="text-[11px] text-[#a8a399] flex items-center justify-between">
                <span>教室：<strong className="text-[#e9e4d8]">{tomorrowFirstCourse.room || '待定地点'}</strong></span>
                {tomorrowFirstCourse.teacher && (
                  <span>教师：{tomorrowFirstCourse.teacher}</span>
                )}
              </div>
            </div>
          ) : (
            <div className="p-2.5 bg-[#222530] rounded text-xs text-[#8f8b80]">
              明天暂无排课安排，可以好好休息或预习后续课程。
            </div>
          )}

          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <button
              onClick={() => setPreviewTomorrow(true)}
              className="flex-1 min-w-[140px] py-2 px-3 bg-[#6b7cff] hover:bg-[#5b6cee] text-white font-bold text-xs rounded flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-colors"
            >
              <span>提前在今日页预览明天日程</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            {onOpenWeekSchedule && (
              <button
                onClick={onOpenWeekSchedule}
                className="py-2 px-3 bg-[#242732] hover:bg-[#2d3140] text-[#e9e4d8] border border-[#3a3e50] font-semibold text-xs rounded flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Calendar className="w-3.5 h-3.5 text-[#6b7cff]" />
                <span>提前打开完整课表</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Progress Card */}
      <div className="bg-[#1f2228] border-2 border-[#e9e4d8] p-4 text-[#e9e4d8] shadow-sm">
        <div className="flex items-center justify-between border-b border-[#343740] pb-2 mb-3">
          <div className="flex items-center gap-1.5 text-[9.5px] font-mono tracking-[3px] text-[#8f8b80]">
            <Clock className="w-3.5 h-3.5 text-[#6b7cff]" />
            <span>PROGRESS · {previewTomorrow ? '明日课程总览' : '今日课程进度'}</span>
          </div>

          {progressStats.statusType === 'done' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              全部结课
            </span>
          )}
          {progressStats.statusType === 'doing' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-[#6b7cff]/20 text-[#6b7cff] border border-[#6b7cff]/40 font-semibold animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-[#6b7cff]" />
              正在上课
            </span>
          )}
          {progressStats.statusType === 'break' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
              <Coffee className="w-3 h-3 text-amber-400" />
              课间休息
            </span>
          )}
          {progressStats.statusType === 'upcoming' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-[#2e313c] text-[#a8a399] border border-[#3e4252] font-semibold">
              <Clock className="w-3 h-3" />
              {previewTomorrow ? '明日就绪' : '未开课'}
            </span>
          )}
          {progressStats.statusType === 'free' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-[#2e313c] text-[#a8a399] border border-[#3e4252] font-semibold">
              <Sparkles className="w-3 h-3" />
              {isSunday ? '周日休假' : '今日无课'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Circular Progress Ring */}
          <div className="relative shrink-0 flex items-center justify-center">
            <svg className="w-22 h-22 sm:w-24 sm:h-24 -rotate-90" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="todayRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  {progressStats.statusType === 'done' ? (
                    <>
                      <stop offset="0%" stopColor="#4ade80" />
                      <stop offset="100%" stopColor="#10b981" />
                    </>
                  ) : (
                    <>
                      <stop offset="0%" stopColor="#6b7cff" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </>
                  )}
                </linearGradient>
              </defs>
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="transparent"
                stroke="#2a2d36"
                strokeWidth="7.5"
              />
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="transparent"
                stroke="url(#todayRingGrad)"
                strokeWidth="7.5"
                strokeLinecap="round"
                strokeDasharray={238.76}
                strokeDashoffset={238.76 * (1 - progressStats.pct / 100)}
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
              <span className="font-editorial text-2xl font-extrabold text-[#e9e4d8] leading-none">
                {progressStats.pct}%
              </span>
              <span className="text-[7.5px] font-mono text-[#8f8b80] tracking-widest uppercase mt-1">
                {progressStats.statusType === 'done' ? 'DONE' : previewTomorrow ? 'TOMORROW' : 'PROGRESS'}
              </span>
            </div>
          </div>

          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="font-editorial text-base sm:text-lg font-bold text-[#e9e4d8] truncate">
              {progressStats.statusText}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#8f8b80] font-sans">
              <span>
                课程：<strong className="text-[#e9e4d8] font-mono">{progressStats.doneCount}</strong>/{displayCourses.length} 门已结
              </span>
              <span>
                时长：<strong className="text-[#e9e4d8] font-mono">{progressStats.completedMinutes}</strong>/{progressStats.totalMinutes} 分钟
              </span>
            </div>

            {displayCourses.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {displayCourses.map(c => {
                  const sMin = toMinutes(SLOTS[c.s].s);
                  const eMin = toMinutes(SLOTS[c.e].e);
                  const isDone = !previewTomorrow && currentMinutes >= eMin;
                  const isDoing = !previewTomorrow && sMin <= currentMinutes && currentMinutes <= eMin;

                  return (
                    <button
                      key={`prog-chip-${c.id}`}
                      onClick={() => onOpenCourse(c)}
                      className={`px-1.5 py-0.5 rounded text-[10px] transition-colors flex items-center gap-1 border cursor-pointer ${
                        isDoing
                          ? 'bg-[#6b7cff]/20 border-[#6b7cff] text-[#e9e4d8] font-bold shadow-xs'
                          : isDone
                          ? 'bg-[#181a20] border-[#2c2f38] text-[#69665f] line-through decoration-[#7a766c]'
                          : 'bg-[#262832] border-[#383c48] text-[#c8c4b8] hover:border-[#6b7cff]'
                      }`}
                      title={`${c.name} · 第${c.s}-${c.e}节 (${SLOTS[c.s].s}-${SLOTS[c.e].e})`}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: isDone ? '#63605a' : c.color }}
                      />
                      <span className="truncate max-w-[85px]">{c.name}</span>
                      <span className="text-[8.5px] font-mono opacity-70">
                        {isDoing ? '进行中' : isDone ? '✓' : SLOTS[c.s].s}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Now-in-class / Next class status card */}
      {!previewTomorrow && (
        activeCourse ? (
          (() => {
            const sMin = toMinutes(SLOTS[activeCourse.s].s);
            const eMin = toMinutes(SLOTS[activeCourse.e].e);
            const elapsed = currentMinutes - sMin;
            const total = eMin - sMin;
            const pct = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
            const leftMin = eMin - currentMinutes;

            return (
              <div
                onClick={() => onOpenCourse(activeCourse)}
                className="bg-[#101216] border border-[#33363d] text-[#e9e4d8] p-4.5 rounded cursor-pointer hover:border-[#6b7cff] transition-colors"
              >
                <div className="text-[9.5px] tracking-[4px] font-bold text-[#7a766c]">
                  NOW · 正在上课
                </div>
                <div className="font-editorial text-2xl font-bold my-1 text-[#e9e4d8]">
                  {activeCourse.name}
                </div>
                <div className="text-xs text-[#9a968c]">
                  {activeCourse.room || '地点待定'}
                  {activeCourse.teacher ? ` · ${activeCourse.teacher}` : ''} · 第
                  {activeCourse.s}-{activeCourse.e}节
                </div>
                <div className="h-1 bg-[#2a2d34] mt-3.5 overflow-hidden">
                  <div
                    className="h-full bg-[#6b7cff] transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10.5px] text-[#7a766c] mt-2 font-mono">
                  <span>还剩 {leftMin} 分钟</span>
                  <span>{pct}% ELAPSED</span>
                </div>
              </div>
            );
          })()
        ) : nextCourse ? (
          <div
            onClick={() => onOpenCourse(nextCourse)}
            className="bg-[#26282e] border-2 border-[#e9e4d8] p-4 rounded text-[#e9e4d8] cursor-pointer hover:border-[#6b7cff] transition-colors"
          >
            <div className="text-[9.5px] tracking-[4px] font-bold text-[#8f8b80]">
              NEXT · 下一节课
            </div>
            <div className="font-editorial text-2xl font-bold my-1 text-[#e9e4d8]">
              {nextCourse.name}
            </div>
            <div className="text-xs text-[#8f8b80]">
              {SLOTS[nextCourse.s].s} 开始 · {nextCourse.room || '地点待定'}
              {nextCourse.teacher ? ` · ${nextCourse.teacher}` : ''}
            </div>
          </div>
        ) : (
          <div className="bg-[#26282e] border border-[#33363d] p-4 rounded text-[#e9e4d8]">
            <div className="text-[9.5px] tracking-[4px] font-bold text-[#8f8b80]">
              FREE · 空闲
            </div>
            <div className="font-editorial text-xl font-bold my-1 text-[#e9e4d8]">
              {isSunday ? '周日全天无课 · 享受周末时光' : '今日课程已全部结束'}
            </div>
            <div className="text-xs text-[#8f8b80]">
              {isSunday ? '新一周课程已为您在周日晚间提前更新，可随时查看明早安排' : '好好休息，或者处理一下未完成的作业与任务'}
            </div>
          </div>
        )
      )}

      {/* Editorial Quotation */}
      <div className="font-editorial italic text-[14.5px] text-[#a8a399] border-l-[3px] border-[#6b7cff] pl-3 py-0.5 leading-relaxed">
        “ 别急着拍 PPT，拍了你也不会再看 ”
      </div>

      {/* Timeline Section Title */}
      <div className="flex justify-between items-baseline text-[10px] tracking-[3px] text-[#8f8b80] font-bold border-b border-[#e9e4d8] pb-1.5 pt-2">
        <span>{previewTomorrow ? '明日课程 · TOMORROW\'S CLASSES' : '今日课程 · TODAY\'S CLASSES'}</span>
        <span className="font-mono">{displayCourses.length ? `${displayCourses.length} 门` : '无课'}</span>
      </div>

      {/* Grouped Timetable */}
      {displayCourses.length === 0 ? (
        <div className="py-12 text-center text-[#63605a] font-editorial italic text-sm">
          — {previewTomorrow ? '明天没有课' : '今天没有课，好好休息'} —
        </div>
      ) : (
        <div className="space-y-4">
          {[
            { title: '上午 · MORNING', list: displayCourses.filter(c => c.s <= 4) },
            { title: '下午 · AFTERNOON', list: displayCourses.filter(c => c.s >= 5 && c.s <= 8) },
            { title: '晚上 · EVENING', list: displayCourses.filter(c => c.s >= 9) },
          ].map(grp => {
            if (!grp.list.length) return null;
            return (
              <div key={grp.title}>
                <div className="text-[9.5px] tracking-[3px] text-[#63605a] font-bold pb-1 mb-1 border-b border-[#33363d]">
                  {grp.title}
                </div>
                <div className="divide-y divide-[#2a2d34]">
                  {grp.list.map(c => {
                    const sMin = toMinutes(SLOTS[c.s].s);
                    const eMin = toMinutes(SLOTS[c.e].e);
                    const isDoing = !previewTomorrow && sMin <= currentMinutes && currentMinutes <= eMin;
                    const isDone = !previewTomorrow && currentMinutes > eMin;
                    const hwFlag = hwMap[c.name];

                    return (
                      <div
                        key={c.id}
                        onClick={() => onOpenCourse(c)}
                        className={`flex gap-3 py-3.5 cursor-pointer transition-colors hover:bg-white/[0.03] ${
                          isDone ? 'opacity-45' : ''
                        }`}
                      >
                        <div className="w-12 shrink-0 font-editorial font-bold text-sm leading-tight">
                          <div>{SLOTS[c.s].s}</div>
                          <div className="text-[10px] text-[#8f8b80] font-sans font-normal">
                            {SLOTS[c.e].e}
                          </div>
                        </div>

                        <div className="w-3.5 flex justify-center relative shrink-0 pt-1">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isDoing
                                ? 'bg-[#6b7cff] ring-4 ring-[#6b7cff]/20'
                                : isDone
                                ? 'bg-[#63605a]'
                                : 'bg-[#e9e4d8]'
                            }`}
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-base text-[#e9e4d8] truncate">
                              {c.name}
                            </span>
                            {hwFlag && (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 border text-xs shrink-0 ${
                                  hwFlag.urgent
                                    ? 'bg-[#ff6b57] border-[#ff6b57] text-white'
                                    : hwFlag.soon
                                    ? 'bg-[#33270f] border-[#d99a4e] text-[#e0a050]'
                                    : 'border-[#e9e4d8] text-[#e9e4d8]'
                                }`}
                              >
                                {hwFlag.text}
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-[#8f8b80] mt-1 truncate">
                            第{c.s}-{c.e}节 · {c.room || '地点待定'}
                            {c.teacher ? ` · ${c.teacher}` : ''}
                          </div>

                          {hwFlag && (
                            <div className="mt-1.5">
                              <span className="inline-block text-[11px] px-2 py-0.5 bg-[#23263a] border border-[#4a4e6e] text-[#a8b0f0]">
                                📌 待完成作业 · {hwFlag.text}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="font-editorial text-xs italic shrink-0 pt-0.5 text-[#8f8b80]">
                          {previewTomorrow ? (
                            <span className="text-[#8ea4ff]">明日课程</span>
                          ) : isDoing ? (
                            <span className="text-[#6b7cff] font-bold not-italic">进行中</span>
                          ) : isDone ? (
                            '已结束'
                          ) : (
                            '未开始'
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Weather Note */}
      <div className="mt-6 pt-3 border-t border-[#33363d] text-xs text-[#8f8b80] tracking-wide flex items-center justify-between">
        <span>☀ 26°C 晴 —— 未来两小时预计无雨，放心出门上课吧</span>
        {!previewTomorrow && tomorrowCourses.length > 0 && (
          <button
            onClick={() => setPreviewTomorrow(true)}
            className="text-[#6b7cff] hover:underline cursor-pointer"
          >
            提前查看明日日程 ›
          </button>
        )}
      </div>
    </div>
  );
};
