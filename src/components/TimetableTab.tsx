import React, { useState } from 'react';
import { Course, Homework } from '../types';
import {
  WEEKDAYS,
  SLOTS,
  mondayOf,
  getWeekNo,
  pad2,
  SEM_START,
  isCourseInWeek,
  dueDays,
  isSundayEvening
} from '../utils/time';
import { ChevronLeft, ChevronRight, Edit3, Check, Calendar, Moon } from 'lucide-react';

interface TimetableTabProps {
  courses: Course[];
  homework: Homework[];
  onOpenCourse: (course: Course) => void;
  onQuickAdd: (day: number, slot: number, week: number) => void;
  onRefreshCourses?: () => void;
  sundayAutoAdvance?: boolean;
  initialWeek?: number;
  toast?: (msg: string) => void;
}

export const TimetableTab: React.FC<TimetableTabProps> = ({
  courses,
  homework,
  onOpenCourse,
  onQuickAdd,
  onRefreshCourses,
  sundayAutoAdvance = true,
  initialWeek,
  toast,
}) => {
  const now = new Date();
  const realCurrentWeek = Math.max(1, Math.min(25, getWeekNo(now)));
  const isSundayEve = isSundayEvening(now, 18);
  const recommendedWeek = (sundayAutoAdvance && isSundayEve)
    ? Math.min(25, realCurrentWeek + 1)
    : realCurrentWeek;
  const [viewWeek, setViewWeek] = useState(initialWeek || recommendedWeek);
  const [isEditMode, setIsEditMode] = useState(false);

  const isCurrentWeek = viewWeek === realCurrentWeek;
  const isNextWeekPreview = viewWeek === realCurrentWeek + 1 && isSundayEve;
  const todayDayIdx = (now.getDay() + 6) % 7;

  // Compute Monday for the selected week
  const weekMonday = new Date(mondayOf(SEM_START));
  weekMonday.setDate(weekMonday.getDate() + (viewWeek - 1) * 7);

  // Homework mapping
  const hwFlagMap = React.useMemo(() => {
    const map: Record<string, { days: number; label: string; urgent: boolean; soon: boolean }> = {};
    homework.forEach(h => {
      if (h.done || !h.course) return;
      const d = dueDays(h.due);
      const existing = map[h.course];
      if (!existing || d < existing.days) {
        map[h.course] = {
          days: d,
          label: h.remainingTime ? h.remainingTime.replace(' (即将截止)', '') : d < 0 ? '逾期' : d === 0 ? '今天' : `${d}天`,
          urgent: d <= 0 || (h.remainingTime ? h.remainingTime.includes('即将截止') : false),
          soon: d > 0 && d <= 2,
        };
      }
    });
    return map;
  }, [homework]);

  // Filter courses for the selected week
  const weekCourses = courses.filter(c => isCourseInWeek(viewWeek, c.weeks));

  // Build the 11-slot unified grid elements
  const gridCells: React.ReactNode[] = [];

  for (let p = 1; p <= 11; p++) {
    // 1st col: Period slot time label
    gridCells.push(
      <div
        key={`slot-label-${p}`}
        className="flex flex-col justify-center items-center text-center py-1 font-editorial text-[#8f8b80] min-h-[52px] border-r border-[#33363d]/40 select-none"
      >
        <span className="text-xs font-bold">{p}</span>
        <span className="text-[7.5px] font-mono text-[#63605a] leading-tight mt-0.5">
          {SLOTS[p].s}
        </span>
      </div>
    );

    // 7 days columns
    for (let d = 0; d < 7; d++) {
      const courseStartingHere = weekCourses.find(c => c.day === d && c.s === p);
      const isSpannedByPrior = weekCourses.some(c => c.day === d && c.s < p && c.e >= p);

      if (courseStartingHere) {
        const span = courseStartingHere.e - courseStartingHere.s + 1;
        const hwFlag = hwFlagMap[courseStartingHere.name];

        gridCells.push(
          <div
            key={`cls-${courseStartingHere.id}-${p}-${d}`}
            onClick={() => onOpenCourse(courseStartingHere)}
            style={{
              gridRow: `span ${span}`,
              backgroundColor: courseStartingHere.color,
            }}
            className="relative p-1.5 rounded-[3px] text-white overflow-hidden cursor-pointer active:scale-[0.98] transition-transform flex flex-col justify-between shadow-xs select-none"
          >
            {/* Homework Countdown Badge */}
            {hwFlag && (
              <span
                className={`absolute top-0.5 right-0.5 text-[7.5px] font-extrabold px-1 py-0.2 leading-tight border z-10 ${
                  hwFlag.urgent
                    ? 'bg-[#ff6b57] text-white border-black animate-pulse'
                    : hwFlag.soon
                    ? 'bg-[#ffe9c4] text-[#8a5a00] border-[#8a5a00]'
                    : 'bg-[#e9e4d8] text-[#1d1f24] border-black'
                }`}
              >
                {hwFlag.label}
              </span>
            )}

            <div>
              <div className="font-bold text-[10.5px] leading-tight pr-1 line-clamp-2">
                {courseStartingHere.name}
              </div>
              {courseStartingHere.room && (
                <div className="text-[8.5px] opacity-85 leading-tight mt-0.5 line-clamp-1">
                  @{courseStartingHere.room}
                </div>
              )}
            </div>

            {courseStartingHere.teacher && (
              <div className="text-[8px] opacity-75 truncate text-right">
                {courseStartingHere.teacher}
              </div>
            )}
          </div>
        );
      } else if (!isSpannedByPrior) {
        gridCells.push(
          <div
            key={`empty-${p}-${d}`}
            onClick={() => isEditMode && onQuickAdd(d, p, viewWeek)}
            className={`min-h-[52px] rounded-[2px] transition-colors ${
              isEditMode
                ? 'border border-dashed border-[#3a3d44] hover:bg-[#6b7cff]/10 hover:border-[#6b7cff] flex items-center justify-center cursor-pointer text-[#4a4d55] hover:text-[#6b7cff] font-bold text-sm'
                : 'border border-transparent hover:bg-white/[0.02]'
            }`}
          >
            {isEditMode && '+'}
          </div>
        );
      }

      // Lunch break divider
      if (p === 4 && d === 6) {
        gridCells.push(
          <div
            key="break-lunch"
            style={{ gridColumn: '1 / -1' }}
            className="text-center text-[9px] tracking-[8px] text-[#63605a] py-1 border-y border-[#33363d]/60 font-mono my-0.5 bg-[#121317]"
          >
            午 休 · LUNCH BREAK
          </div>
        );
      }

      // Dinner break divider
      if (p === 8 && d === 6) {
        gridCells.push(
          <div
            key="break-dinner"
            style={{ gridColumn: '1 / -1' }}
            className="text-center text-[9px] tracking-[8px] text-[#63605a] py-1 border-y border-[#33363d]/60 font-mono my-0.5 bg-[#121317]"
          >
            晚 休 · DINNER BREAK
          </div>
        );
      }
    }
  }

  return (
    <div className="space-y-3 pb-8 select-none">
      {/* Header with week switcher & edit button */}
      <div className="flex items-center justify-between border-b-[2.5px] border-[#e9e4d8] pb-2.5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewWeek(w => Math.max(1, w - 1))}
            className="w-8 h-8 border-[1.5px] border-[#e9e4d8] hover:bg-[#e9e4d8] hover:text-[#1d1f24] flex items-center justify-center transition-colors cursor-pointer text-[#e9e4d8]"
            title="前一周"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-baseline gap-1.5 px-1.5">
            <span className="text-[10px] tracking-[3px] text-[#8f8b80] font-bold font-mono">
              WEEK
            </span>
            <span className="font-editorial text-2xl sm:text-3xl font-extrabold text-[#e9e4d8] min-w-[36px] text-center">
              {pad2(viewWeek)}
            </span>
          </div>
          <button
            onClick={() => setViewWeek(w => Math.min(25, w + 1))}
            className="w-8 h-8 border-[1.5px] border-[#e9e4d8] hover:bg-[#e9e4d8] hover:text-[#1d1f24] flex items-center justify-center transition-colors cursor-pointer text-[#e9e4d8]"
            title="后一周"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {!isCurrentWeek && (
            <button
              onClick={() => setViewWeek(realCurrentWeek)}
              className="text-[11px] font-bold px-2 py-1 bg-[#6b7cff]/20 text-[#6b7cff] border border-[#6b7cff]/40 rounded hover:bg-[#6b7cff] hover:text-white transition-colors cursor-pointer flex items-center gap-1"
            >
              <Calendar className="w-3 h-3" />
              回第{realCurrentWeek}周
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`px-3 py-1 text-xs font-bold tracking-[2px] border-[1.5px] transition-colors flex items-center gap-1.5 cursor-pointer ${
              isEditMode
                ? 'bg-[#e9e4d8] text-[#1d1f24] border-[#e9e4d8]'
                : 'border-[#e9e4d8] text-[#e9e4d8] hover:bg-[#e9e4d8] hover:text-[#1d1f24]'
            }`}
          >
            {isEditMode ? (
              <>
                <Check className="w-3.5 h-3.5" />
                完成
              </>
            ) : (
              <>
                <Edit3 className="w-3.5 h-3.5" />
                编辑
              </>
            )}
          </button>
        </div>
      </div>

      {/* Edit Mode Tip */}
      {isEditMode && (
        <div className="bg-[#1e2438] border border-dashed border-[#3d4a8a] text-[#93a1f0] text-xs p-2.5 rounded leading-relaxed">
          编辑模式：点击 <strong>空格子 ＋</strong> 快速添加课程，点击 <strong>已有课程色块</strong> 修改或删除。
        </div>
      )}

      {/* Sunday Evening Auto Advance Banner */}
      {isNextWeekPreview && (
        <div className="bg-[#1b2234] border border-[#6b7cff] text-[#8ea4ff] text-xs p-2.5 rounded flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <Moon className="w-4 h-4 text-[#6b7cff] shrink-0" />
            <span>周日晚间课表已为您<strong>提前切换至第 {viewWeek} 周</strong>（明天周一开课）</span>
          </div>
          <button
            onClick={() => setViewWeek(realCurrentWeek)}
            className="text-[11px] underline hover:text-white cursor-pointer shrink-0 ml-2"
          >
            切回本周第 {realCurrentWeek} 周
          </button>
        </div>
      )}

      {/* Timetable Table Grid */}
      <div className="border border-[#33363d] bg-[#1a1c21] overflow-hidden rounded shadow-sm">
        {/* Header row: time col + 7 weekdays */}
        <div className="grid grid-cols-[28px_repeat(7,1fr)] bg-[#202227] border-b-2 border-[#e9e4d8] gap-[2px] p-1">
          <div className="border-r border-[#33363d]/40" />
          {WEEKDAYS.map((name, i) => {
            const dateObj = new Date(weekMonday);
            dateObj.setDate(dateObj.getDate() + i);
            const isToday = isCurrentWeek && i === todayDayIdx;

            return (
              <div
                key={name}
                className={`text-center py-1.5 rounded-[2px] ${
                  isToday ? 'bg-[#e9e4d8] text-[#1d1f24] font-bold' : 'text-[#8f8b80]'
                }`}
              >
                <div className="text-[11px] font-bold leading-tight">{name}</div>
                <div
                  className={`text-[9px] font-mono leading-none mt-0.5 ${
                    isToday ? 'text-[#63605a]' : 'text-[#63605a]'
                  }`}
                >
                  {dateObj.getMonth() + 1}/{dateObj.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* 11 Period Slots Unified Grid Body */}
        <div className="grid grid-cols-[28px_repeat(7,1fr)] gap-[2px] p-1 bg-[#16181d]">
          {gridCells}
        </div>
      </div>
    </div>
  );
};
