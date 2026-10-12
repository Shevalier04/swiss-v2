import { Course, SLOT_INFO } from './data';

const SEM_START = new Date(2026, 8, 7); // 2026-09-07 (Fall 2026 Week 1 Monday)

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

export function generateICS(username: string, studentName: string, courses: Course[]): string {
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

  for (const c of courses) {
    const weekList = parseWeeks(c.weeks);
    const sTime = SLOT_INFO[c.s]?.s || '08:00';
    const eTime = SLOT_INFO[c.e]?.e || '09:00';

    for (const w of weekList) {
      const courseDate = new Date(SEM_START);
      courseDate.setDate(courseDate.getDate() + (w - 1) * 7 + c.day);

      const dtStart = formatICSDate(courseDate, sTime);
      const dtEnd = formatICSDate(courseDate, eTime);
      const uid = `${username}-c${c.id}-w${w}-${dtStart}@timetable`;

      lines.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:20261010T000000Z`,
        `DTSTART;TZID=Asia/Shanghai:${dtStart}`,
        `DTEND;TZID=Asia/Shanghai:${dtEnd}`,
        `SUMMARY:${c.name}`,
        `LOCATION:${c.room || '待定地点'}`,
        `DESCRIPTION:第${w}周 · 第${c.s}-${c.e}节\\n教师：${c.teacher || '待定'}\\n地点：${c.room || '待定'}`,
        'STATUS:CONFIRMED',
        'BEGIN:VALARM',
        'TRIGGER:-PT10M',
        'ACTION:DISPLAY',
        `DESCRIPTION:【上课提醒】${c.name} 还有10分钟开始 (${c.room || '待定'})`,
        'END:VALARM',
        'END:VEVENT'
      );
    }
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
