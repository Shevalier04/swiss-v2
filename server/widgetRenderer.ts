import { Course, SLOT_INFO } from './data';

const WD_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const SEM_START = new Date(2026, 8, 7);

function mondayOf(d: Date): Date {
  const x = new Date(d);
  const w = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - w);
  x.setHours(0, 0, 0, 0);
  return x;
}

function getWeekNo(d: Date): number {
  const diff = mondayOf(d).getTime() - mondayOf(SEM_START).getTime();
  return Math.floor(diff / (7 * 864e5)) + 1;
}

function parseWeeks(ws?: string): Set<number> {
  const s = new Set<number>();
  if (!ws) return s;
  String(ws).split(/[,，;；]/).forEach(p => {
    const m = /^\s*(\d+)\s*-\s*(\d+)\s*周?\s*$/.exec(p) || /^\s*(\d+)\s*周\s*$/.exec(p);
    if (m) {
      const a = +m[1];
      const b = m[2] !== undefined ? +m[2] : a;
      for (let i = a; i <= b; i++) if (i > 0 && i <= 30) s.add(i);
    }
  });
  return s;
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function renderLiveWidgetSVG(studentName: string, courses: Course[]): string {
  const now = new Date();
  let weekNo = Math.max(1, Math.min(25, getWeekNo(now)));
  let dayIdx = (now.getDay() + 6) % 7;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // If Sunday evening (after 18:00), or late evening (after 21:00), advance to preview tomorrow!
  const isSundayEve = dayIdx === 6 && now.getHours() >= 18;
  const isLateEve = now.getHours() >= 21;
  const previewTomorrow = isSundayEve || isLateEve;

  let targetDate = new Date(now);
  if (previewTomorrow) {
    targetDate.setDate(targetDate.getDate() + 1);
    dayIdx = (dayIdx + 1) % 7;
    if (dayIdx === 0) {
      weekNo = Math.min(25, weekNo + 1);
    }
  }

  // Find courses for target day in target week
  const targetCourses = courses
    .filter(c => {
      if (c.day !== dayIdx) return false;
      const wSet = parseWeeks(c.weeks);
      return wSet.size === 0 || wSet.has(weekNo);
    })
    .sort((a, b) => a.s - b.s);

  const titleDate = previewTomorrow
    ? `${isSundayEve ? '周日晚预告 · 周一' : '明日 · ' + WD_NAMES[dayIdx]} (${targetDate.getMonth() + 1}月${targetDate.getDate()}日)`
    : `今天 · ${WD_NAMES[dayIdx]} (${now.getMonth() + 1}月${now.getDate()}日)`;
  const weekLabel = `第${weekNo}周`;

  const rows = targetCourses.slice(0, 3);
  const cardW = 520;
  const cardH = 340;

  let rowsSvg = '';
  let yOffset = 90;

  if (rows.length === 0) {
    rowsSvg = `
      <rect x="24" y="${yOffset}" width="472" height="180" rx="16" fill="#25272c" stroke="#33363d" stroke-width="1.5"/>
      <text x="260" y="${yOffset + 95}" fill="#8f8b80" font-size="18" text-anchor="middle" font-family="Georgia, serif">
        — 今天没有课程安排，好好休息 —
      </text>
    `;
  } else {
    rows.forEach((c) => {
      const sTime = SLOT_INFO[c.s]?.s || '08:00';
      const eTime = SLOT_INFO[c.e]?.e || '09:00';
      const [sh, sm] = sTime.split(':').map(Number);
      const [eh, em] = eTime.split(':').map(Number);
      const isDoing = currentMinutes >= (sh * 60 + sm) && currentMinutes <= (eh * 60 + em);
      const accent = c.color || '#6b7cff';

      rowsSvg += `
        <g transform="translate(24, ${yOffset})">
          <rect width="472" height="68" rx="14" fill="${isDoing ? '#2e323b' : '#25272c'}" stroke="${isDoing ? '#6b7cff' : '#33363d'}" stroke-width="${isDoing ? '2' : '1'}"/>
          <!-- Time -->
          <text x="18" y="28" fill="#f0efe9" font-size="15" font-weight="bold" font-family="monospace">${sTime}</text>
          <text x="18" y="48" fill="#8f8b80" font-size="12" font-family="monospace">${eTime}</text>
          <!-- Accent line -->
          <rect x="74" y="14" width="4" height="40" rx="2" fill="${accent}"/>
          <!-- Course name -->
          <text x="92" y="32" fill="#f5f4ed" font-size="16" font-weight="bold" font-family="Georgia, serif">${escapeXML(c.name)}</text>
          <!-- Room and teacher -->
          <text x="92" y="52" fill="#a09d94" font-size="12" font-family="sans-serif">第${c.s}-${c.e}节${c.room ? ` ｜ @${escapeXML(c.room)}` : ''}${c.teacher ? ` ｜ ${escapeXML(c.teacher)}` : ''}</text>
          ${isDoing ? `<rect x="400" y="22" width="56" height="24" rx="4" fill="#6b7cff"/><text x="428" y="38" fill="#ffffff" font-size="11" font-weight="bold" text-anchor="middle">上课中</text>` : ''}
        </g>
      `;
      yOffset += 78;
    });
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cardW} ${cardH}" width="${cardW}" height="${cardH}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#181a1f"/>
      <stop offset="100%" stop-color="#111317"/>
    </linearGradient>
  </defs>
  <!-- Background Card -->
  <rect width="${cardW}" height="${cardH}" rx="28" fill="url(#bg)" stroke="#3a3d46" stroke-width="2"/>
  
  <!-- Header Bar -->
  <g transform="translate(24, 46)">
    <!-- Calendar icon -->
    <rect x="0" y="-18" width="22" height="22" rx="5" fill="none" stroke="#6b7cff" stroke-width="2"/>
    <line x1="0" y1="-11" x2="22" y2="-11" stroke="#6b7cff" stroke-width="2"/>
    <text x="32" y="-1" fill="#f0efe9" font-size="18" font-weight="bold" font-family="Georgia, serif">${escapeXML(titleDate)}</text>
    <text x="${cardW - 48}" y="-1" fill="#8f8b80" font-size="14" font-weight="bold" text-anchor="end" font-family="sans-serif">${weekLabel} · ${escapeXML(studentName)}</text>
  </g>

  <!-- Rows -->
  ${rowsSvg}
</svg>`;
}
