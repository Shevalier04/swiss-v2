import { Course, Homework } from '../types';
import { SLOTS } from './time';

const SEM_START = new Date(2026, 8, 7); // 2026-09-07 Week 1 Monday

function parseWeeks(ws?: string): number[] {
  const weeks: number[] = [];
  if (!ws) {
    for (let i = 1; i <= 20; i++) weeks.push(i);
    return weeks;
  }
  String(ws).split(/[,，;；]/).forEach(p => {
    const m = /^\s*(\d+)\s*-\s*(\d+)\s*周?\s*$/.exec(p) || /^\s*(\d+)\s*周\s*$/.exec(p);
    if (m) {
      const a = +m[1];
      const b = m[2] !== undefined ? +m[2] : a;
      for (let i = a; i <= b; i++) {
        if (i > 0 && i <= 30 && !weeks.includes(i)) weeks.push(i);
      }
    }
  });
  return weeks.sort((a, b) => a - b);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatICSDate(d: Date, timeStr: string): string {
  const [h, m] = timeStr.split(':');
  const year = d.getFullYear();
  const month = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${year}${month}${day}T${pad2(Number(h))}${pad2(Number(m))}00`;
}

function parseDueDateTime(dueStr?: string): { start: string; end: string } | null {
  const trimmed = String(dueStr || '').trim();
  if (!trimmed) return null;

  const m = /^(\d{2,4})[-/.年](\d{1,2})[-/.月](\d{1,2})[日号]?(?:\s+(\d{1,2}):(\d{1,2}))?/.exec(trimmed);
  if (!m) return null;

  let yVal = Number(m[1]);
  if (yVal < 100) yVal += 2000;
  const year = String(yVal);
  const month = pad2(Number(m[2]));
  const day = pad2(Number(m[3]));
  const hour = m[4] ? Number(m[4]) : 22; // 默认晚 22:00 截止
  const minute = m[5] ? Number(m[5]) : 0;

  const startHour = Math.max(0, hour - 1);
  const start = `${year}${month}${day}T${pad2(startHour)}${pad2(minute)}00`;
  const end = `${year}${month}${day}T${pad2(hour)}${pad2(minute)}00`;
  return { start, end };
}

export function generateClientICS(studentName: string, courses: Course[], homework: Homework[] = []): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Swiss Timetable//Schedule//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:掌上课表 · ${studentName}`,
    'X-WR-TIMEZONE:Asia/Shanghai',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H'
  ];

  // 1. Courses VEVENTs
  courses.forEach(c => {
    const weekList = parseWeeks(c.weeks);
    const sTime = SLOTS[c.s]?.s || '08:00';
    const eTime = SLOTS[c.e]?.e || '09:00';

    weekList.forEach(w => {
      const courseDate = new Date(SEM_START);
      courseDate.setDate(courseDate.getDate() + (w - 1) * 7 + c.day);

      const dtStart = formatICSDate(courseDate, sTime);
      const dtEnd = formatICSDate(courseDate, eTime);
      const uid = `client-c${c.id}-w${w}-${dtStart}@timetable`;

      lines.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:20261010T000000Z`,
        `DTSTART;TZID=Asia/Shanghai:${dtStart}`,
        `DTEND;TZID=Asia/Shanghai:${dtEnd}`,
        `SUMMARY:${c.name}`,
        `LOCATION:${c.room || '待定地点'}`,
        `DESCRIPTION:第${w}周 · 第${c.s}-${c.e}节\\n教师：${c.teacher || '待定'}\\n教室：${c.room || '待定'}`,
        'STATUS:CONFIRMED',
        'BEGIN:VALARM',
        'TRIGGER:-PT10M',
        'ACTION:DISPLAY',
        `DESCRIPTION:【上课提醒】${c.name} 即将开始 (${c.room || '待定'})`,
        'END:VALARM',
        'END:VEVENT'
      );
    });
  });

  // 2. Uncompleted Homework VEVENTs
  homework.forEach(h => {
    if (h.done) return;
    const dueInfo = parseDueDateTime(h.due);
    if (!dueInfo) return;

    const courseName = h.course || '日常学业';
    const hwTitle = h.title || '待办作业';
    const uid = `client-hw${h.id}-${dueInfo.start}@timetable`;

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:20261010T000000Z`,
      `DTSTART;TZID=Asia/Shanghai:${dueInfo.start}`,
      `DTEND;TZID=Asia/Shanghai:${dueInfo.end}`,
      `SUMMARY:[作业] ${courseName}：${hwTitle}`,
      `DESCRIPTION:课程：${courseName}\\n作业内容：${hwTitle}\\n截止时间：${h.due || '未注明'}\\n状态：待完成\\n来源：掌上课表`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT2H',
      'ACTION:DISPLAY',
      `DESCRIPTION:【作业截止提醒】${courseName}：${hwTitle} 截止临近，请及时提交！`,
      'END:VALARM',
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadCalendarFile(studentName: string, courses: Course[], homework: Homework[] = []) {
  const content = generateClientICS(studentName, courses, homework);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `掌上课表-${studentName}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function generateCancelICS(studentName: string, courses: Course[]): string {
  const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Swiss Timetable//Schedule//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:CANCEL',
    `X-WR-CALNAME:掌上课表 · ${studentName}`,
    'X-WR-TIMEZONE:Asia/Shanghai',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H'
  ];

  courses.forEach(c => {
    const weekList = parseWeeks(c.weeks);
    const sTime = SLOTS[c.s]?.s || '08:00';
    const eTime = SLOTS[c.e]?.e || '09:00';

    weekList.forEach(w => {
      const courseDate = new Date(SEM_START);
      courseDate.setDate(courseDate.getDate() + (w - 1) * 7 + c.day);

      const dtStart = formatICSDate(courseDate, sTime);
      const dtEnd = formatICSDate(courseDate, eTime);
      const uid = `client-c${c.id}-w${w}-${dtStart}@timetable`;

      lines.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${nowStamp}`,
        `DTSTART;TZID=Asia/Shanghai:${dtStart}`,
        `DTEND;TZID=Asia/Shanghai:${dtEnd}`,
        `SUMMARY:已取消 - ${c.name}`,
        'STATUS:CANCELLED',
        'SEQUENCE:2',
        'END:VEVENT'
      );
    });
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadCancelCalendarFile(studentName: string, courses: Course[]) {
  const content = generateCancelICS(studentName, courses);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `掌上课表-还原日历-${studentName}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
