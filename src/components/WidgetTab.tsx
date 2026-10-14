import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Course, User, Homework } from '../types';
import {
  WEEKDAYS,
  SLOTS,
  getWeekNo,
  toMinutes,
  isCourseInWeek,
} from '../utils/time';
import { downloadCalendarFile, downloadCancelCalendarFile } from '../utils/calendarExport';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  CheckCircle2,
  PictureInPicture2,
  Clock,
  X,
  Smartphone,
  LayoutGrid,
  Check,
  RotateCcw,
} from 'lucide-react';

interface WidgetTabProps {
  user?: User;
  courses: Course[];
  homework?: Homework[];
  leadMinutes: number;
  toast: (msg: string) => void;
  onOpenCourse: (course: Course) => void;
}

const ACCENTS = [
  '#8b5cf6',
  '#4f63e8',
  '#e0462c',
  '#4e8a6a',
  '#d99a2b',
  '#e9e4d8',
];

export const WidgetTab: React.FC<WidgetTabProps> = ({
  user,
  courses,
  homework = [],
  leadMinutes,
  toast,
  onOpenCourse,
}) => {
  const now = new Date();
  const isSundayEveNow = (now.getDay() === 0 && now.getHours() >= 18);
  const [dayOffset, setDayOffset] = useState(() => (isSundayEveNow ? 1 : 0));

  // Top Main Tab: 'poster' (课表画报) vs 'calendar' (系统日历)
  const [mainTab, setMainTab] = useState<'poster' | 'calendar'>('poster');

  // Poster Format: 'card' (小卡片 720x340) vs 'wallpaper' (锁屏壁纸 1080x1920)
  const [posterFormat, setPosterFormat] = useState<'card' | 'wallpaper'>('card');
  const [accentColor, setAccentColor] = useState('#8b5cf6');

  // Android / Huawei Calendar Guide Bottom Sheet
  const [showAndroidGuideSheet, setShowAndroidGuideSheet] = useState(false);

  // Document Picture-in-Picture State
  const [pipContainer, setPipContainer] = useState<HTMLElement | null>(null);
  const pipWindowRef = useRef<Window | null>(null);

  const username = user?.username || '2612114501';
  const studentName = user?.name || username;
  const syncStorageKey = `cs_cal_sync_${username}`;

  const [calendarSyncInfo, setCalendarSyncInfo] = useState<{
    synced: boolean;
    lastSyncTime?: string;
  }>(() => {
    try {
      const saved = localStorage.getItem(syncStorageKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { synced: false };
  });

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + dayOffset);

  const isToday = dayOffset === 0;
  const targetWeek = Math.max(1, Math.min(25, getWeekNo(targetDate)));
  const targetDayIdx = (targetDate.getDay() + 6) % 7;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const dayCourses = courses
    .filter(c => c.day === targetDayIdx && isCourseInWeek(targetWeek, c.weeks))
    .sort((a, b) => a.s - b.s);

  const pendingHomeworkList = useMemo(() => {
    return homework.filter(h => !h.done);
  }, [homework]);

  // Close PiP window when component unmounts
  useEffect(() => {
    return () => {
      if (pipWindowRef.current) {
        pipWindowRef.current.close();
      }
    };
  }, []);

  // 1. Export Calendar (.ics)
  const handleExportCalendar = () => {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isWeChat = /MicroMessenger/i.test(ua);

    if (isWeChat) {
      toast('微信内无法直接下载，请点击右上角「···」在浏览器中打开');
      return;
    }

    downloadCalendarFile(studentName, courses, homework);

    const n = new Date();
    const timeStr = `${n.getMonth() + 1}月${n.getDate()}日 ${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
    const newInfo = { synced: true, lastSyncTime: timeStr };
    setCalendarSyncInfo(newInfo);
    try {
      localStorage.setItem(syncStorageKey, JSON.stringify(newInfo));
    } catch (e) {}

    const isHuaweiOrHonor = /Huawei|Honor|HarmonyOS|HMA-|VOG-|ELE-|TAS-|NOH-|ANG-|JAD-|BRQ-|AL00/i.test(ua);
    const isAndroid = /Android/i.test(ua);

    if (isHuaweiOrHonor || isAndroid) {
      setShowAndroidGuideSheet(true);
    } else {
      toast('已生成并下载课程与待办作业日历 (.ics)！');
    }
  };

  // 2. Clear / Cancel Calendar (.ics)
  const handleResetCalendar = () => {
    downloadCancelCalendarFile(studentName, courses);
    const newInfo = { synced: false, lastSyncTime: undefined };
    setCalendarSyncInfo(newInfo);
    try {
      localStorage.setItem(syncStorageKey, JSON.stringify(newInfo));
    } catch (e) {}
    toast('已下载日历清空文件并重置！');
  };

  // 3. Document Picture-in-Picture
  const toggleFloatingPip = async () => {
    if (pipContainer) {
      if (pipWindowRef.current) {
        pipWindowRef.current.close();
      }
      setPipContainer(null);
      pipWindowRef.current = null;
      toast('已关闭桌面悬浮小窗');
      return;
    }

    try {
      if (typeof window !== 'undefined' && (window as any).documentPictureInPicture?.requestWindow) {
        const pipWindow = await (window as any).documentPictureInPicture.requestWindow({
          width: 380,
          height: 360,
        });
        pipWindowRef.current = pipWindow;

        // Copy styles
        [...document.styleSheets].forEach(styleSheet => {
          try {
            if (styleSheet.href) {
              const link = document.createElement('link');
              link.rel = 'stylesheet';
              link.href = styleSheet.href;
              pipWindow.document.head.appendChild(link);
            } else if (styleSheet.cssRules) {
              const style = document.createElement('style');
              [...styleSheet.cssRules].forEach(rule => {
                style.appendChild(document.createTextNode(rule.cssText));
              });
              pipWindow.document.head.appendChild(style);
            }
          } catch (e) {
            if (styleSheet.href) {
              const link = document.createElement('link');
              link.rel = 'stylesheet';
              link.href = styleSheet.href;
              pipWindow.document.head.appendChild(link);
            }
          }
        });

        pipWindow.document.title = '掌上课表 · 置顶悬浮挂件';
        pipWindow.document.body.className = 'bg-[#1d1f24] text-[#e9e4d8] p-3 font-sans overflow-hidden m-0 select-none';

        const container = pipWindow.document.createElement('div');
        container.style.height = '100%';
        pipWindow.document.body.appendChild(container);
        setPipContainer(container);

        pipWindow.addEventListener('pagehide', () => {
          setPipContainer(null);
          pipWindowRef.current = null;
        });

        toast('已开启桌面常驻置顶悬浮小窗！可拖动到屏幕任意角落');
      } else {
        // Fallback popup window
        const popup = window.open(
          '',
          '_blank',
          'width=380,height=360,menubar=no,toolbar=no,location=no,status=no'
        );
        if (popup) {
          pipWindowRef.current = popup;
          [...document.styleSheets].forEach(styleSheet => {
            try {
              if (styleSheet.href) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = styleSheet.href;
                popup.document.head.appendChild(link);
              } else if (styleSheet.cssRules) {
                const style = document.createElement('style');
                [...styleSheet.cssRules].forEach(rule => {
                  style.appendChild(document.createTextNode(rule.cssText));
                });
                popup.document.head.appendChild(style);
              }
            } catch (e) {
              if (styleSheet.href) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = styleSheet.href;
                popup.document.head.appendChild(link);
              }
            }
          });
          popup.document.title = '掌上课表 · 桌面悬浮挂件';
          popup.document.body.className = 'bg-[#1d1f24] text-[#e9e4d8] p-3 font-sans overflow-hidden m-0 select-none';
          const container = popup.document.createElement('div');
          container.style.height = '100%';
          popup.document.body.appendChild(container);
          setPipContainer(container);

          popup.addEventListener('beforeunload', () => {
            setPipContainer(null);
            pipWindowRef.current = null;
          });
          toast('已弹出桌面悬浮小窗！');
        } else {
          toast('浏览器阻止了弹出窗口，请在地址栏允许弹出窗口');
        }
      }
    } catch (e: any) {
      toast('开启悬浮窗失败: ' + (e.message || e));
    }
  };

  // 4. Canvas Drawing: Compact Card (720x340)
  const drawCardCanvas = (): HTMLCanvasElement => {
    const W = 720;
    const H = 340;
    const scale = 2;

    const cv = document.createElement('canvas');
    cv.width = W * scale;
    cv.height = H * scale;
    const g = cv.getContext('2d');
    if (!g) return cv;

    g.scale(scale, scale);

    // Background
    g.fillStyle = '#15171c';
    g.fillRect(0, 0, W, H);

    // Inner card
    const cardX = 20;
    const cardY = 20;
    const cardW = W - 40;
    const cardH = H - 40;
    g.fillStyle = '#202226';
    g.beginPath();
    g.roundRect(cardX, cardY, cardW, cardH, 20);
    g.fill();

    // Title
    const titleText = isToday
      ? `今天 / ${WEEKDAYS[targetDayIdx]}`
      : `${WEEKDAYS[targetDayIdx]} / ${targetDate.getMonth() + 1}月${targetDate.getDate()}日`;
    const weekText = `第${targetWeek}周 · ${studentName}`;

    g.fillStyle = '#f0efe9';
    g.font = 'bold 20px "Songti SC", Georgia, serif';
    g.fillText(titleText, cardX + 24, cardY + 38);

    g.textAlign = 'right';
    g.fillStyle = '#e6e4dd';
    g.font = '15px sans-serif';
    g.fillText(weekText, cardX + cardW - 24, cardY + 38);
    g.textAlign = 'left';

    // Courses (render up to 2 items in 340h)
    const list = dayCourses.slice(0, 2);
    let curY = cardY + 60;
    const rowH = 92;

    for (let i = 0; i < 2; i++) {
      const c = list[i];
      g.fillStyle = '#2b2d31';
      g.beginPath();
      g.roundRect(cardX + 16, curY, cardW - 32, rowH, 14);
      g.fill();

      if (c) {
        // Accent bar
        g.fillStyle = c.color || accentColor;
        g.beginPath();
        g.roundRect(cardX + 16 + 74, curY + 18, 4, rowH - 36, 2);
        g.fill();

        // Time
        g.fillStyle = '#f2f1ec';
        g.font = 'bold 15px sans-serif';
        g.fillText(SLOTS[c.s].s, cardX + 30, curY + 38);

        g.fillStyle = '#9b9a94';
        g.font = '12px sans-serif';
        g.fillText(SLOTS[c.e].e, cardX + 30, curY + 62);

        // Course Name
        g.fillStyle = '#ffffff';
        g.font = 'bold 16px "Songti SC", Georgia, serif';
        g.fillText(c.name, cardX + 96, curY + 38);

        // Meta
        g.fillStyle = '#a8a69e';
        g.font = '12px sans-serif';
        const meta = `第${c.s}-${c.e}节` + (c.room ? ` ｜ ${c.room}` : '') + (c.teacher ? ` ｜ ${c.teacher}` : '');
        g.fillText(meta, cardX + 96, curY + 62);
      } else {
        g.fillStyle = '#63605a';
        g.font = 'italic 14px sans-serif';
        g.textAlign = 'center';
        g.fillText(dayCourses.length === 0 && i === 0 ? '该日无更多课程' : '— 空闲 —', cardX + cardW / 2, curY + 50);
        g.textAlign = 'left';
      }

      curY += rowH + 10;
    }

    // Footer info
    g.fillStyle = '#8f8b80';
    g.font = '10px monospace';
    g.fillText('SWISS TIMETABLE · 720×340', cardX + 24, cardY + cardH - 14);

    if (pendingHomeworkList.length > 0) {
      g.textAlign = 'right';
      g.fillStyle = '#ff6b57';
      g.font = 'bold 11px sans-serif';
      g.fillText(`${pendingHomeworkList.length} 项作业待交`, cardX + cardW - 24, cardY + cardH - 14);
      g.textAlign = 'left';
    }

    return cv;
  };

  // 5. Canvas Drawing: Phone Lockscreen Wallpaper (1080x1920, 9:16)
  const drawWallpaperCanvas = (): HTMLCanvasElement => {
    const W = 1080;
    const H = 1920;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d');
    if (!g) return cv;

    // Background
    g.fillStyle = '#1d1f24';
    g.fillRect(0, 0, W, H);

    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1d1f24');
    grad.addColorStop(0.32, '#181a1f');
    grad.addColorStop(1, '#111216');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    // Top 32% (y = 0 to 614px) is reserved blank for iOS / Android Lockscreen clock & widgets
    const topReservedH = Math.round(H * 0.32); // 614px

    g.strokeStyle = '#2d3039';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(50, topReservedH);
    g.lineTo(W - 50, topReservedH);
    g.stroke();

    g.fillStyle = '#636056';
    g.font = '14px monospace';
    g.textAlign = 'center';
    g.fillText(`— 掌上课表 · SWISS EDITORIAL LOCKSCREEN · 第 ${targetWeek} 周 —`, W / 2, topReservedH - 12);
    g.textAlign = 'left';

    // Header
    const dateHeader = isToday
      ? `今天 · ${WEEKDAYS[targetDayIdx]} · 第${targetWeek}周`
      : `${WEEKDAYS[targetDayIdx]} · ${targetDate.getMonth() + 1}月${targetDate.getDate()}日 · 第${targetWeek}周`;

    g.fillStyle = '#ffffff';
    g.font = 'bold 42px "Songti SC", Georgia, serif';
    g.fillText(dateHeader, 50, topReservedH + 48);

    g.fillStyle = '#8f8b80';
    g.font = '20px monospace';
    g.fillText(`TODAY'S SCHEDULE ｜ 学员：${studentName} ｜ 今日课程：${dayCourses.length} 门`, 50, topReservedH + 82);

    // Section 1: 今日课程
    let curY = topReservedH + 115;
    g.fillStyle = accentColor;
    g.font = 'bold 20px monospace';
    g.fillText('// 01 · 今日课程安排 SCHEDULE', 50, curY);
    curY += 16;

    if (dayCourses.length === 0) {
      g.fillStyle = '#232630';
      g.beginPath();
      g.roundRect(50, curY, W - 100, 110, 16);
      g.fill();

      g.fillStyle = '#8f8b80';
      g.font = 'italic 22px sans-serif';
      g.textAlign = 'center';
      g.fillText('今天没有排课，享受充实惬意的自习或休息时间 ☕', W / 2, curY + 62);
      g.textAlign = 'left';
      curY += 135;
    } else {
      const renderCourses = dayCourses.slice(0, 5);
      renderCourses.forEach(c => {
        const cardH = 96;
        g.fillStyle = '#232630';
        g.beginPath();
        g.roundRect(50, curY, W - 100, cardH, 16);
        g.fill();

        // Left accent stripe
        g.fillStyle = c.color || accentColor;
        g.beginPath();
        g.roundRect(50, curY, 8, cardH, 4);
        g.fill();

        // Time range badge
        g.fillStyle = '#f0efe9';
        g.font = 'bold 24px monospace';
        g.fillText(`${SLOTS[c.s].s} - ${SLOTS[c.e].e}`, 80, curY + 40);

        // Course Name
        g.fillStyle = '#ffffff';
        g.font = 'bold 28px "Songti SC", Georgia, serif';
        const nameLimit = c.name.length > 14 ? c.name.slice(0, 13) + '…' : c.name;
        g.fillText(nameLimit, 80, curY + 76);

        // Meta info (Right side)
        g.textAlign = 'right';
        g.fillStyle = accentColor;
        g.font = 'bold 18px monospace';
        g.fillText(`第${c.s}-${c.e}节`, W - 80, curY + 38);

        g.fillStyle = '#9e9b92';
        g.font = '20px sans-serif';
        const meta = [c.room, c.teacher].filter(Boolean).join(' ｜ ');
        g.fillText(meta || '待定', W - 80, curY + 74);
        g.textAlign = 'left';

        curY += cardH + 14;
      });
      curY += 10;
    }

    // Section 2: 待交作业清单
    curY += 10;
    g.fillStyle = '#ff6b57';
    g.font = 'bold 20px monospace';
    g.fillText(`// 02 · 待交作业清单 PENDING HOMEWORK (${pendingHomeworkList.length})`, 50, curY);
    curY += 16;

    if (pendingHomeworkList.length === 0) {
      g.fillStyle = '#1e2422';
      g.beginPath();
      g.roundRect(50, curY, W - 100, 90, 16);
      g.fill();
      g.strokeStyle = '#274032';
      g.lineWidth = 1.5;
      g.stroke();

      g.fillStyle = '#4ade80';
      g.font = 'bold 22px sans-serif';
      g.textAlign = 'center';
      g.fillText('所有课程作业已全部完成，无待办事项 ✓', W / 2, curY + 52);
      g.textAlign = 'left';
    } else {
      const renderHw = pendingHomeworkList.slice(0, 4);
      renderHw.forEach(h => {
        const hwH = 80;
        g.fillStyle = '#22242c';
        g.beginPath();
        g.roundRect(50, curY, W - 100, hwH, 14);
        g.fill();
        g.strokeStyle = '#382f32';
        g.lineWidth = 1;
        g.stroke();

        // Left warning dot
        g.fillStyle = '#ff6b57';
        g.beginPath();
        g.arc(78, curY + hwH / 2, 6, 0, Math.PI * 2);
        g.fill();

        // Course tag & Title
        g.fillStyle = accentColor;
        g.font = 'bold 22px sans-serif';
        const courseTag = `[${h.course || '课程'}] `;
        g.fillText(courseTag, 100, curY + 48);

        const tagW = g.measureText(courseTag).width;
        g.fillStyle = '#e9e4d8';
        g.font = 'bold 22px sans-serif';
        const titleMax = h.title.length > 15 ? h.title.slice(0, 14) + '…' : h.title;
        g.fillText(titleMax, 100 + tagW, curY + 48);

        // Deadline
        if (h.due) {
          g.textAlign = 'right';
          g.fillStyle = '#ff8c7a';
          g.font = '18px monospace';
          g.fillText(`截止 @${h.due}`, W - 80, curY + 48);
          g.textAlign = 'left';
        }

        curY += hwH + 12;
      });
    }

    // Bottom watermark footer
    g.fillStyle = '#555866';
    g.font = '15px monospace';
    g.textAlign = 'center';
    g.fillText('SWISS TIMETABLE LOCKSCREEN · 1080×1920 高清竖屏壁纸', W / 2, H - 35);
    g.textAlign = 'left';

    return cv;
  };

  // 6. Save image handler
  const handleSaveImage = () => {
    if (posterFormat === 'card') {
      const cv = drawCardCanvas();
      const a = document.createElement('a');
      a.download = `课程小卡片-${studentName}-${isToday ? '今日' : WEEKDAYS[targetDayIdx]}.png`;
      a.href = cv.toDataURL('image/png');
      a.click();
      toast('已保存 720×340 小卡片高清 PNG 图片！');
    } else {
      const cv = drawWallpaperCanvas();
      const a = document.createElement('a');
      a.download = `课表锁屏壁纸-${studentName}-${isToday ? '今日' : WEEKDAYS[targetDayIdx]}.png`;
      a.href = cv.toDataURL('image/png');
      a.click();
      toast('已保存 1080×1920 锁屏壁纸！设为手机锁屏即可');
    }
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Title & Day switcher */}
      <div className="flex items-end justify-between border-b-[2.5px] border-[#e9e4d8] pb-2">
        <div>
          <div className="font-editorial text-2xl sm:text-3xl font-extrabold tracking-wide text-[#e9e4d8]">
            桌面组件 & 日历
          </div>
          <div className="text-[9.5px] font-mono tracking-[3px] text-[#8f8b80] mt-0.5">
            SWISS EDITORIAL · POSTER & CALENDAR
          </div>
        </div>

        <div className="flex gap-1.5">
          <button
            onClick={() => setDayOffset(d => Math.max(-7, d - 1))}
            className="px-2 py-1 border border-[#e9e4d8] text-xs font-bold hover:bg-[#e9e4d8] hover:text-[#1d1f24] transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5 inline mr-0.5" />
            前一天
          </button>
          <button
            onClick={() => setDayOffset(d => Math.min(7, d + 1))}
            className="px-2 py-1 border border-[#e9e4d8] text-xs font-bold hover:bg-[#e9e4d8] hover:text-[#1d1f24] transition-colors cursor-pointer"
          >
            后一天
            <ChevronRight className="w-3.5 h-3.5 inline ml-0.5" />
          </button>
        </div>
      </div>

      {/* Sunday evening preview indicator */}
      {isSundayEveNow && dayOffset === 1 && (
        <div className="bg-[#1b2234] border border-[#6b7cff] text-[#8ea4ff] text-xs p-2.5 rounded flex items-center justify-between shadow-xs">
          <span>✨ 周日晚间已自动为您提前切换为预览周一早课（明天新一周第 {targetWeek} 周）</span>
          <button
            onClick={() => setDayOffset(0)}
            className="text-[11px] underline hover:text-white cursor-pointer ml-2 shrink-0"
          >
            切回今日周日
          </button>
        </div>
      )}

      {/* 1. Main Two-Column Switcher (Swiss Editorial bottom-border Tab) */}
      <div className="flex border-b-2 border-[#e9e4d8] mb-2">
        <button
          type="button"
          onClick={() => setMainTab('poster')}
          className={`flex-1 pb-2.5 text-sm font-bold tracking-[3px] transition-colors relative cursor-pointer ${
            mainTab === 'poster' ? 'text-[#e9e4d8]' : 'text-[#8f8b80] hover:text-[#c4c0b4]'
          }`}
        >
          课表画报
          {mainTab === 'poster' && (
            <span className="absolute left-[25%] right-[25%] -bottom-0.5 h-1 bg-[#6b7cff]" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setMainTab('calendar')}
          className={`flex-1 pb-2.5 text-sm font-bold tracking-[3px] transition-colors relative cursor-pointer ${
            mainTab === 'calendar' ? 'text-[#e9e4d8]' : 'text-[#8f8b80] hover:text-[#c4c0b4]'
          }`}
        >
          系统日历
          {mainTab === 'calendar' && (
            <span className="absolute left-[25%] right-[25%] -bottom-0.5 h-1 bg-[#6b7cff]" />
          )}
        </button>
      </div>

      {/* ========================================================
          TAB 1: 课表画报 (Poster & Wallpaper)
         ======================================================== */}
      {mainTab === 'poster' && (
        <div className="space-y-4">
          {/* Lightweight Format Switcher: 720x340 vs 1080x1920 */}
          <div className="flex border border-[#e9e4d8] text-xs font-bold divide-x divide-[#e9e4d8]">
            <button
              onClick={() => setPosterFormat('card')}
              className={`flex-1 py-2 text-center transition-colors cursor-pointer ${
                posterFormat === 'card' ? 'bg-[#e9e4d8] text-[#1d1f24]' : 'text-[#e9e4d8] hover:bg-white/10'
              }`}
            >
              小卡片 (720×340)
            </button>
            <button
              onClick={() => setPosterFormat('wallpaper')}
              className={`flex-1 py-2 text-center transition-colors cursor-pointer ${
                posterFormat === 'wallpaper' ? 'bg-[#e9e4d8] text-[#1d1f24]' : 'text-[#e9e4d8] hover:bg-white/10'
              }`}
            >
              锁屏壁纸 (1080×1920)
            </button>
          </div>

          {/* Canvas Preview Area */}
          <div className="p-4 sm:p-5 bg-[#17191e] border-2 border-[#33363d] rounded-xl flex flex-col items-center gap-3">
            <div className="w-full max-w-[380px] flex items-center justify-between pb-1 flex-wrap gap-2">
              <span className="text-xs font-mono text-[#8f8b80] font-bold tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#6b7cff]" />
                <span>{posterFormat === 'card' ? 'PREVIEW · 720×340 小卡片' : 'PREVIEW · 1080×1920 锁屏壁纸'}</span>
              </span>

              {/* Desktop PiP Button */}
              <button
                onClick={toggleFloatingPip}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer border shadow-xs ${
                  pipContainer
                    ? 'bg-[#6b7cff] text-white border-[#6b7cff] animate-pulse'
                    : 'bg-[#232630] text-[#6b7cff] border-[#6b7cff]/40 hover:bg-[#6b7cff]/20 hover:text-white'
                }`}
                title="优先调用 Document Picture-in-Picture 将今日课表置顶悬浮在电脑屏幕最上方"
              >
                <PictureInPicture2 className="w-3.5 h-3.5" />
                <span>{pipContainer ? '悬浮中 (点击关闭)' : '电脑端桌面悬浮窗'}</span>
              </button>
            </div>

            {/* Visual Preview based on posterFormat */}
            {posterFormat === 'card' ? (
              /* Compact Swiss Editorial Card */
              <div className="w-full max-w-[380px] bg-[#202226] rounded-[22px] p-5 shadow-2xl border border-white/5 space-y-3.5 text-[#e9e4d8]">
                <div className="flex items-center justify-between pb-1">
                  <div className="flex items-center gap-2 text-base font-bold font-editorial">
                    <Calendar className="w-4 h-4 text-[#6b7cff]" />
                    <span>
                      {isToday
                        ? `今天 / ${WEEKDAYS[targetDayIdx]}`
                        : `${WEEKDAYS[targetDayIdx]} / ${targetDate.getMonth() + 1}月${targetDate.getDate()}日`}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-[#8f8b80]">第{targetWeek}周</div>
                </div>

                <div className="space-y-2.5">
                  {dayCourses.slice(0, 2).map(c => {
                    const sMin = toMinutes(SLOTS[c.s].s);
                    const isSoon = isToday && sMin - currentMinutes > 0 && sMin - currentMinutes <= leadMinutes;

                    return (
                      <div
                        key={c.id}
                        onClick={() => onOpenCourse(c)}
                        className="flex items-center gap-3 bg-[#2b2d31] rounded-2xl p-3.5 transition-colors hover:bg-[#33353a] cursor-pointer"
                      >
                        <div className="flex flex-col justify-center min-w-[50px] font-mono leading-tight">
                          <span className="text-sm font-bold text-[#f2f1ec]">{SLOTS[c.s].s}</span>
                          <span className="text-xs text-[#8e8d87]">{SLOTS[c.e].e}</span>
                        </div>

                        <div
                          className="w-1.5 h-9 rounded-full shrink-0"
                          style={{ backgroundColor: c.color || accentColor }}
                        />

                        <div className="flex-1 min-w-0">
                          <div className="font-editorial font-bold text-base text-[#f7f6f1] truncate">
                            {c.name}
                          </div>
                          <div
                            className={`text-xs truncate ${
                              isSoon ? 'text-[#ff9a86] font-semibold' : 'text-[#a3a19b]'
                            }`}
                          >
                            第{c.s}-{c.e}节{c.room ? ` ｜ ${c.room}` : ''}{c.teacher ? ` ｜ ${c.teacher}` : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {Array.from({ length: Math.max(0, 2 - Math.min(2, dayCourses.length)) }).map((_, idx) => (
                    <div
                      key={idx}
                      className="bg-[#2b2d31]/50 border border-dashed border-[#3a3d44] rounded-2xl h-[62px] flex items-center justify-center text-xs text-[#63605a]"
                    >
                      {dayCourses.length === 0 && idx === 0 ? '该日无更多课程' : '— 空闲 —'}
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-[#2e313a] flex items-center justify-between text-xs text-[#8f8b80]">
                  <span className="font-mono text-[10px]">SWISS TIMETABLE</span>
                  {pendingHomeworkList.length > 0 ? (
                    <span className="text-[#ff6b57] font-semibold text-[11px]">
                      {pendingHomeworkList.length} 项作业待完成
                    </span>
                  ) : (
                    <span className="text-emerald-400 text-[11px]">作业全部完成 ✓</span>
                  )}
                </div>
              </div>
            ) : (
              /* Phone Lockscreen Wallpaper 9:16 Mockup */
              <div className="w-full max-w-[280px] aspect-[9/16] bg-[#1d1f24] rounded-[34px] border-[5px] border-[#383b48] p-3 shadow-2xl relative flex flex-col justify-between text-[#e9e4d8] overflow-hidden select-none">
                {/* Top 32% Reserved Clock Area Mockup */}
                <div className="h-[32%] flex flex-col items-center justify-center border-b border-dashed border-[#3e4252] bg-white/2 rounded-2xl p-2 relative">
                  <div className="w-14 h-3 bg-black/80 rounded-full mb-1 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#444]" />
                  </div>
                  <div className="text-2xl font-extrabold tracking-tight font-sans text-white">
                    09:41
                  </div>
                  <div className="text-[9.5px] text-[#a39f93] font-medium">
                    {targetDate.getMonth() + 1}月{targetDate.getDate()}日 {WEEKDAYS[targetDayIdx]}
                  </div>
                  <div className="text-[8px] font-mono text-[#8f8b80] mt-1 bg-black/40 px-1.5 py-0.2 rounded-full border border-white/10">
                    👆 手机锁屏时钟保留区 (32% 留白)
                  </div>
                </div>

                {/* Bottom 68% Today Courses & Homework Preview */}
                <div className="h-[67%] flex flex-col justify-between pt-2 text-[10px]">
                  <div>
                    <div className="font-editorial font-bold text-xs text-white">
                      {isToday ? '今天' : WEEKDAYS[targetDayIdx]} · 第{targetWeek}周
                    </div>
                    <div className="text-[8px] font-mono text-[#8f8b80]">
                      今日课程 ({dayCourses.length}) ｜ 待交作业 ({pendingHomeworkList.length})
                    </div>
                  </div>

                  {/* Courses */}
                  <div className="space-y-1.5 my-auto">
                    {dayCourses.slice(0, 3).map(c => (
                      <div key={c.id} className="bg-[#242730] p-1.5 rounded border border-[#33363f] flex items-center gap-2">
                        <div className="w-1 h-5 rounded-full shrink-0" style={{ backgroundColor: c.color || accentColor }} />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-[10px] text-white truncate">{c.name}</div>
                          <div className="text-[8px] text-[#8f8b80] truncate">{SLOTS[c.s].s} @{c.room || '待定'}</div>
                        </div>
                      </div>
                    ))}
                    {dayCourses.length === 0 && (
                      <div className="text-center py-2 text-[10px] italic text-[#8f8b80]">
                        今天没有课，好好休息 ☕
                      </div>
                    )}
                  </div>

                  {/* Homework */}
                  <div className="pt-1 border-t border-[#2d3039] flex items-center justify-between text-[8.5px]">
                    <span className="text-[#8f8b80] font-mono">待办作业</span>
                    {pendingHomeworkList.length > 0 ? (
                      <span className="text-[#ff6b57] font-bold">{pendingHomeworkList.length} 项待交</span>
                    ) : (
                      <span className="text-emerald-400">全部完成 ✓</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Accent Colors Picker */}
          <div>
            <div className="text-[10px] font-bold tracking-[3px] text-[#8f8b80] mb-2 font-mono">
              ACCENT · 强调色
            </div>
            <div className="flex gap-2.5 bg-[#202228] p-3 border border-[#33363d] rounded">
              {ACCENTS.map(col => (
                <button
                  key={col}
                  onClick={() => setAccentColor(col)}
                  style={{ backgroundColor: col }}
                  className={`w-7 h-7 rounded-full cursor-pointer transition-transform ${
                    accentColor === col ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Single Primary Action Button */}
          <div>
            <button
              onClick={handleSaveImage}
              className="w-full py-3.5 bg-[#e9e4d8] hover:bg-white text-[#1d1f24] font-bold text-sm tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md active:scale-98"
            >
              <Download className="w-4 h-4" />
              <span>保存高清图片 (PNG)</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: 系统日历 (Calendar Sync)
         ======================================================== */}
      {mainTab === 'calendar' && (
        <div className="space-y-4">
          <div className="bg-[#202226] border-2 border-[#33363d] rounded-xl p-5 text-[#e9e4d8] space-y-4 shadow-xl">
            {/* Sync Status Badge */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-[#2e313b]">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#6b7cff]" />
                <h4 className="font-editorial font-bold text-base text-[#e9e4d8]">
                  手机系统日历服务
                </h4>
              </div>

              {calendarSyncInfo.synced ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 text-[11px] font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>已导入 {calendarSyncInfo.lastSyncTime ? `(${calendarSyncInfo.lastSyncTime})` : ''}</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#2a2c36] text-[#a8a399] border border-[#3e4252] text-[11px] font-semibold">
                  <span className="w-2 h-2 rounded-full bg-[#8f8b80]" />
                  <span>未同步</span>
                </div>
              )}
            </div>

            {/* Core Description */}
            <p className="text-sm text-[#e9e4d8] leading-relaxed font-editorial">
              可将整学期课程与未交作业导入手机自带日历，并通过手机桌面自带的【日历服务卡片/小组件】实时看课。
            </p>

            <div className="text-xs text-[#a8a399] space-y-1.5 bg-[#17191e] p-3 rounded border border-[#2b2e38] leading-relaxed">
              <div>• 包含全学期周次日程、教室与任课教师信息</div>
              <div>• 包含未完成作业截止日程与提前通知提醒（课前 10 分钟提醒 / 作业截止前 2 小时提醒）</div>
              <div>• 支持苹果 iPhone、华为、鸿蒙、小米、OPPO、vivo 及电脑日历</div>
            </div>

            {/* Single Primary Action Button */}
            <div className="pt-1">
              <button
                onClick={handleExportCalendar}
                className="w-full py-3 bg-[#6b7cff] hover:bg-[#5868e6] text-white font-bold text-sm tracking-wider rounded flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-98"
              >
                <Calendar className="w-4 h-4" />
                <span>导出并同步日历 (.ics)</span>
              </button>
            </div>

            {/* Low-profile Reset Link below card */}
            <div className="pt-2 text-center border-t border-[#2a2c36]/60">
              <button
                onClick={handleResetCalendar}
                className="text-xs text-[#8f8b80] hover:text-[#e9e4d8] underline cursor-pointer transition-colors"
              >
                撤销并清除已导入的日历日程 (.ics)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Portal into PiP Floating Window */}
      {pipContainer && createPortal(
        <FloatingPipContent
          courses={courses}
          homework={homework}
          studentName={studentName}
          accentColor={accentColor}
        />,
        pipContainer
      )}

      {/* Android / Huawei Calendar Guide Bottom Sheet Drawer */}
      {showAndroidGuideSheet && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex flex-col justify-end animate-fade-in">
          <div className="bg-[#1d1f24] border-t-2 border-[#6b7cff] rounded-t-2xl p-5 text-[#e9e4d8] space-y-4 max-w-lg mx-auto w-full shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#33363f] pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#6b7cff]" />
                <h3 className="font-editorial font-bold text-base">日历导入提示</h3>
              </div>
              <button
                onClick={() => setShowAndroidGuideSheet(false)}
                className="text-[#8f8b80] hover:text-[#e9e4d8] cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-[#dcd8cb] leading-relaxed py-1">
              <div className="flex items-start gap-2">
                <span className="font-bold text-[#6b7cff]">1.</span>
                <span>已为您生成并下载 <strong>课表.ics</strong> 文件</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-[#6b7cff]">2.</span>
                <span>请打开浏览器菜单【下载管理】（或系统【文件管理 ➡️ 下载】）点击该文件</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-[#6b7cff]">3.</span>
                <span>选择用【日历】打开即可导入，随后可在手机桌面添加系统日历卡片</span>
              </div>
            </div>

            <button
              onClick={() => setShowAndroidGuideSheet(false)}
              className="w-full py-2.5 bg-[#6b7cff] hover:bg-[#5868e6] text-white font-bold text-xs tracking-wider rounded cursor-pointer transition-colors"
            >
              我知道了
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// PiP floating widget live component
function FloatingPipContent({
  courses,
  homework = [],
  studentName,
  accentColor,
}: {
  courses: Course[];
  homework: Homework[];
  studentName: string;
  accentColor: string;
}) {
  const now = new Date();
  const targetWeek = Math.max(1, Math.min(25, getWeekNo(now)));
  const todayDayIdx = (now.getDay() + 6) % 7;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const dayCourses = courses
    .filter(c => c.day === todayDayIdx && isCourseInWeek(targetWeek, c.weeks))
    .sort((a, b) => a.s - b.s);

  const pendingHw = homework.filter(h => !h.done);

  return (
    <div className="h-full flex flex-col justify-between font-sans select-none text-[#e9e4d8]">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#33363f]">
        <div>
          <div className="font-editorial text-sm font-extrabold tracking-wide text-[#e9e4d8] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>今日课程 · {WEEKDAYS[todayDayIdx]}</span>
          </div>
          <div className="text-[9px] font-mono text-[#8f8b80]">
            第{targetWeek}周 · {studentName}
          </div>
        </div>

        {pendingHw.length > 0 ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#ff6b57]/20 text-[#ff6b57] border border-[#ff6b57]/40 font-bold">
            {pendingHw.length} 项作业待做
          </span>
        ) : (
          <span className="text-[10px] text-emerald-400 font-mono">作业已清空 ✓</span>
        )}
      </div>

      {/* Courses List */}
      <div className="flex-1 overflow-y-auto py-2 space-y-2">
        {dayCourses.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-6 text-[#8f8b80]">
            <span className="text-xs font-editorial italic">— 今天没有课，好好休息 —</span>
          </div>
        ) : (
          dayCourses.map(c => {
            const sMin = toMinutes(SLOTS[c.s].s);
            const eMin = toMinutes(SLOTS[c.e].e);
            const isFinished = currentMinutes > eMin;
            const isOngoing = currentMinutes >= sMin && currentMinutes <= eMin;
            const isUpcomingSoon = !isFinished && !isOngoing && sMin - currentMinutes <= 30 && sMin - currentMinutes > 0;

            return (
              <div
                key={c.id}
                className={`flex items-center gap-2.5 p-2 rounded-lg transition-colors border ${
                  isOngoing
                    ? 'bg-[#292c36] border-[#6b7cff]'
                    : isFinished
                    ? 'bg-[#1e2026] border-[#292b33] opacity-50'
                    : 'bg-[#22252c] border-[#2f323a]'
                }`}
              >
                <div className="flex flex-col items-center min-w-[42px] font-mono text-[10.5px] leading-tight">
                  <span className={`font-bold ${isOngoing ? 'text-[#6b7cff]' : 'text-[#f2f1ec]'}`}>
                    {SLOTS[c.s].s}
                  </span>
                  <span className="text-[9px] text-[#8e8d87]">{SLOTS[c.e].e}</span>
                </div>

                <div
                  className="w-1 h-6 rounded-full shrink-0"
                  style={{ backgroundColor: c.color || accentColor }}
                />

                <div className="flex-1 min-w-0">
                  <div className="font-bold text-xs truncate flex items-center gap-1.5">
                    <span className="truncate">{c.name}</span>
                    {isOngoing && (
                      <span className="text-[8.5px] px-1 py-0.2 bg-[#6b7cff] text-white font-bold rounded">
                        上课中
                      </span>
                    )}
                    {isUpcomingSoon && (
                      <span className="text-[8.5px] px-1 py-0.2 bg-[#ff6b57] text-white font-bold rounded animate-pulse">
                        即将上课
                      </span>
                    )}
                  </div>
                  <div className="text-[9.5px] text-[#9c9990] truncate mt-0.5">
                    第{c.s}-{c.e}节 {c.room ? `· ${c.room}` : ''} {c.teacher ? `· ${c.teacher}` : ''}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="pt-1.5 border-t border-[#292b33] flex items-center justify-between text-[9px] text-[#63605a] font-mono">
        <span>SWISS TIMETABLE · PIP WIDGET</span>
        <span>实时保持置顶</span>
      </div>
    </div>
  );
}
