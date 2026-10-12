import React from 'react';
import { Course } from '../types';
import { SLOTS } from '../utils/time';
import { Bell, Moon, Calendar, ArrowRight, X, Sparkles } from 'lucide-react';

interface SundayEveModalProps {
  firstCourse: Course;
  tomorrowCoursesCount: number;
  nextWeekNo: number;
  onClose: () => void;
  onViewMonday: () => void;
  onViewWeekTimetable: () => void;
}

export const SundayEveModal: React.FC<SundayEveModalProps> = ({
  firstCourse,
  tomorrowCoursesCount,
  nextWeekNo,
  onClose,
  onViewMonday,
  onViewWeekTimetable,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none">
      <div className="w-full max-w-sm bg-[#1e2027] border-2 border-[#e9e4d8] text-[#e9e4d8] rounded-lg shadow-2xl p-5 space-y-4 animate-fade-in">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#33363d]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#6b7cff]/20 text-[#6b7cff] flex items-center justify-center">
              <Moon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-editorial text-lg font-bold tracking-wide">
                周日晚间提醒 · 明日早课
              </h3>
              <div className="text-[9px] font-mono tracking-widest text-[#8f8b80]">
                SUNDAY EVE CLASS ALERT
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#8f8b80] hover:text-[#e9e4d8] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Highlight Card */}
        <div className="p-4 rounded-md bg-[#252832] border border-[#6b7cff]/40 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono text-[#8f8b80]">
            <span className="flex items-center gap-1 text-[#6b7cff] font-bold">
              <Sparkles className="w-3 h-3" />
              第 {nextWeekNo} 周 · 周一首节课
            </span>
            <span className="bg-[#6b7cff]/20 text-[#8ea4ff] px-1.5 py-0.2 rounded font-bold">
              明日早晨
            </span>
          </div>

          <div className="font-editorial text-2xl font-extrabold text-[#e9e4d8]">
            {firstCourse.name}
          </div>

          <div className="space-y-1 text-xs text-[#a8a399] pt-1 border-t border-[#333644]">
            <div className="flex justify-between">
              <span>上课时间</span>
              <strong className="text-[#e9e4d8] font-mono">
                {SLOTS[firstCourse.s].s} - {SLOTS[firstCourse.e].e} (第{firstCourse.s}-{firstCourse.e}节)
              </strong>
            </div>
            <div className="flex justify-between">
              <span>教室地点</span>
              <strong className="text-[#e9e4d8]">{firstCourse.room || '待定地点'}</strong>
            </div>
            {firstCourse.teacher && (
              <div className="flex justify-between">
                <span>授课教师</span>
                <strong className="text-[#e9e4d8]">{firstCourse.teacher}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Message */}
        <div className="text-xs text-[#8f8b80] leading-relaxed bg-[#16181e] p-3 rounded border border-[#2a2d36]">
          明天周一共安排有 <strong className="text-[#e9e4d8] font-mono">{tomorrowCoursesCount}</strong> 门课程。课表已在后台提前更新就绪，今晚请记得设好闹钟早点休息！
        </div>

        {/* Buttons */}
        <div className="space-y-2 pt-1">
          <button
            onClick={onViewMonday}
            className="w-full py-2.5 bg-[#e9e4d8] hover:bg-white text-[#1d1f24] font-bold text-xs tracking-wider rounded flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-colors"
          >
            <span>提前查看明天（周一）完整日程</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onViewWeekTimetable}
            className="w-full py-2 bg-[#2a2d36] hover:bg-[#333742] text-[#e9e4d8] font-semibold text-xs tracking-wider rounded flex items-center justify-center gap-1.5 cursor-pointer border border-[#3e4252] transition-colors"
          >
            <Calendar className="w-3.5 h-3.5 text-[#6b7cff]" />
            <span>提前打开新一周课表（第{nextWeekNo}周）</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-1.5 text-center text-[11px] text-[#63605a] hover:text-[#8f8b80] cursor-pointer"
          >
            我知道了，今晚早点睡
          </button>
        </div>
      </div>
    </div>
  );
};
