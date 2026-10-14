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
import { getStoredToken } from '../services/api';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Check,
  Sparkles,
  Info,
  RotateCcw,
  CheckCircle2,
  Trash2,
  RefreshCw,
  PictureInPicture2,
  FileCode,
  Code2,
  Clock,
  Radio,
  X,
  Smartphone,
  LayoutGrid,
  Image as ImageIcon,
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
  const [renderMode, setRenderMode] = useState<'widget' | 'wallpaper'>('widget');
  const [wallpaperType, setWallpaperType] = useState<'week' | 'today'>('week');
  const [rowCount, setRowCount] = useState<2 | 3 | 5>(2);
  const [accentColor, setAccentColor] = useState('#8b5cf6');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedWebcal, setCopiedWebcal] = useState(false);
  const [showAutoTutorial, setShowAutoTutorial] = useState(false);
  const [showCleanupGuide, setShowCleanupGuide] = useState(false);
  const [showScriptableModal, setShowScriptableModal] = useState(false);
  const [copiedScriptable, setCopiedScriptable] = useState(false);

  // Document Picture-in-Picture State
  const [pipContainer, setPipContainer] = useState<HTMLElement | null>(null);
  const pipWindowRef = useRef<Window | null>(null);

  const username = user?.username || '2612114501';
  const studentName = user?.name || username;
  const syncStorageKey = `cs_cal_sync_${username}`;

  const [calendarSyncInfo, setCalendarSyncInfo] = useState<{
    synced: boolean;
    lastSyncTime?: string;
    mode?: string;
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

  const sortedCourses = useMemo(() => {
    if (!isToday) return dayCourses;
    return dayCourses.slice().sort((a, b) => {
      const isPastA = toMinutes(SLOTS[a.e].e) < currentMinutes ? 1 : 0;
      const isPastB = toMinutes(SLOTS[b.e].e) < currentMinutes ? 1 : 0;
      return isPastA - isPastB || a.s - b.s;
    });
  }, [dayCourses, isToday, currentMinutes]);

  const displayList = sortedCourses.slice(0, rowCount);

  const pendingHomeworkList = useMemo(() => {
    return homework.filter(h => !h.done);
  }, [homework]);

  const webcalUrl = typeof window !== 'undefined'
    ? `webcal://${window.location.host}/api/calendar/${username}/schedule.ics`
    : `webcal://localhost:3000/api/calendar/${username}/schedule.ics`;

  // Close PiP window when component unmounts
  useEffect(() => {
    return () => {
      if (pipWindowRef.current) {
        pipWindowRef.current.close();
      }
    };
  }, []);

  // 1. Webcal dynamic subscription
  const handleWebcalSubscribe = () => {
    try {
      window.location.href = webcalUrl;

      const n = new Date();
      const timeStr = `${n.getMonth() + 1}月${n.getDate()}日 ${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
      const newInfo = { synced: true, lastSyncTime: timeStr, mode: 'webcal' };
      setCalendarSyncInfo(newInfo);
      try {
        localStorage.setItem(syncStorageKey, JSON.stringify(newInfo));
      } catch (e) {}

      toast('已请求系统打开日历订阅！若未自动弹出可复制订阅链接');
    } catch (e: any) {
      toast('唤醒日历失败，请尝试复制订阅链接');
    }
  };

  const handleCopyWebcalUrl = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(webcalUrl);
      setCopiedWebcal(true);
      toast('已复制 webcal:// 订阅链接！可直接粘贴至任何日历客户端');
      setTimeout(() => setCopiedWebcal(false), 2200);
    }
  };

  // 2. Offline .ics fallback download
  const handleDownloadStaticIcs = () => {
    downloadCalendarFile(studentName, courses, homework);
    const n = new Date();
    const timeStr = `${n.getMonth() + 1}月${n.getDate()}日 ${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
    const newInfo = { synced: true, lastSyncTime: timeStr, mode: 'static' };
    setCalendarSyncInfo(newInfo);
    try {
      localStorage.setItem(syncStorageKey, JSON.stringify(newInfo));
    } catch (e) {}
    toast('已生成离线静态日历文件 (.ics)，包含全学期课程及待办作业！');
    setShowAutoTutorial(true);
  };

  // 3. Reset calendar sync
  const handleResetCalendarSync = (downloadCancel: boolean = true) => {
    if (downloadCancel) {
      downloadCancelCalendarFile(studentName, courses);
    }
    const newInfo = { synced: false, lastSyncTime: undefined };
    setCalendarSyncInfo(newInfo);
    try {
      localStorage.setItem(syncStorageKey, JSON.stringify(newInfo));
    } catch (e) {}
    if (downloadCancel) {
      toast('已下载日历还原文件并重置！');
      setShowCleanupGuide(true);
    } else {
      toast('已重置为未订阅状态');
    }
  };

  // 4. Document Picture-in-Picture
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

  // 5. Scriptable script generator
  const getScriptableScript = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://example.com';
    const token = getStoredToken() || username;

    return `// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-blue; icon-glyph: calendar-alt;

/**
 * 掌上课表 · Swiss Editorial iOS 原生小组件
 * 自动拉取云端课程表与作业，原生渲染今日课程与待办提醒
 */
const BASE_URL = "${origin}";
const USERNAME = "${username}";
const TOKEN = "${token}";

const THEME = {
  bg: new Color("#1d1f24"),
  cardBg: new Color("#252830"),
  cardBorder: new Color("#333642"),
  textMain: new Color("#e9e4d8"),
  textSub: new Color("#8f8b80"),
  accent: new Color("#6b7cff"),
  danger: new Color("#ff6b57"),
  success: new Color("#4ade80")
};

async function fetchData(endpoint) {
  const req = new Request(\`\${BASE_URL}/api\${endpoint}\`);
  req.headers = {
    "Accept": "application/json",
    "Authorization": \`Bearer \${TOKEN}\`,
    "X-User": USERNAME
  };
  req.timeoutInterval = 10;
  try {
    return await req.loadJSON();
  } catch (e) {
    return null;
  }
}

async function createWidget() {
  const widget = new ListWidget();
  widget.backgroundColor = THEME.bg;
  widget.setPadding(14, 14, 14, 14);

  // 1. Header (Swiss Editorial)
  const header = widget.addStack();
  header.layoutHorizontally();
  header.centerAlignContent();

  const title = header.addText("今日课程");
  title.font = Font.boldSystemFont(15);
  title.textColor = THEME.textMain;

  header.addSpacer();

  const now = new Date();
  const weekDays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const dateStr = \`\${weekDays[now.getDay()]} \${now.getMonth() + 1}月\${now.getDate()}日\`;
  const dateText = header.addText(dateStr);
  dateText.font = Font.systemFont(11);
  dateText.textColor = THEME.textSub;

  widget.addSpacer(8);

  // 2. Data Fetch
  const [coursesData, hwData] = await Promise.all([
    fetchData("/courses"),
    fetchData("/assignments")
  ]);

  const rawCourses = coursesData?.courses || coursesData || [];
  const rawHw = hwData?.assignments || hwData?.homework || [];
  const pendingHw = rawHw.filter(h => !h.done && !h.completed);

  // Day index: 0=Mon ... 6=Sun
  const todayDayIdx = (now.getDay() + 6) % 7;
  const todayCourses = rawCourses
    .filter(c => Number(c.day !== undefined ? c.day : (c.weekday || 0)) === todayDayIdx)
    .sort((a, b) => Number(a.s || a.start_slot || 1) - Number(b.s || b.start_slot || 1));

  if (todayCourses.length === 0) {
    widget.addSpacer();
    const emptyStack = widget.addStack();
    emptyStack.layoutVertically();
    const emptyText = emptyStack.addText("今天没有课，好好休息");
    emptyText.font = Font.italicSystemFont(13);
    emptyText.textColor = THEME.textSub;
    emptyText.centerAlignText();
    widget.addSpacer();
  } else {
    const displayList = todayCourses.slice(0, 3);
    for (let i = 0; i < displayList.length; i++) {
      const c = displayList[i];
      const row = widget.addStack();
      row.layoutHorizontally();
      row.centerAlignContent();
      row.backgroundColor = THEME.cardBg;
      row.cornerRadius = 8;
      row.setPadding(8, 8, 8, 8);

      // Color accent bar
      const bar = row.addStack();
      bar.size = new Size(3.5, 26);
      bar.backgroundColor = new Color(c.color || "#6b7cff");
      bar.cornerRadius = 1.5;

      row.addSpacer(8);

      const info = row.addStack();
      info.layoutVertically();

      const name = info.addText(c.name || "课程");
      name.font = Font.boldSystemFont(12);
      name.textColor = THEME.textMain;
      name.lineLimit = 1;

      const meta = info.addText(\`第\${c.s || c.start_slot || 1}-\${c.e || c.end_slot || 2}节 ｜ \${c.room || c.classroom || '待定'}\`);
      meta.font = Font.systemFont(10);
      meta.textColor = THEME.textSub;
      meta.lineLimit = 1;

      widget.addSpacer(5);
    }
  }

  // 3. Footer
  widget.addSpacer();
  const footer = widget.addStack();
  footer.layoutHorizontally();
  footer.centerAlignContent();

  const brand = footer.addText("SWISS TIMETABLE");
  brand.font = Font.boldSystemFont(9);
  brand.textColor = new Color("#555966");

  footer.addSpacer();

  if (pendingHw.length > 0) {
    const hwBadge = footer.addText(\`\${pendingHw.length} 项作业待交\`);
    hwBadge.font = Font.boldSystemFont(10);
    hwBadge.textColor = THEME.danger;
  } else {
    const allDone = footer.addText("作业全完成 ✓");
    allDone.font = Font.systemFont(10);
    allDone.textColor = THEME.success;
  }

  widget.url = BASE_URL;
  return widget;
}

const widget = await createWidget();
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  widget.presentMedium();
}
Script.complete();
`;
  };

  const handleCopyScriptable = () => {
    const script = getScriptableScript();
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(script);
      setCopiedScriptable(true);
      toast('已复制 iOS Scriptable 原生小组件脚本！');
      setTimeout(() => setCopiedScriptable(false), 2200);
    }
  };

  const handleDownloadScriptable = () => {
    const script = getScriptableScript();
    const blob = new Blob([script], { type: 'application/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `掌上课表-Scriptable小组件.js`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast('已下载 Scriptable 小组件脚本！');
  };

  // Canvas drawing for PNG export
  const drawWidgetCanvas = (): HTMLCanvasElement => {
    const W = 720;
    const rowH = 100;
    const padding = 24;
    const H = 80 + rowCount * rowH + (rowCount - 1) * 12 + padding * 2;
    const scale = 2;

    const cv = document.createElement('canvas');
    cv.width = W * scale;
    cv.height = H * scale;
    const g = cv.getContext('2d');
    if (!g) return cv;

    g.scale(scale, scale);

    g.fillStyle = '#15171c';
    g.fillRect(0, 0, W, H);

    const cardX = 20;
    const cardY = 20;
    const cardW = W - 40;
    const cardH = H - 40;
    g.fillStyle = '#202226';
    g.beginPath();
    g.roundRect(cardX, cardY, cardW, cardH, 24);
    g.fill();

    const titleText = isToday
      ? `今天 / ${WEEKDAYS[targetDayIdx]}`
      : `${WEEKDAYS[targetDayIdx]} / ${targetDate.getMonth() + 1}月${targetDate.getDate()}日`;
    const weekText = `第${targetWeek}周 · ${studentName}`;

    g.fillStyle = '#f0efe9';
    g.font = 'bold 20px "Songti SC", Georgia, serif';
    g.fillText(titleText, cardX + 24, cardY + 38);

    g.textAlign = 'right';
    g.fillStyle = '#e6e4dd';
    g.font = '16px sans-serif';
    g.fillText(weekText, cardX + cardW - 24, cardY + 38);
    g.textAlign = 'left';

    let curY = cardY + 64;
    for (let i = 0; i < rowCount; i++) {
      const c = displayList[i];
      g.fillStyle = '#2b2d31';
      g.beginPath();
      g.roundRect(cardX + 16, curY, cardW - 32, rowH, 16);
      g.fill();

      if (c) {
        g.fillStyle = accentColor;
        g.beginPath();
        g.roundRect(cardX + 16 + 74, curY + 20, 5, rowH - 40, 3);
        g.fill();

        g.fillStyle = '#f2f1ec';
        g.font = 'bold 16px sans-serif';
        g.fillText(SLOTS[c.s].s, cardX + 32, curY + 42);

        g.fillStyle = '#9b9a94';
        g.font = '13px sans-serif';
        g.fillText(SLOTS[c.e].e, cardX + 32, curY + 68);

        g.fillStyle = '#ffffff';
        g.font = 'bold 17px "Songti SC", Georgia, serif';
        g.fillText(c.name, cardX + 104, curY + 42);

        g.fillStyle = '#a8a69e';
        g.font = '13px sans-serif';
        const meta = `第${c.s}-${c.e}节` + (c.room ? ` ｜ ${c.room}` : '') + (c.teacher ? ` ｜ ${c.teacher}` : '');
        g.fillText(meta, cardX + 104, curY + 68);
      } else {
        g.fillStyle = '#63605a';
        g.font = 'italic 15px sans-serif';
        g.textAlign = 'center';
        g.fillText(displayList.length === 0 && i === 0 ? '该日无更多课程' : '— 空闲 —', cardX + cardW / 2, curY + 54);
        g.textAlign = 'left';
      }

      curY += rowH + 12;
    }

    return cv;
  };

  const handleDownload = () => {
    const cv = drawWidgetCanvas();
    const a = document.createElement('a');
    a.download = `课程小组件-${studentName}-${isToday ? '今日' : WEEKDAYS[targetDayIdx]}.png`;
    a.href = cv.toDataURL('image/png');
    a.click();
    toast('已导出小组件高清 PNG 图片');
  };

  const handleCopy = () => {
    const cv = drawWidgetCanvas();
    try {
      cv.toBlob(blob => {
        if (blob && navigator?.clipboard?.write) {
          navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
            .then(() => toast('小组件图片已复制到剪贴板！'))
            .catch(() => handleDownload());
        } else {
          handleDownload();
        }
      });
    } catch (e) {
      handleDownload();
    }
  };

  // Canvas drawing for Phone Lockscreen Wallpaper (1080x1920, 9:16)
  const drawWallpaperCanvas = (): HTMLCanvasElement => {
    const W = 1080;
    const H = 1920;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d');
    if (!g) return cv;

    // 1. Wallpaper Background (Deep charcoal / Swiss dark `#1d1f24`)
    g.fillStyle = '#1d1f24';
    g.fillRect(0, 0, W, H);

    // Subtle dark gradient for refined editorial depth
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1d1f24');
    grad.addColorStop(0.32, '#181a1f');
    grad.addColorStop(1, '#121317');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    // 2. Top 32% (y = 0 to 614px) is deliberately reserved blank for iOS / Android Lockscreen clock & widgets
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

    if (wallpaperType === 'week') {
      // MODE A: 本周 7 天紧凑课表网格
      // Header
      g.fillStyle = '#f0efe9';
      g.font = 'bold 36px "Songti SC", Georgia, serif';
      g.fillText(`第 ${targetWeek} 周 · 全周课表`, 50, topReservedH + 48);

      g.fillStyle = '#8f8b80';
      g.font = '18px monospace';
      g.fillText(`SEMESTER SCHEDULE ｜ ${studentName} ｜ 08:20 - 20:05`, 50, topReservedH + 78);

      // Accent color pill tag on right
      g.fillStyle = accentColor;
      g.beginPath();
      g.roundRect(W - 190, topReservedH + 28, 140, 36, 18);
      g.fill();
      g.fillStyle = '#ffffff';
      g.font = 'bold 15px sans-serif';
      g.textAlign = 'center';
      g.fillText('7 DAYS GRID', W - 120, topReservedH + 51);
      g.textAlign = 'left';

      // Grid Coordinates
      const gridX = 50;
      const gridY = topReservedH + 100;
      const gridW = W - 100; // 980px
      const gridH = H - gridY - 80; // ~1125px

      const timeColW = 84;
      const daysCount = 7;
      const dayColGap = 6;
      const dayColW = (gridW - timeColW - dayColGap * (daysCount - 1)) / daysCount;

      // 5 Course Slots
      const slotBlocks = [
        { label: '01-02', time: '08:20', s: 1, e: 2 },
        { label: '03-04', time: '10:15', s: 3, e: 4 },
        { label: '05-06', time: '14:00', s: 5, e: 6 },
        { label: '07-08', time: '15:55', s: 7, e: 8 },
        { label: '09-10', time: '18:30', s: 9, e: 10 },
      ];

      const headerH = 46;
      const slotGap = 8;
      const slotH = (gridH - headerH - slotGap * (slotBlocks.length - 1)) / slotBlocks.length;

      // Day Headers
      WEEKDAYS.forEach((wName, dIdx) => {
        const dx = gridX + timeColW + dIdx * (dayColW + dayColGap);
        const isCurrentDay = dIdx === targetDayIdx;

        if (isCurrentDay) {
          g.fillStyle = accentColor;
          g.beginPath();
          g.roundRect(dx, gridY, dayColW, headerH - 8, 8);
          g.fill();
          g.fillStyle = '#ffffff';
          g.font = 'bold 18px sans-serif';
        } else {
          g.fillStyle = '#262933';
          g.beginPath();
          g.roundRect(dx, gridY, dayColW, headerH - 8, 8);
          g.fill();
          g.fillStyle = '#a3a096';
          g.font = '16px sans-serif';
        }
        g.textAlign = 'center';
        g.fillText(wName, dx + dayColW / 2, gridY + 25);
        g.textAlign = 'left';
      });

      // Slot Rows & Cells
      slotBlocks.forEach((slot, sIdx) => {
        const sy = gridY + headerH + sIdx * (slotH + slotGap);

        // Time Label
        g.fillStyle = '#8f8b80';
        g.font = 'bold 15px monospace';
        g.fillText(slot.label, gridX + 8, sy + slotH / 2 - 4);
        g.font = '12px monospace';
        g.fillStyle = '#5c5a52';
        g.fillText(slot.time, gridX + 10, sy + slotH / 2 + 15);

        // 7 Day Cells
        for (let d = 0; d < 7; d++) {
          const cx = gridX + timeColW + d * (dayColW + dayColGap);

          // Find course matching day and slot
          const c = courses.find(item =>
            item.day === d &&
            isCourseInWeek(targetWeek, item.weeks) &&
            ((item.s <= slot.e && item.e >= slot.s) || item.s === slot.s)
          );

          if (c) {
            g.fillStyle = '#232630';
            g.beginPath();
            g.roundRect(cx, sy, dayColW, slotH, 8);
            g.fill();

            // Accent bar on left of cell
            g.fillStyle = c.color || accentColor;
            g.beginPath();
            g.roundRect(cx, sy, 4, slotH, 2);
            g.fill();

            // Course Name
            g.fillStyle = '#f5f4ef';
            g.font = 'bold 15px "Songti SC", Georgia, serif';
            const nameChars = Array.from(c.name || '课程');
            let l1 = '';
            let l2 = '';
            for (const ch of nameChars) {
              if (g.measureText(l1 + ch).width < dayColW - 14) {
                l1 += ch;
              } else if (l2.length < 8) {
                l2 += ch;
              }
            }
            g.fillText(l1, cx + 8, sy + 22);
            if (l2) g.fillText(l2, cx + 8, sy + 40);

            // Classroom
            if (c.room) {
              g.fillStyle = '#a6a398';
              g.font = '12px sans-serif';
              const rText = c.room.length > 7 ? c.room.slice(0, 6) + '…' : c.room;
              g.fillText(rText, cx + 8, sy + slotH - 12);
            }
          } else {
            // Empty Cell
            g.fillStyle = '#1b1d24';
            g.beginPath();
            g.roundRect(cx, sy, dayColW, slotH, 8);
            g.fill();
            g.strokeStyle = '#272933';
            g.lineWidth = 1;
            g.stroke();
          }
        }
      });

      // Bottom watermark footer
      g.fillStyle = '#555866';
      g.font = '15px monospace';
      g.textAlign = 'center';
      g.fillText('SWISS EDITORIAL · 抬手亮屏即览全周日程', W / 2, H - 35);
      g.textAlign = 'left';

    } else {
      // MODE B: 今日课程 + 待交作业清单
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
        renderCourses.forEach((c) => {
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

      // Section 2: 待交作业与任务清单
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
        renderHw.forEach((h) => {
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
    }

    return cv;
  };

  const handleDownloadWallpaper = () => {
    const cv = drawWallpaperCanvas();
    const a = document.createElement('a');
    a.download = `课表锁屏壁纸-${studentName}-${wallpaperType === 'week' ? `第${targetWeek}周` : `今日安排-${WEEKDAYS[targetDayIdx]}`}.png`;
    a.href = cv.toDataURL('image/png');
    a.click();
    toast('已保存 1080×1920 高清锁屏壁纸！到相册设为壁纸即可');
  };

  const handleCopyWallpaper = () => {
    const cv = drawWallpaperCanvas();
    try {
      cv.toBlob(blob => {
        if (blob && navigator?.clipboard?.write) {
          navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
            .then(() => toast('锁屏壁纸已复制到剪贴板！'))
            .catch(() => handleDownloadWallpaper());
        } else {
          handleDownloadWallpaper();
        }
      });
    } catch (e) {
      handleDownloadWallpaper();
    }
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Title & Day switcher */}
      <div className="flex items-end justify-between border-b-[2.5px] border-[#e9e4d8] pb-2">
        <div>
          <div className="font-editorial text-2xl sm:text-3xl font-extrabold tracking-wide text-[#e9e4d8]">
            桌面小组件 & 挂件
          </div>
          <div className="text-[9.5px] font-mono tracking-[3px] text-[#8f8b80] mt-0.5">
            DESKTOP WIDGET, WEBCAL & PIP FLOATING
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

      {/* 1. Featured Section: webcal:// 云端动态日历订阅 */}
      <div className="bg-gradient-to-r from-[#1c223a] to-[#1a1c22] border-2 border-[#6b7cff] p-4 rounded-lg shadow-xl text-[#e9e4d8] space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#6b7cff] animate-pulse" />
            <h4 className="font-editorial font-bold text-base text-[#e9e4d8]">
              webcal:// 云端动态日历订阅（免打开·桌面自动更新）
            </h4>
          </div>

          {calendarSyncInfo.synced ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 text-[11px] font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                已订阅云端日历 {calendarSyncInfo.lastSyncTime ? `(${calendarSyncInfo.lastSyncTime})` : ''}
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#2a2c36] text-[#a8a399] border border-[#3e4252] text-[11px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#8f8b80]" />
              <span>未订阅</span>
            </div>
          )}
        </div>

        <p className="text-xs text-[#a8a399] leading-relaxed">
          采用苹果 iOS / 安卓 / macOS 系统原生支持的 <strong>webcal:// 动态订阅协议</strong>。一次订阅后，无论后台增改课程还是布置新作业，手机日历与锁屏小组件都会<strong>自动同步更新</strong>，课前与作业截止前自动闹铃提醒！
        </p>

        {/* Primary Action Buttons */}
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={handleWebcalSubscribe}
              className="w-full py-2.5 px-3 bg-[#6b7cff] hover:bg-[#5868e6] text-white font-bold text-xs tracking-wider rounded flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-98"
            >
              <Calendar className="w-4 h-4" />
              <span>一键唤醒系统日历动态订阅 (webcal://)</span>
            </button>

            <button
              onClick={handleCopyWebcalUrl}
              className="w-full py-2.5 px-3 bg-[#242630] hover:bg-[#2e313e] text-[#e9e4d8] border border-[#3e4252] font-semibold text-xs tracking-wider rounded flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {copiedWebcal ? <Check className="w-3.5 h-3.5 text-[#4ade80]" /> : <Copy className="w-3.5 h-3.5 text-[#6b7cff]" />}
              <span>{copiedWebcal ? '订阅链接已复制！' : '复制 webcal:// 订阅链接'}</span>
            </button>
          </div>

          {/* Secondary Actions: Static .ics Download & Reset */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-[#292c38]">
            <button
              onClick={handleDownloadStaticIcs}
              className="text-[11px] text-[#8f8b80] hover:text-[#e9e4d8] flex items-center gap-1 cursor-pointer transition-colors"
              title="降级方案：下载离线静态 .ics 文件手动导入"
            >
              <Download className="w-3 h-3" />
              <span>备用：下载离线静态 .ics 文件（含课程+作业）</span>
            </button>

            <button
              onClick={() => handleResetCalendarSync(true)}
              className="text-[11px] text-[#f87171]/80 hover:text-[#f87171] flex items-center gap-1 cursor-pointer transition-colors"
              title="下载日历还原文件并重置状态"
            >
              <RotateCcw className="w-3 h-3" />
              <span>一键还原/清空日历日程</span>
            </button>
          </div>
        </div>

        {/* Guides accordion */}
        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#2a2c36]/60">
          <button
            onClick={() => setShowAutoTutorial(!showAutoTutorial)}
            className="text-[#6b7cff] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Info className="w-3 h-3" />
            <span>{showAutoTutorial ? '收起订阅教学' : '苹果/安卓手机如何一键订阅日历？'}</span>
          </button>

          <button
            onClick={() => setShowCleanupGuide(!showCleanupGuide)}
            className="text-[#8f8b80] hover:text-[#e9e4d8] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3 h-3 text-[#f87171]/70" />
            <span>{showCleanupGuide ? '收起移除说明' : '如何从手机中取消订阅？'}</span>
          </button>
        </div>

        {showAutoTutorial && (
          <div className="bg-[#12141a] p-3 rounded border border-[#2e323e] text-xs space-y-2 text-[#c8c4b8] leading-relaxed">
            <div className="font-bold text-[#e9e4d8] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#6b7cff]" />
              <span>手机系统日历订阅与桌面小组件添加步骤：</span>
            </div>
            <div className="pl-2 space-y-1 text-[11.5px]">
              <div>1. 点击上方 <strong>「一键唤醒系统日历动态订阅」</strong>，浏览器会自动唤起系统日历添加弹窗。</div>
              <div>2. 手机弹窗询问「是否订阅掌上课表」时，确认点击 <strong>「订阅」</strong>，自动刷新频率选择「每小时」或「每天」。</div>
              <div>3. 返回手机桌面，<strong>长按桌面空白处 ➡️ 点击「＋」添加小组件</strong>。</div>
              <div>4. 找到手机自带的 <strong>「日历」小组件</strong>，拖放至桌面。</div>
              <div>5. 搞定！桌面将永远自动显示当前节次、下一堂课和未交作业，到点还会有贴心锁屏通知。</div>
            </div>
          </div>
        )}

        {showCleanupGuide && (
          <div className="bg-[#14161d] p-3 rounded border border-[#3e4252] text-xs space-y-2 text-[#c8c4b8] leading-relaxed">
            <div className="font-bold text-[#e9e4d8] flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5 text-[#f87171]" />
              <span>从手机日历中取消订阅或清理日程：</span>
            </div>
            <div className="pl-2 space-y-1.5 text-[11.5px]">
              <div>
                • <strong>苹果 iPhone</strong>：打开【日历】APP ➡️ 底部点击【日历】➡️ 找到【已订阅】分组下的【掌上课表】➡️ 点击「i」选择【删除订阅】即可一秒清空。
              </div>
              <div>
                • <strong>安卓手机</strong>：打开【日历】➡️ 菜单【日历管理】或【设置】➡️ 找到订阅日程直接关闭或删除。
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Generation Mode Selector: Widget Card vs Phone Lockscreen Wallpaper */}
      <div className="flex border-2 border-[#e9e4d8] text-xs font-bold divide-x-2 divide-[#e9e4d8] select-none rounded-xs overflow-hidden">
        <button
          onClick={() => setRenderMode('widget')}
          className={`flex-1 py-2.5 flex items-center justify-center gap-2 cursor-pointer transition-colors ${
            renderMode === 'widget' ? 'bg-[#e9e4d8] text-[#1d1f24]' : 'text-[#e9e4d8] hover:bg-white/10'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          <span>桌面小卡片 (Widget)</span>
        </button>
        <button
          onClick={() => setRenderMode('wallpaper')}
          className={`flex-1 py-2.5 flex items-center justify-center gap-2 cursor-pointer transition-colors ${
            renderMode === 'wallpaper' ? 'bg-[#e9e4d8] text-[#1d1f24]' : 'text-[#e9e4d8] hover:bg-white/10'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>手机锁屏壁纸 (1080×1920)</span>
        </button>
      </div>

      {/* 3. Stage Preview Area */}
      <div className="p-4 sm:p-5 bg-gradient-to-br from-[#1a1c26] to-[#121317] border-2 border-[#33363d] rounded-xl flex flex-col items-center gap-3">
        {/* Stage Header with PiP button */}
        <div className="w-full max-w-[380px] flex items-center justify-between pb-1 flex-wrap gap-2">
          <span className="text-xs font-mono text-[#8f8b80] font-bold tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#6b7cff]" />
            <span>{renderMode === 'widget' ? 'PREVIEW · 今日挂件预览' : 'PREVIEW · 9:16 锁屏壁纸预览'}</span>
          </span>

          {/* Desktop Floating PiP Button */}
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
            <span>{pipContainer ? '电脑端悬浮窗置顶中 (点击关闭)' : '电脑端桌面悬浮窗'}</span>
          </button>
        </div>

        {/* Content Preview Stage based on renderMode */}
        {renderMode === 'widget' ? (
          /* Classic Swiss Editorial Visual Card */
          <div className="w-full max-w-[380px] bg-[#202226] rounded-[24px] p-5 shadow-2xl border border-white/5 space-y-3.5 text-[#e9e4d8]">
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
              {displayList.map(c => {
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

              {Array.from({ length: Math.max(0, rowCount - displayList.length) }).map((_, idx) => (
                <div
                  key={idx}
                  className="bg-[#2b2d31]/50 border border-dashed border-[#3a3d44] rounded-2xl h-[62px] flex items-center justify-center text-xs text-[#63605a]"
                >
                  {displayList.length === 0 && idx === 0 ? '该日无更多课程' : '— 空闲 —'}
                </div>
              ))}
            </div>

            {/* Pending Homework count footer inside widget */}
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
          /* Phone Lockscreen Wallpaper 9:16 Mockup Stage */
          <div className="w-full max-w-[320px] space-y-3">
            {/* Wallpaper Content Sub-Switcher */}
            <div className="flex border border-[#3e4252] rounded-lg p-1 bg-[#14161d] text-xs font-semibold gap-1 select-none">
              <button
                onClick={() => setWallpaperType('week')}
                className={`flex-1 py-1.5 px-2 rounded text-center transition-colors cursor-pointer ${
                  wallpaperType === 'week'
                    ? 'bg-[#6b7cff] text-white shadow-xs'
                    : 'text-[#8f8b80] hover:text-[#e9e4d8]'
                }`}
              >
                📅 本周 7 天课表网格
              </button>
              <button
                onClick={() => setWallpaperType('today')}
                className={`flex-1 py-1.5 px-2 rounded text-center transition-colors cursor-pointer ${
                  wallpaperType === 'today'
                    ? 'bg-[#6b7cff] text-white shadow-xs'
                    : 'text-[#8f8b80] hover:text-[#e9e4d8]'
                }`}
              >
                📝 今日课程 + 待交作业
              </button>
            </div>

            {/* Smartphone 9:16 Mockup Frame */}
            <div className="w-full aspect-[9/16] bg-[#1d1f24] rounded-[36px] border-[5px] border-[#383b48] p-3 shadow-2xl relative flex flex-col justify-between text-[#e9e4d8] overflow-hidden select-none">
              {/* Top 32% Reserved Clock & Widgets Area */}
              <div className="h-[32%] flex flex-col items-center justify-center border-b border-dashed border-[#3e4252] bg-white/2 rounded-2xl p-2 relative">
                <div className="w-16 h-3.5 bg-black/80 rounded-full mb-1.5 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#444] mr-2" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#222]" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold tracking-tight font-sans text-white">
                  09:41
                </div>
                <div className="text-[10px] text-[#a39f93] font-medium">
                  {targetDate.getMonth() + 1}月{targetDate.getDate()}日 {WEEKDAYS[targetDayIdx]}
                </div>
                <div className="text-[8.5px] font-mono text-[#8f8b80] mt-1 bg-black/40 px-2 py-0.5 rounded-full border border-white/10">
                  👆 锁屏时钟/日期保留区 (32% 留白)
                </div>
              </div>

              {/* Bottom 68% Wallpaper Content Preview */}
              <div className="h-[67%] flex flex-col justify-between pt-2">
                {wallpaperType === 'week' ? (
                  <div className="flex-1 flex flex-col justify-between text-[10px]">
                    <div className="flex items-center justify-between border-b border-[#33363f] pb-1">
                      <span className="font-editorial font-bold text-xs text-[#f0efe9]">第 {targetWeek} 周 · 全周课表</span>
                      <span className="text-[8px] px-1.5 py-0.2 rounded font-bold text-white" style={{ backgroundColor: accentColor }}>
                        7 DAYS
                      </span>
                    </div>

                    {/* Mini 7-day grid */}
                    <div className="grid grid-cols-7 gap-1 py-1.5 flex-1">
                      {WEEKDAYS.map((w, idx) => {
                        const dayCoursesList = courses.filter(c => c.day === idx && isCourseInWeek(targetWeek, c.weeks));
                        const isCur = idx === targetDayIdx;
                        return (
                          <div
                            key={idx}
                            className={`rounded p-1 flex flex-col items-center justify-between text-center border ${
                              isCur
                                ? 'bg-[#292c36] border-[#6b7cff]'
                                : 'bg-[#21232a] border-[#2d3039]'
                            }`}
                          >
                            <span className={`text-[8.5px] font-bold ${isCur ? 'text-[#6b7cff]' : 'text-[#8f8b80]'}`}>
                              {w[1]}
                            </span>
                            <div className="flex flex-col gap-0.5 my-auto">
                              {dayCoursesList.slice(0, 3).map(c => (
                                <div
                                  key={c.id}
                                  className="w-1.5 h-1.5 rounded-full mx-auto"
                                  style={{ backgroundColor: c.color || accentColor }}
                                  title={c.name}
                                />
                              ))}
                              {dayCoursesList.length === 0 && (
                                <span className="text-[7.5px] text-[#555]">—</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-[8.5px] font-mono text-[#63605a] text-center pt-1 border-t border-[#2d3039]">
                      SWISS EDITORIAL · 1080×1920 高清竖屏壁纸
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col justify-between text-[10px]">
                    <div>
                      <div className="font-editorial font-bold text-xs text-white">
                        {isToday ? '今天' : WEEKDAYS[targetDayIdx]} · 第{targetWeek}周
                      </div>
                      <div className="text-[8px] font-mono text-[#8f8b80]">
                        今日课程 ({dayCourses.length}) ｜ 待交作业 ({pendingHomeworkList.length})
                      </div>
                    </div>

                    {/* Today Mini Courses List */}
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

                    {/* Pending Homework */}
                    <div className="pt-1 border-t border-[#2d3039] flex items-center justify-between text-[8.5px]">
                      <span className="text-[#8f8b80] font-mono">待交作业</span>
                      {pendingHomeworkList.length > 0 ? (
                        <span className="text-[#ff6b57] font-bold">{pendingHomeworkList.length} 项待交</span>
                      ) : (
                        <span className="text-emerald-400">全部完成 ✓</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Instruction Banner */}
            <div className="bg-[#14161d] p-2.5 rounded border border-[#2a2d36] text-[11px] text-[#a8a399] leading-relaxed">
              💡 <strong>使用指南</strong>：保存后打开手机相册 ➡️ 设为锁定屏幕壁纸。顶部已预留 32% 空白，避开系统时间与锁屏小组件，抬手亮屏即可查课！
            </div>
          </div>
        )}
      </div>

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

      {/* 4. iOS Scriptable 原生小组件脚本生成区 */}
      <div className="border border-[#383b48] bg-[#1d2028] p-4 rounded-lg space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-[#6b7cff]" />
            <h4 className="font-editorial font-bold text-sm text-[#e9e4d8]">
              iOS Scriptable 原生桌面小组件
            </h4>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-[#6b7cff]/20 text-[#6b7cff] font-bold border border-[#6b7cff]/30">
            iPhone / iPad 原生渲染
          </span>
        </div>

        <p className="text-xs text-[#8f8b80] leading-relaxed">
          通过 iOS 神器 <strong>Scriptable</strong> 运行原生 JavaScript 小组件脚本，直接在苹果桌面上画出深色 Swiss Editorial 高级排版卡片，展示今日前 3 节课与待交作业统计。
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleCopyScriptable}
            className="flex-1 min-w-[200px] py-2 px-3.5 bg-[#6b7cff] hover:bg-[#5868e6] text-white font-bold text-xs rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm active:scale-98"
          >
            {copiedScriptable ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedScriptable ? 'Scriptable 脚本已复制到剪贴板！' : '复制 iOS Scriptable 小组件脚本'}</span>
          </button>

          <button
            onClick={() => setShowScriptableModal(true)}
            className="py-2 px-3 border border-[#3e4252] text-[#e9e4d8] hover:bg-white/5 font-semibold text-xs rounded flex items-center gap-1.5 cursor-pointer"
          >
            <FileCode className="w-3.5 h-3.5 text-[#6b7cff]" />
            <span>查看代码 / 下载</span>
          </button>
        </div>
      </div>

      {/* Row Count Buttons (Only for Widget mode) */}
      {renderMode === 'widget' && (
        <div>
          <div className="text-[10px] font-bold tracking-[3px] text-[#8f8b80] mb-2 font-mono">
            SIZE · 尺寸容量
          </div>
          <div className="flex border border-[#e9e4d8] text-xs font-bold divide-x divide-[#e9e4d8]">
            {([2, 3, 5] as const).map(n => (
              <button
                key={n}
                onClick={() => setRowCount(n)}
                className={`flex-1 py-2 text-center transition-colors cursor-pointer ${
                  rowCount === n ? 'bg-[#e9e4d8] text-[#1d1f24]' : 'text-[#e9e4d8] hover:bg-white/10'
                }`}
              >
                {n === 2 ? '小 · 2 条' : n === 3 ? '中 · 3 条' : '大 · 5 条'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Accent Colors */}
      <div>
        <div className="text-[10px] font-bold tracking-[3px] text-[#8f8b80] mb-2 font-mono">
          ACCENT · 强调色
        </div>
        <div className="flex gap-2.5 bg-[#24262c] p-3 border border-[#33363d] rounded">
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

      {/* Export actions based on renderMode */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        {renderMode === 'widget' ? (
          <>
            <button
              onClick={handleCopy}
              className="py-3 bg-[#e9e4d8] hover:bg-white text-[#1d1f24] font-bold text-xs tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              复制小组件图片
            </button>
            <button
              onClick={handleDownload}
              className="py-3 border-2 border-[#e9e4d8] text-[#e9e4d8] hover:bg-[#e9e4d8] hover:text-[#1d1f24] font-bold text-xs tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              导出高清 PNG
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleCopyWallpaper}
              className="py-3 bg-[#e9e4d8] hover:bg-white text-[#1d1f24] font-bold text-xs tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              复制壁纸图片
            </button>
            <button
              onClick={handleDownloadWallpaper}
              className="py-3 bg-[#6b7cff] hover:bg-[#5868e6] text-white font-bold text-xs tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md"
            >
              <Download className="w-3.5 h-3.5" />
              保存 PNG 锁屏壁纸 (1080×1920)
            </button>
          </>
        )}
      </div>

      {/* Scriptable Modal */}
      {showScriptableModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#1d1f24] border-2 border-[#6b7cff] text-[#e9e4d8] max-w-lg w-full max-h-[85vh] flex flex-col rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[#33363f]">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-[#6b7cff]" />
                <h3 className="font-editorial font-bold text-base">iOS Scriptable 原生小组件源码</h3>
              </div>
              <button
                onClick={() => setShowScriptableModal(false)}
                className="text-[#8f8b80] hover:text-[#e9e4d8] cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
              <div className="bg-[#14161c] p-2.5 rounded border border-[#2a2d36] text-[11.5px] text-[#a8a399] leading-relaxed">
                <div className="font-bold text-[#e9e4d8] mb-1">使用方法：</div>
                <div>1. App Store 下载免费的 <strong>Scriptable</strong> 应用。</div>
                <div>2. 打开 Scriptable 点击右上角「+」，将下方脚本全选粘贴进去并保存。</div>
                <div>3. 回到 iPhone 桌面长按空白处 ➡️ 点击「+」➡️ 选择「Scriptable」中号或大号组件 ➡️ 选定该脚本。</div>
              </div>

              <div className="relative">
                <pre className="bg-[#15171d] p-3 rounded font-mono text-[10.5px] text-[#c5c1b5] overflow-x-auto max-h-[300px] border border-[#2f323c] leading-relaxed">
                  {getScriptableScript()}
                </pre>
              </div>
            </div>

            <div className="p-3 border-t border-[#33363f] bg-[#17191e] flex gap-2">
              <button
                onClick={handleCopyScriptable}
                className="flex-1 py-2 bg-[#6b7cff] hover:bg-[#5868e6] text-white font-bold text-xs rounded flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedScriptable ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedScriptable ? '已复制！' : '复制代码'}</span>
              </button>
              <button
                onClick={handleDownloadScriptable}
                className="py-2 px-3 border border-[#3e4252] hover:bg-white/5 text-[#e9e4d8] font-bold text-xs rounded flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>下载 .js</span>
              </button>
            </div>
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
