export const SEM_START = new Date(2026, 8, 7); // 2026-09-07 Week 1 Monday

export const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
export const WEEKDAYS_FULL = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];
export const MONTHS_EN = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
];

export const SLOTS: Record<number, { s: string; e: string; label: string }> = {
  1: { s: "08:20", e: "09:05", label: "08:20 - 09:05" },
  2: { s: "09:10", e: "09:55", label: "09:10 - 09:55" },
  3: { s: "10:15", e: "11:00", label: "10:15 - 11:00" },
  4: { s: "11:05", e: "11:50", label: "11:05 - 11:50" },
  5: { s: "14:20", e: "15:05", label: "14:20 - 15:05" },
  6: { s: "15:10", e: "15:55", label: "15:10 - 15:55" },
  7: { s: "16:15", e: "17:00", label: "16:15 - 17:00" },
  8: { s: "17:05", e: "17:50", label: "17:05 - 17:50" },
  9: { s: "19:00", e: "19:45", label: "19:00 - 19:45" },
  10: { s: "19:55", e: "20:40", label: "19:55 - 20:40" },
  11: { s: "20:50", e: "21:35", label: "20:50 - 21:35" },
};

export const PALETTE = [
  "#4f63e8", "#a85268", "#4e8a6a", "#9a7448",
  "#4a6b80", "#7a70a0", "#3d4450", "#7a766c"
];

export function mondayOf(d: Date): Date {
  const x = new Date(d);
  const w = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - w);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function getWeekNo(d: Date): number {
  const diff = mondayOf(d).getTime() - mondayOf(SEM_START).getTime();
  return Math.floor(diff / (7 * 864e5)) + 1;
}

export function parseWeekSet(ws?: string): Set<number> {
  const s = new Set<number>();
  if (!ws) return s;
  String(ws).split(/[,，;；]/).forEach(p => {
    const m = /^\s*(\d+)\s*-\s*(\d+)\s*周?\s*$/.exec(p) || /^\s*(\d+)\s*周\s*$/.exec(p);
    if (m) {
      const a = +m[1];
      const b = m[2] !== undefined ? +m[2] : a;
      for (let i = a; i <= b; i++) {
        if (i > 0 && i <= 30) s.add(i);
      }
    }
  });
  return s;
}

export function isCourseInWeek(week: number, ws?: string): boolean {
  const set = parseWeekSet(ws);
  return set.size === 0 || set.has(week);
}

export function isWeeksOverlap(a?: string, b?: string): boolean {
  const A = parseWeekSet(a);
  const B = parseWeekSet(b);
  if (!A.size || !B.size) return true;
  for (const x of A) {
    if (B.has(x)) return true;
  }
  return false;
}

export function toMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

export function dueDays(dueDate?: string): number {
  if (!dueDate) return Infinity;
  const target = new Date(dueDate).setHours(0, 0, 0, 0);
  const today = new Date().setHours(0, 0, 0, 0);
  return Math.floor((target - today) / 864e5);
}

export function formatDueText(days: number): string {
  if (days === Infinity) return "无截止";
  if (days < 0) return "已逾期";
  if (days === 0) return "今天截止";
  return `${days}天后截止`;
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function isSundayEvening(d: Date = new Date(), startHour = 18): boolean {
  // Sunday is 0 in JS Date
  return d.getDay() === 0 && d.getHours() >= startHour;
}

export function isEveningTime(d: Date = new Date(), startHour = 19): boolean {
  return d.getHours() >= startHour;
}

export function getNextDayInfo(d: Date = new Date()): {
  date: Date;
  weekNo: number;
  dayIdx: number; // 0=Mon..6=Sun
  isMonday: boolean;
  dateStr: string;
} {
  const tom = new Date(d);
  tom.setDate(tom.getDate() + 1);
  const weekNo = Math.max(1, Math.min(25, getWeekNo(tom)));
  const dayIdx = (tom.getDay() + 6) % 7;
  return {
    date: tom,
    weekNo,
    dayIdx,
    isMonday: dayIdx === 0,
    dateStr: `${tom.getMonth() + 1}月${tom.getDate()}日`
  };
}

export function getRecommendedTimetableWeek(d: Date = new Date(), sundayAutoAdvance = true): number {
  const currentWeek = Math.max(1, Math.min(25, getWeekNo(d)));
  if (sundayAutoAdvance && isSundayEvening(d, 18)) {
    return Math.min(25, currentWeek + 1);
  }
  return currentWeek;
}


export function calculateDetailedRemaining(dueStr?: string): {
  remainingTime: string;
  isUrgent: boolean;
  isOverdue: boolean;
} {
  if (!dueStr) {
    return { remainingTime: '无截止时间', isUrgent: false, isOverdue: false };
  }

  let targetDate: Date;
  if (dueStr.includes(' ')) {
    targetDate = new Date(dueStr.replace(/-/g, '/'));
  } else {
    targetDate = new Date(`${dueStr.replace(/-/g, '/')} 23:59:59`);
  }

  if (isNaN(targetDate.getTime())) {
    return { remainingTime: dueStr, isUrgent: false, isOverdue: false };
  }

  const now = new Date();
  const diffMs = targetDate.getTime() - now.getTime();

  if (diffMs <= 0) {
    return { remainingTime: '已截止', isUrgent: true, isOverdue: true };
  }

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 24) {
    const hours = Math.max(1, diffHours);
    return {
      remainingTime: `剩余 ${hours}小时 (即将截止)`,
      isUrgent: true,
      isOverdue: false,
    };
  }

  const days = Math.floor(diffHours / 24);
  const hours = diffHours % 24;
  const remainingTime = hours > 0 ? `剩余 ${days}天 ${hours}小时` : `剩余 ${days}天`;
  return {
    remainingTime,
    isUrgent: days <= 1,
    isOverdue: false,
  };
}
