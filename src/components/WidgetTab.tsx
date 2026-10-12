import React, { useState } from 'react';
import { Course, User } from '../types';
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
  Copy,
  Download,
  Check,
  Sparkles,
  Info,
  RotateCcw,
  CheckCircle2,
  Trash2,
  RefreshCw,
} from 'lucide-react';

interface WidgetTabProps {
  user?: User;
  courses: Course[];
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
  leadMinutes,
  toast,
  onOpenCourse,
}) => {
  const now = new Date();
  const isSundayEveNow = (now.getDay() === 0 && now.getHours() >= 18);
  const [dayOffset, setDayOffset] = useState(() => (isSundayEveNow ? 1 : 0));
  const [rowCount, setRowCount] = useState<2 | 3 | 5>(2);
  const [accentColor, setAccentColor] = useState('#8b5cf6');
  const [copiedLink, setCopiedLink] = useState(false);
  const [showAutoTutorial, setShowAutoTutorial] = useState(false);
  const [showCleanupGuide, setShowCleanupGuide] = useState(false);

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

  const sortedCourses = React.useMemo(() => {
    if (!isToday) return dayCourses;
    return dayCourses.slice().sort((a, b) => {
      const isPastA = toMinutes(SLOTS[a.e].e) < currentMinutes ? 1 : 0;
      const isPastB = toMinutes(SLOTS[b.e].e) < currentMinutes ? 1 : 0;
      return isPastA - isPastB || a.s - b.s;
    });
  }, [dayCourses, isToday, currentMinutes]);

  const displayList = sortedCourses.slice(0, rowCount);

  const liveWidgetUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/widget/${username}/today.svg`
    : `/api/widget/${username}/today.svg`;

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

        g.fillStyle = '#8e8d87';
        g.font = '14px sans-serif';
        g.fillText(SLOTS[c.e].e, cardX + 32, curY + 68);

        g.fillStyle = '#f7f6f1';
        g.font = 'bold 20px "Songti SC", Georgia, serif';
        g.fillText(c.name, cardX + 104, curY + 45);

        g.fillStyle = '#a3a19b';
        g.font = '13.5px sans-serif';
        const metaStr = `第${c.s}-${c.e}节${c.room ? ` ｜ @${c.room}` : ''}${
          c.teacher ? ` ｜ ${c.teacher}` : ''
        }`;
        g.fillText(metaStr, cardX + 104, curY + 74);
      }

      curY += rowH + 12;
    }

    return cv;
  };

  const handleDownload = () => {
    const cv = drawWidgetCanvas();
    const a = document.createElement('a');
    a.href = cv.toDataURL('image/png');
    a.download = `课程小组件-${isToday ? '今日' : `${targetDate.getMonth() + 1}月${targetDate.getDate()}日`}.png`;
    a.click();
    toast('已导出高清小组件 PNG 图片');
  };

  const handleCopy = () => {
    try {
      const cv = drawWidgetCanvas();
      cv.toBlob(async blob => {
        if (!blob) return;
        if (navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          toast('小组件图片已复制到剪贴板');
        } else {
          handleDownload();
        }
      });
    } catch (e) {
      handleDownload();
    }
  };

  const handleSyncToSystemCalendar = () => {
    downloadCalendarFile(studentName, courses);
    const now = new Date();
    const timeStr = `${now.getMonth() + 1}月${now.getDate()}日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newInfo = { synced: true, lastSyncTime: timeStr, coursesSnapshot: courses };
    setCalendarSyncInfo(newInfo);
    try {
      localStorage.setItem(syncStorageKey, JSON.stringify(newInfo));
    } catch (e) {}
    toast('已生成手机日历同步文件！请在弹窗中选择“添加到系统日历”。');
    setShowAutoTutorial(true);
  };

  const handleResetCalendarSync = (downloadFile: boolean = true) => {
    if (downloadFile) {
      let cancelCourses = courses;
      try {
        const saved = localStorage.getItem(syncStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed?.coursesSnapshot) && parsed.coursesSnapshot.length > 0) {
            const map = new Map<number, Course>();
            parsed.coursesSnapshot.forEach((c: Course) => map.set(c.id, c));
            courses.forEach(c => map.set(c.id, c));
            cancelCourses = Array.from(map.values());
          }
        }
      } catch (e) {}
      downloadCancelCalendarFile(studentName, cancelCourses);
    }
    const newInfo = { synced: false, lastSyncTime: undefined };
    setCalendarSyncInfo(newInfo);
    try {
      localStorage.setItem(syncStorageKey, JSON.stringify(newInfo));
    } catch (e) {}
    if (downloadFile) {
      toast('已下载日历还原文件并重置为「未添加」！手机打开此文件即可取消日程。');
      setShowCleanupGuide(true);
    } else {
      toast('已重置为未添加日历状态');
    }
  };

  const handleDownloadCleanupCalendar = () => {
    let cancelCourses = courses;
    try {
      const saved = localStorage.getItem(syncStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed?.coursesSnapshot) && parsed.coursesSnapshot.length > 0) {
          const map = new Map<number, Course>();
          parsed.coursesSnapshot.forEach((c: Course) => map.set(c.id, c));
          courses.forEach(c => map.set(c.id, c));
          cancelCourses = Array.from(map.values());
        }
      }
    } catch (e) {}
    downloadCancelCalendarFile(studentName, cancelCourses);
    const newInfo = { synced: false, lastSyncTime: undefined };
    setCalendarSyncInfo(newInfo);
    try {
      localStorage.setItem(syncStorageKey, JSON.stringify(newInfo));
    } catch (e) {}
    toast('已生成日历还原文件并重置状态！请在手机弹窗中确认取消日程。');
  };

  const handleCopyLiveWidgetUrl = () => {
    navigator.clipboard.writeText(liveWidgetUrl);
    setCopiedLink(true);
    toast('已复制动态小组件图片链接！');
    setTimeout(() => setCopiedLink(false), 2200);
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Title & Day switcher */}
      <div className="flex items-end justify-between border-b-[2.5px] border-[#e9e4d8] pb-2">
        <div>
          <div className="font-editorial text-2xl sm:text-3xl font-extrabold tracking-wide text-[#e9e4d8]">
            桌面小组件
          </div>
          <div className="text-[9.5px] font-mono tracking-[3px] text-[#8f8b80] mt-0.5">
            DESKTOP WIDGET PREVIEW
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

      {/* Featured Section */}
      <div className="bg-gradient-to-r from-[#1c223a] to-[#1a1c22] border-2 border-[#6b7cff] p-4 rounded-lg shadow-xl text-[#e9e4d8] space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#6b7cff]" />
            <h4 className="font-editorial font-bold text-base text-[#e9e4d8]">
              手机桌面免打开 · 自动更新设置
            </h4>
          </div>

          {calendarSyncInfo.synced ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 text-[11px] font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>已添加到日历 {calendarSyncInfo.lastSyncTime ? `(${calendarSyncInfo.lastSyncTime})` : ''}</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#2a2c36] text-[#a8a399] border border-[#3e4252] text-[11px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#8f8b80]" />
              <span>未添加日历</span>
            </div>
          )}
        </div>

        <p className="text-xs text-[#a8a399] leading-relaxed">
          把课表变成手机桌面/锁屏上的实时卡片，<strong>完全不需要打开软件</strong>，系统每天自动显示当前节次、下一节课和教室，课前自动提醒！
        </p>

        <div className="space-y-2 pt-1">
          {calendarSyncInfo.synced ? (
            <div className="space-y-2.5 p-3 bg-[#151720] border border-emerald-500/30 rounded-lg">
              <div className="flex items-center justify-between text-xs text-emerald-300 font-medium">
                <span className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  当前状态：已同步到手机系统日历
                </span>
                {calendarSyncInfo.lastSyncTime && (
                  <span className="text-[11px] text-[#8f8b80] font-mono">
                    同步时间: {calendarSyncInfo.lastSyncTime}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={handleSyncToSystemCalendar}
                  className="w-full py-2.5 px-3 bg-[#6b7cff] hover:bg-[#5b6cee] text-white font-bold text-xs tracking-wider rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md"
                  title="重新生成日历文件覆盖更新"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  重新同步 / 更新日历 (.ics)
                </button>

                <button
                  onClick={() => handleResetCalendarSync(true)}
                  className="w-full py-2.5 px-3 bg-[#242630] hover:bg-[#2e313e] text-[#f87171] hover:text-[#ef4444] border border-[#f87171]/40 font-bold text-xs tracking-wider rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  title="下载日历撤销文件并在应用内恢复为未添加状态"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#f87171]" />
                  一键还原日历（下载撤销文件并重置）
                </button>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => handleResetCalendarSync(false)}
                  className="text-[10.5px] text-[#8f8b80] hover:text-[#e9e4d8] underline cursor-pointer"
                  title="仅重置标记"
                >
                  仅重置应用内状态标记（不下载文件）
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={handleSyncToSystemCalendar}
                className="w-full py-2.5 px-3 bg-[#6b7cff] hover:bg-[#5b6cee] text-white font-bold text-xs tracking-wider rounded flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
              >
                <Calendar className="w-4 h-4" />
                一键同步到手机系统日历（下载 .ics 文件 · 桌面自动更新）
              </button>

              <button
                onClick={() => handleResetCalendarSync(true)}
                className="w-full py-2 px-3 bg-[#1e2028] hover:bg-[#252834] text-[#f87171] hover:text-[#ef4444] border border-[#f87171]/30 font-semibold text-xs tracking-wider rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#f87171]" />
                一键还原日历（下载撤销文件清空日程）
              </button>
            </div>
          )}

          <button
            onClick={handleCopyLiveWidgetUrl}
            className="w-full py-2 px-3 bg-[#2b2d36] hover:bg-[#343844] text-[#e9e4d8] border border-[#3e4252] font-semibold text-xs tracking-wider rounded flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-[#4ade80]" /> : <Copy className="w-3.5 h-3.5 text-[#6b7cff]" />}
            <span>{copiedLink ? '动态图片链接已复制！' : '复制实时图片挂件网址（用于万能小组件/照片微件）'}</span>
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] pt-1">
          <button
            onClick={() => setShowAutoTutorial(!showAutoTutorial)}
            className="text-[#6b7cff] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Info className="w-3 h-3" />
            <span>{showAutoTutorial ? '收起桌面添加指引' : '查看如何把自动更新组件放到手机桌面？'}</span>
          </button>

          <button
            onClick={() => setShowCleanupGuide(!showCleanupGuide)}
            className="text-[#8f8b80] hover:text-[#e9e4d8] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3 h-3 text-[#f87171]/70" />
            <span>{showCleanupGuide ? '收起移除说明' : '如何从手机日历中清除日程？'}</span>
          </button>
        </div>

        {showCleanupGuide && (
          <div className="bg-[#14161d] p-3 rounded border border-[#3e4252] text-xs space-y-2 text-[#c8c4b8] leading-relaxed">
            <div className="font-bold text-[#e9e4d8] flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5 text-[#f87171]" />
              <span>从手机日历中批量移除课程日程：</span>
            </div>
            <div className="pl-2 space-y-1.5 text-[11.5px]">
              <div>
                <strong>方法 1（手机原生移除）：</strong>
                <div className="text-[#a8a399] mt-0.5">
                  • <strong>苹果 iPhone</strong>：打开【日历】APP ➡️ 底部【日历】➡️ 找到【掌上课表】➡️ 点击「i」删除日历。
                  <br />
                  • <strong>安卓手机</strong>：打开【日历】➡️ 侧边栏【日历管理】➡️ 关闭或删除课表日程。
                </div>
              </div>
              <div>
                <strong>方法 2（下载撤销文件一键还原）：</strong>
                <div className="mt-1">
                  <button
                    onClick={handleDownloadCleanupCalendar}
                    className="py-1 px-3 bg-[#2a2c36] hover:bg-[#343844] text-[#f87171] border border-[#f87171]/40 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    下载日历还原撤销文件 (.ics)
                  </button>
                  <div className="text-[11px] text-[#a8a399] mt-1 leading-relaxed">
                    在手机中打开撤销文件，确认「取消全部日程」即可干净清空已导入的课程。
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showAutoTutorial && (
          <div className="bg-[#12141a] p-3 rounded border border-[#2e323e] text-xs space-y-2 text-[#c8c4b8] leading-relaxed">
            <div className="font-bold text-[#e9e4d8]">📱 手机桌面小组件添加教学：</div>
            <div className="pl-2 space-y-1">
              <div>1. 点击上方 <strong>「一键同步到手机系统日历」</strong>，下载并在手机上打开日历文件。</div>
              <div>2. 手机弹窗提示时，点击 <strong>「全部添加到日历」</strong>。</div>
              <div>3. 回到手机桌面，<strong>长按桌面空白处 ➡️ 点击「＋」添加小组件</strong>。</div>
              <div>4. 找到手机自带的 <strong>「日历」小组件</strong>，选择中号或大号卡片拖放到桌面。</div>
              <div>5. 完成！桌面日历小组件将**全自动实时更新**今天的课程、教室与上课时间，到点还会自动响铃提醒！</div>
            </div>
          </div>
        )}
      </div>

      {/* Widget Card Stage */}
      <div className="p-4 sm:p-5 bg-gradient-to-br from-[#1a1c26] to-[#121317] border-2 border-[#33363d] rounded-xl flex justify-center">
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
                    style={{ backgroundColor: accentColor }}
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
        </div>
      </div>

      {/* Row Count Buttons */}
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

      {/* Export actions */}
      <div className="grid grid-cols-2 gap-3 pt-2">
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
      </div>
    </div>
  );
};
