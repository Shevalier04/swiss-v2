import React, { useEffect, useState } from 'react';
import { Course } from '../types';
import { SLOTS, toMinutes } from '../utils/time';
import { X } from 'lucide-react';

interface ReminderToastProps {
  course: Course;
  onDismiss: () => void;
  onClick: () => void;
}

export const ReminderToast: React.FC<ReminderToastProps> = ({
  course,
  onDismiss,
  onClick,
}) => {
  const [leftMinutes, setLeftMinutes] = useState(() => {
    const sMin = toMinutes(SLOTS[course.s].s);
    const now = new Date();
    return sMin - (now.getHours() * 60 + now.getMinutes());
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const sMin = toMinutes(SLOTS[course.s].s);
      const now = new Date();
      const left = sMin - (now.getHours() * 60 + now.getMinutes());
      setLeftMinutes(left);
      if (left <= 0) {
        clearInterval(timer);
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [course]);

  return (
    <div
      onClick={onClick}
      className="fixed left-1/2 -translate-x-1/2 bottom-20 z-50 w-[calc(100%-32px)] max-w-[450px] bg-[#1c1e23] border-2 border-[#6b7cff] shadow-2xl p-3.5 flex items-center gap-3.5 cursor-pointer rounded-lg text-[#e9e4d8] animate-bounce-subtle"
    >
      <div className="w-1.5 self-stretch bg-[#6b7cff] rounded-full shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="font-editorial font-bold text-base text-[#e9e4d8] truncate flex items-center gap-1.5">
          <span>即将上课 ·</span>
          <span className="text-[#6b7cff]">{course.name}</span>
        </div>
        <div className="text-xs text-[#8f8b80] mt-0.5 truncate">
          {SLOTS[course.s].s} 开始 ｜ 第{course.s}-{course.e}节
          {course.room ? ` ｜ @${course.room}` : ''}
          {course.teacher ? ` ｜ ${course.teacher}` : ''}
        </div>
      </div>

      <div className="font-editorial text-2xl font-extrabold text-[#6b7cff] shrink-0 font-mono flex items-baseline">
        <span>{Math.max(1, leftMinutes)}</span>
        <span className="text-xs ml-0.5">分</span>
      </div>

      <button
        onClick={e => {
          e.stopPropagation();
          onDismiss();
        }}
        className="p-1 text-[#8f8b80] hover:text-[#e9e4d8] shrink-0 cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
