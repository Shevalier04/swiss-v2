import React, { useState, useMemo } from 'react';
import { Course, Homework, User, TaskItem } from '../types';
import { dueDays, pad2, calculateDetailedRemaining } from '../utils/time';
import { parseQuickHomeworkLine } from '../utils/assignmentParser';
import {
  Trash2,
  Plus,
  Terminal,
  DownloadCloud,
  Zap,
  Sparkles,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileText,
  Check,
  Layers,
  Filter,
  BookOpen,
  Grid,
  List,
  Pencil,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { HomeworkImportModal } from './HomeworkImportModal';
import { SmartHomeworkPasteModal } from './SmartHomeworkPasteModal';
import { HomeworkEditModal } from './HomeworkEditModal';

interface HomeworkTabProps {
  user?: User | null;
  courses: Course[];
  homework: Homework[];
  tasks?: TaskItem[];
  onAdd: (course: string, title: string, due?: string) => Promise<void>;
  onBatchAdd?: (items: { course: string; title: string; due?: string }[]) => Promise<void>;
  onToggle: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onAddTask?: (title: string) => Promise<void>;
  onJumpToFocusTask?: (taskTitle: string) => void;
  onImportPreset?: () => void;
  onUpdate?: (id: number, data: { course: string; title: string; due: string }) => Promise<void>;
  toast: (msg: string) => void;
}

export const HomeworkTab: React.FC<HomeworkTabProps> = ({
  user,
  courses,
  homework,
  tasks = [],
  onAdd,
  onBatchAdd,
  onToggle,
  onDelete,
  onAddTask,
  onJumpToFocusTask,
  onImportPreset,
  onUpdate,
  toast,
}) => {
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('all');

  // Course Category & Grouping View States
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');
  const [collapsedCourses, setCollapsedCourses] = useState<Record<string, boolean>>({});
  const [editingHomework, setEditingHomework] = useState<Homework | null>(null);

  // Sorting state by due date: asc (urgent first), desc (furthest first), or default
  const [dueDateSort, setDueDateSort] = useState<'asc' | 'desc' | 'default'>('asc');

  // Helper to sort homework items by due date
  const sortHomeworkByDue = (items: Homework[], order: 'asc' | 'desc' | 'default'): Homework[] => {
    if (order === 'default') return items;
    return [...items].sort((a, b) => {
      // Prioritize uncompleted tasks
      if (a.done !== b.done) {
        return a.done ? 1 : -1;
      }

      const parseTimeToMs = (dStr?: string) => {
        if (!dStr) return null;
        const normalized = dStr.replace(/-/g, '/');
        const ms = new Date(normalized).getTime();
        return isNaN(ms) ? null : ms;
      };

      const msA = parseTimeToMs(a.due);
      const msB = parseTimeToMs(b.due);

      if (msA === null && msB === null) return Number(b.id) - Number(a.id);
      if (msA === null) return 1;
      if (msB === null) return -1;

      return order === 'asc' ? msA - msB : msB - msA;
    });
  };

  const toggleCourseCollapse = (cName: string) => {
    setCollapsedCourses(prev => ({ ...prev, [cName]: !prev[cName] }));
  };

  // Single-line quick input state
  const quickInputRef = React.useRef<HTMLInputElement>(null);
  const [quickText, setQuickText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Modals state
  const [showSmartPasteModal, setShowSmartPasteModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Optional expanded manual form
  const [showManualForm, setShowManualForm] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualDueDate, setManualDueDate] = useState('');

  const courseNames = useMemo(() => {
    const names = Array.from(new Set(courses.map(c => c.name))).filter(Boolean);
    return names.length ? names : ['Web编程技术', '数据库概论', '软件工程导论', '高等数学', '其他'];
  }, [courses]);

  React.useEffect(() => {
    if (!selectedCourse && courseNames.length) {
      setSelectedCourse(courseNames[0]);
    }
  }, [courseNames, selectedCourse]);

  // Platform detector helper mapping keywords to uploaded images 1, 2, 3, 4 respectively
  const getPlatformBadge = (text: string) => {
    if (/PTA/i.test(text)) {
      return (
        <div className="w-10 h-10 rounded-xl bg-white border border-blue-200 shadow-sm flex items-center justify-center shrink-0 select-none align-middle relative overflow-hidden p-1.5" title="平台: PTA">
          <svg className="w-full h-full text-blue-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="16" height="12" rx="2.5" fill="#2563eb" fillOpacity="0.1" stroke="#2563eb" strokeWidth="1.8"/>
            <polygon points="7,14 11,14 9,17" fill="#2563eb" stroke="#2563eb" strokeWidth="1" strokeLinejoin="round"/>
            <path d="M5 6l-2.5 2L5 10" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11 6l2.5 2L11 10" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="9" y1="5.5" x2="7" y2="10.5" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"/>
            <rect x="3" y="16" width="16" height="5" rx="1" fill="#2563eb" fillOpacity="0.15" stroke="#2563eb" strokeWidth="1.5"/>
            <line x1="11" y1="16" x2="11" y2="21" stroke="#2563eb" strokeWidth="1.5"/>
            <line x1="6" y1="18.5" x2="9" y2="18.5" stroke="#2563eb" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="13" y1="18.5" x2="16" y2="18.5" stroke="#2563eb" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </div>
      );
    }
    if (/课堂派/i.test(text)) {
      return (
        <div className="w-10 h-10 rounded-xl bg-[#1890ff] shadow-sm flex items-center justify-center shrink-0 select-none align-middle relative overflow-hidden" title="平台: 课堂派">
          <span className="text-white font-black text-xl tracking-tighter drop-shadow-xs z-10 font-sans">A⁺</span>
        </div>
      );
    }
    if (/学习通/i.test(text)) {
      return (
        <div className="w-10 h-10 rounded-xl bg-[#e53935] shadow-sm flex items-center justify-center shrink-0 select-none align-middle relative overflow-hidden p-1" title="平台: 超星学习通">
          <svg className="w-full h-full text-white" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="18,2 19.1,5.5 22.5,6.3 19.8,8.7 20.5,12.3 18,10.5 15.5,12.3 16.2,8.7 13.5,6.3 16.9,5.5" />
            <path d="M1 22C1 16 5 9 13.8 6.5L13.5 5.5C4 8 0 16 0 22H1Z" fill="white" fillOpacity="0.75" />
            <path d="M4 22C4 17 8 11 14.5 7.5L14.2 6.5C8 9 3 17 3 22H4Z" fill="white" fillOpacity="0.85" />
            <path d="M7 22C7 18 10 13 15.2 8.5L15 7.5C10 10 6 18 6 22H7Z" fill="white" fillOpacity="0.95" />
            <path d="M10 22C10 19 12 14.5 16 9.5L15.8 8.5C12 11 9 19 9 22H10Z" fill="white" />
          </svg>
        </div>
      );
    }
    if (/明理云盘|云盘/i.test(text)) {
      return (
        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center shrink-0 select-none align-middle relative overflow-hidden p-1.5" title="平台: 明理云盘 (图4)">
          <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 17l5-8 4 4 3-3 6 7H2z" fill="#3b82f6" fillOpacity="0.2"/>
            <path d="M12 12l3-3 6 7H3l6-4z" stroke="#2563eb" strokeWidth="2"/>
            <circle cx="17" cy="8" r="2.5" fill="#f97316"/>
          </svg>
        </div>
      );
    }
    return null;
  };

  // Real-time parsed preview for single-line quick input
  const quickPreview = useMemo(() => {
    if (!quickText.trim()) return null;
    return parseQuickHomeworkLine(quickText, courseNames);
  }, [quickText, courseNames]);

  // 1. Single-line quick add handler (Enter or click)
  const handleQuickAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = quickText.trim();
    if (!trimmed) {
      toast('请输入课程名与作业内容，例如：高数 课后习题P32 @明天');
      return;
    }

    const parsed = parseQuickHomeworkLine(trimmed, courseNames);
    if (!parsed || (!parsed.title.trim() && !parsed.course.trim())) {
      toast('未能识别到有效的课程或作业内容');
      return;
    }

    const finalCourse = parsed.course.trim() || (courseNames[0] || '常规课程');
    const finalTitle = parsed.title.trim();
    const finalDue = parsed.due;

    setSubmitting(true);
    try {
      await onAdd(finalCourse, finalTitle, finalDue);
      setQuickText('');
      toast(`已极速录入：[${finalCourse}]${finalTitle ? ` ${finalTitle}` : ''}${finalDue ? ` ｜ 截止：${parsed.rawDueText || finalDue}` : ''}`);
    } catch (err: any) {
      toast(err.message || '添加失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Append quick date tag to single-line input
  const handleAppendDateTag = (dateTag: string) => {
    // If input already has an @tag, replace it, else append
    if (quickText.includes('@')) {
      setQuickText(prev => prev.replace(/@[^\s@]+$/, dateTag));
    } else {
      setQuickText(prev => (prev ? `${prev.trim()} ${dateTag}` : dateTag));
    }
  };

  // 3. Quick pick course prefix
  const handlePickCourseTag = (cName: string) => {
    if (!quickText.trim()) {
      setQuickText(`${cName} `);
    } else {
      // Check if already starts with a course name
      const parsed = parseQuickHomeworkLine(quickText, courseNames);
      if (parsed) {
        setQuickText(`${cName} ${parsed.title}${parsed.rawDueText ? ` @${parsed.rawDueText}` : ''}`);
      } else {
        setQuickText(`${cName} ${quickText}`);
      }
    }
  };

  // 4. Fallback manual add handler
  const handleManualAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!manualTitle.trim()) {
      toast('请输入作业内容');
      return;
    }
    setSubmitting(true);
    const formattedDue = manualDueDate ? manualDueDate.replace('T', ' ') : undefined;
    try {
      await onAdd(selectedCourse || courseNames[0] || '其他', manualTitle.trim(), formattedDue);
      setManualTitle('');
      setManualDueDate('');
      setShowManualForm(false);
      toast('已添加作业，倒计时已同步到课程表');
    } catch (err: any) {
      toast(err.message || '添加失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBatchImport = async (items: { course: string; title: string; due?: string }[]) => {
    if (onBatchAdd) {
      await onBatchAdd(items);
    } else {
      for (const item of items) {
        await onAdd(item.course, item.title, item.due);
      }
    }
  };

  // Immediate optimistic local overrides to guarantee 0ms instant UI reaction
  const [optimisticToggles, setOptimisticToggles] = useState<Record<number, boolean>>({});

  const handleToggleHomework = (id: number) => {
    // Subtle haptic feedback if mobile device supports it
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(10);
      } catch (e) {}
    }

    const numericId = Number(id);
    const currentItem = homework.find(h => Number(h.id) === numericId);
    if (!currentItem) return;
    const currentDone = optimisticToggles[numericId] !== undefined ? optimisticToggles[numericId] : currentItem.done;
    const nextDone = !currentDone;

    // 1. Instant local optimistic update (0ms UI feedback)
    setOptimisticToggles(prev => ({ ...prev, [numericId]: nextDone }));

    // 2. Trigger parent toggle
    onToggle(numericId).catch(() => {
      // Revert if error
      setOptimisticToggles(prev => {
        const next = { ...prev };
        delete next[numericId];
        return next;
      });
      toast('更新作业状态失败，请重试');
    });
  };

  // Sync back when homework prop from backend changes
  React.useEffect(() => {
    setOptimisticToggles(prev => {
      const keys = Object.keys(prev);
      if (keys.length === 0) return prev;
      let changed = false;
      const next = { ...prev };
      for (const key of keys) {
        const id = Number(key);
        const item = homework.find(h => Number(h.id) === id);
        if (item && item.done === prev[id]) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [homework]);

  const effectiveHomework = useMemo(() => {
    const raw = homework.map(h => {
      const hId = Number(h.id);
      const override = optimisticToggles[hId] !== undefined ? optimisticToggles[hId] : optimisticToggles[h.id];
      return override !== undefined ? { ...h, done: override } : h;
    });

    const map = new Map<string, Homework>();
    const getCleanTitle = (title: string) => {
      return (title || '')
        .replace(/^\[.*?\]\s*/, '')
        .replace(/^(学习通|超星学习通|课堂派|PTA|明理云盘|云盘)[\s:：-]*|[\s:：-]*(学习通|超星学习通|课堂派|PTA|明理云盘|云盘)$/i, '')
        .trim()
        .toLowerCase();
    };

    for (const h of raw) {
      const courseKey = (h.course || '常规课程').trim().toLowerCase();
      const cleanTitle = getCleanTitle(h.title);
      const compositeKey = `${courseKey}__${cleanTitle}`;

      if (!map.has(compositeKey)) {
        map.set(compositeKey, { ...h });
      } else {
        const existing = map.get(compositeKey)!;
        const platformPattern = /^(学习通|超星学习通|课堂派|PTA|明理云盘|云盘)[\s:：-]*|[\s:：-]*(学习通|超星学习通|课堂派|PTA|明理云盘|云盘)$/i;
        const isCurrentPrefixed = platformPattern.test(h.title.trim());
        const isExistingPrefixed = platformPattern.test(existing.title.trim());

        // Prioritize and keep the version with the platform prefix
        if (!isExistingPrefixed && isCurrentPrefixed) {
          existing.title = h.title;
          if (h.due) existing.due = h.due;
        } else if (h.due && !existing.due) {
          existing.due = h.due;
        }
        if (h.done) existing.done = true;
      }
    }

    return Array.from(map.values());
  }, [homework, optimisticToggles]);

  // Get list of unique courses present in current homework list
  const availableCourses = useMemo(() => {
    return Array.from(new Set(effectiveHomework.map(h => h.course || '常规课程').filter(Boolean)));
  }, [effectiveHomework]);

  // Homework count breakdown per course
  const courseCounts = useMemo(() => {
    const map: Record<string, { total: number; pending: number }> = {};
    for (const h of effectiveHomework) {
      const cName = h.course || '常规课程';
      if (!map[cName]) {
        map[cName] = { total: 0, pending: 0 };
      }
      map[cName].total += 1;
      if (!h.done) map[cName].pending += 1;
    }
    return map;
  }, [effectiveHomework]);

  // Filtered list by status (all/todo/done) AND selected course category with due date sorting
  const filteredList = useMemo(() => {
    const list = effectiveHomework.filter(h => {
      if (filter === 'todo' && h.done) return false;
      if (filter === 'done' && !h.done) return false;
      if (selectedCourseFilter !== 'all' && (h.course || '常规课程') !== selectedCourseFilter) return false;
      return true;
    });
    return sortHomeworkByDue(list, dueDateSort);
  }, [effectiveHomework, filter, selectedCourseFilter, dueDateSort]);

  // Grouped list by course with true course-wide pending counts and due date sorting
  const groupedHomework = useMemo(() => {
    const groups: { courseName: string; items: Homework[]; pendingCount: number; totalCount: number }[] = [];
    const allCourseMap = new Map<string, Homework[]>();

    for (const h of effectiveHomework) {
      const cName = h.course || '常规课程';
      if (!allCourseMap.has(cName)) {
        allCourseMap.set(cName, []);
      }
      allCourseMap.get(cName)!.push(h);
    }

    for (const [courseName, allItems] of allCourseMap.entries()) {
      if (selectedCourseFilter !== 'all' && courseName !== selectedCourseFilter) {
        continue;
      }

      const rawItems = allItems.filter(h => {
        if (filter === 'todo' && h.done) return false;
        if (filter === 'done' && !h.done) return false;
        return true;
      });

      if (rawItems.length === 0) continue;

      const items = sortHomeworkByDue(rawItems, dueDateSort);
      const pendingCount = allItems.filter(it => !it.done).length;
      const totalCount = allItems.length;

      groups.push({ courseName, items, pendingCount, totalCount });
    }

    // Sort groups: if sorting by due date, prioritize groups with earliest pending deadlines
    groups.sort((a, b) => {
      if (dueDateSort !== 'default') {
        const getDueMetric = (hwList: Homework[]) => {
          let metric = dueDateSort === 'asc' ? Infinity : -Infinity;
          for (const h of hwList) {
            if (h.done || !h.due) continue;
            const ms = new Date(h.due.replace(/-/g, '/')).getTime();
            if (!isNaN(ms)) {
              if (dueDateSort === 'asc' && ms < metric) metric = ms;
              if (dueDateSort === 'desc' && ms > metric) metric = ms;
            }
          }
          return metric;
        };

        const metA = getDueMetric(a.items);
        const metB = getDueMetric(b.items);

        if (metA !== metB) {
          return dueDateSort === 'asc' ? metA - metB : metB - metA;
        }
      }

      if (b.pendingCount !== a.pendingCount) return b.pendingCount - a.pendingCount;
      return a.courseName.localeCompare(b.courseName, 'zh-CN');
    });

    return groups;
  }, [effectiveHomework, filter, selectedCourseFilter, dueDateSort]);

  const pendingCount = useMemo(() => {
    return effectiveHomework.filter(h => !h.done).length;
  }, [effectiveHomework]);

  return (
    <div className="space-y-3.5 pb-6">
      {/* Title & Import Actions Bar */}
      <div className="flex items-end justify-between border-b-[2.5px] border-[#e9e4d8] pb-2">
        <div>
          <div className="font-editorial text-2xl sm:text-3xl font-extrabold tracking-wide text-[#e9e4d8]">
            全部作业
          </div>
          <div className="text-[9.5px] font-mono tracking-[3px] text-[#8f8b80] mt-0.5">
            ASSIGNMENTS · 倒计时与色块同步
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {/* Smart Group Notice Paste Modal Trigger */}
          <button
            type="button"
            onClick={() => setShowSmartPasteModal(true)}
            className="px-2.5 py-1 bg-[#6b7cff]/20 hover:bg-[#6b7cff] text-[#6b7cff] hover:text-white border border-[#6b7cff] rounded text-xs font-bold tracking-wider flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
            title="直接粘贴微信/QQ群中的作业通知消息智能解析导入"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>智能粘贴导入</span>
          </button>

          {/* Free Checklist Import Modal Trigger */}
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className={`px-2.5 py-1 text-xs rounded transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5 ${
              user?.role === 'admin'
                ? 'bg-[#6b7cff]/20 hover:bg-[#6b7cff] text-[#6b7cff] hover:text-white border border-[#6b7cff] font-bold'
                : 'bg-[#252834] hover:bg-[#303444] text-[#e9e4d8] border border-[#33363d] font-medium'
            }`}
            title={user?.role === 'admin' ? '官方作业池同步与全员下发 (管理员权限)' : '从官方作业池自主勾选同步到个人作业'}
          >
            <DownloadCloud className="w-3.5 h-3.5 text-[#6b7cff]" />
            <span>{user?.role === 'admin' ? '官方作业同步与下发' : '官方作业同步'}</span>
            {user?.role === 'admin' && (
              <span className="text-[9.5px] px-1 py-0.2 bg-[#6b7cff] text-white font-mono rounded">
                ADMIN
              </span>
            )}
          </button>

          <div className="font-editorial italic text-xs text-[#8f8b80] hidden sm:block ml-1">
            {pendingCount} 待完成
          </div>
        </div>
      </div>

      {/* TOP SINGLE-LINE ULTRA-FAST INPUT BOX */}
      <div className="bg-[#24262c] p-3 rounded border-2 border-[#e9e4d8] shadow-sm space-y-2">
        <form onSubmit={handleQuickAdd} className="flex gap-2 items-center">
          <div className="relative flex-1">
            <input
              ref={quickInputRef}
              type="text"
              value={quickText}
              onChange={e => setQuickText(e.target.value)}
              placeholder="极速录入：课程名 作业内容 @截止时间（例：高数 课后习题P32 @明天）"
              disabled={submitting}
              className="w-full bg-[#181a1f] border border-[#3a3d46] focus:border-[#6b7cff] text-sm text-[#e9e4d8] py-2 pl-3 pr-8 rounded outline-none font-sans placeholder:text-[#63605a]"
            />
            {quickText && (
              <button
                type="button"
                onClick={() => setQuickText('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8f8b80] hover:text-[#e9e4d8] text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || !quickText.trim()}
            className="px-4 py-2 bg-[#e9e4d8] hover:bg-[#6b7cff] text-[#1d1f24] hover:text-white font-bold text-xs sm:text-sm rounded transition-all cursor-pointer shrink-0 disabled:opacity-40 flex items-center gap-1 shadow-sm active:scale-95"
            title="回车或点击立即存入数据库"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">存入中</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-[#ff6b57]" />
                <span>极速录入</span>
              </>
            )}
          </button>
        </form>

        {/* Real-time parse result pill */}
        {quickPreview && (
          <div className="bg-[#1b1e26] border border-[#6b7cff]/40 p-2 rounded text-xs flex flex-wrap items-center gap-x-3 gap-y-1 animate-fade-in font-mono">
            <span className="text-[#6b7cff] flex items-center gap-1 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#4ade80]" />
              实时识别预览:
            </span>
            <span>
              <strong className="text-[#8f8b80]">课程: </strong>
              <span className="text-[#e9e4d8] font-bold">{quickPreview.course}</span>
            </span>
            <span>
              <strong className="text-[#8f8b80]">作业: </strong>
              <span className="text-[#e9e4d8]">{quickPreview.title || '（内容待输入）'}</span>
            </span>
            <span>
              <strong className="text-[#8f8b80]">截止: </strong>
              {quickPreview.due ? (
                <span className="text-[#4ade80] font-bold">
                  {quickPreview.due} {quickPreview.rawDueText ? `(@${quickPreview.rawDueText})` : ''}
                </span>
              ) : (
                <span className="text-[#8f8b80]">无</span>
              )}
            </span>
          </div>
        )}

        {/* Quick shortcut tags: Dates and Courses */}
        <div className="flex items-center justify-between flex-wrap gap-1.5 pt-0.5 text-[11px]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[#8f8b80] font-mono">快捷时间:</span>
            {[
              { label: '@明天 20:00', val: '@明天 20:00' },
              { label: '@明天 22:00', val: '@明天 22:00' },
              { label: '@今晚 22:00', val: '@今晚 22:00' },
              { label: '@周日 23:59', val: '@周日 23:59' },
              { label: '@后天 22:00', val: '@后天 22:00' },
            ].map(t => (
              <button
                key={t.val}
                type="button"
                onClick={() => handleAppendDateTag(t.val)}
                className="px-2 py-0.5 bg-[#1a1c22] hover:bg-[#6b7cff]/20 text-[#8f8b80] hover:text-[#6b7cff] border border-[#33363d] rounded cursor-pointer transition-colors font-mono text-[10.5px]"
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowManualForm(!showManualForm)}
            className="text-[11px] text-[#8f8b80] hover:text-[#e9e4d8] flex items-center gap-0.5 cursor-pointer underline"
          >
            <span>{showManualForm ? '收起完整表单' : '展开多项选单'}</span>
            {showManualForm ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Quick Course pills */}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-[11px]">
          <span className="text-[#8f8b80] font-mono">常用课程:</span>
          {courseNames.slice(0, 5).map(cName => (
            <button
              key={cName}
              type="button"
              onClick={() => handlePickCourseTag(cName)}
              className="px-2 py-0.5 bg-[#1f222a] hover:bg-[#2b303d] text-[#e9e4d8] border border-[#33363d] rounded cursor-pointer transition-colors truncate max-w-[120px]"
            >
              {cName}
            </button>
          ))}
        </div>

        {/* Collapsible Manual Form */}
        {showManualForm && (
          <form
            onSubmit={handleManualAdd}
            className="pt-2.5 mt-2 border-t border-[#33363d] grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end animate-fade-in"
          >
            <div className="md:col-span-3">
              <label className="block text-[9.5px] font-bold tracking-wider text-[#8f8b80] mb-1">
                选择课程
              </label>
              <select
                value={selectedCourse}
                onChange={e => setSelectedCourse(e.target.value)}
                className="w-full bg-[#181a1f] border border-[#33363d] text-xs text-[#e9e4d8] py-1.5 px-2 rounded outline-none cursor-pointer focus:border-[#6b7cff]"
              >
                {courseNames.map(name => (
                  <option key={name} value={name} className="bg-[#1d1f24] text-[#e9e4d8]">
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-4">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[9.5px] font-bold tracking-wider text-[#8f8b80]">
                  截止时间 (精确到小时)
                </label>
                <span className="text-[9px] text-[#6b7cff] font-mono">含钟点</span>
              </div>
              <input
                type="datetime-local"
                value={manualDueDate}
                onChange={e => setManualDueDate(e.target.value)}
                className="w-full bg-[#181a1f] border border-[#33363d] focus:border-[#6b7cff] text-xs text-[#e9e4d8] py-1 px-2 rounded outline-none font-mono"
              />
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                {['18:00', '20:00', '22:00', '23:59'].map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => {
                      const cur = manualDueDate ? new Date(manualDueDate) : new Date();
                      const y = cur.getFullYear();
                      const m = String(cur.getMonth() + 1).padStart(2, '0');
                      const d = String(cur.getDate()).padStart(2, '0');
                      setManualDueDate(`${y}-${m}-${d}T${h}`);
                    }}
                    className="text-[9px] px-1.5 py-0.2 bg-[#20222a] text-[#8ea4ff] hover:bg-[#6b7cff]/20 rounded border border-[#33363d] font-mono cursor-pointer"
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-3">
              <label className="block text-[9.5px] font-bold tracking-wider text-[#8f8b80] mb-1">
                作业内容
              </label>
              <input
                type="text"
                value={manualTitle}
                onChange={e => setManualTitle(e.target.value)}
                placeholder="如：第3章课后习题"
                className="w-full bg-[#181a1f] border border-[#33363d] focus:border-[#6b7cff] text-xs text-[#e9e4d8] py-1.5 px-2 rounded outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={submitting || (!manualTitle.trim() && !manualDueDate)}
                className="w-full py-1.5 px-3 bg-[#6b7cff] hover:bg-[#5868e6] text-white font-bold text-xs sm:text-sm rounded transition-all cursor-pointer shadow flex items-center justify-center gap-1 shrink-0 disabled:opacity-40 active:scale-95"
                title="保存作业至数据库"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>添加</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Helper function to render a single homework item row */}
      {(() => {
        const renderHomeworkRow = (item: Homework, idx: number) => {
          const d = dueDays(item.due);
          const isUrgent = !item.done && d <= 0;
          const isSoon = !item.done && d > 0 && d <= 2;
          const taskTitle = item.title ? `[${item.course}] ${item.title}` : `[${item.course}] 作业`;
          const existingTask = (tasks || []).find(
            t => !t.done && (t.title.trim() === taskTitle.trim() || (item.title && t.title.trim() === item.title.trim()))
          );

           return (
            <div
              key={item.id}
              className={`flex items-start gap-3 py-3 -mx-2 px-2.5 rounded transition-all duration-150 hover:bg-[#20222a]/70 group/row ${
                item.done ? 'opacity-40' : ''
              }`}
            >
              {/* Far left: Large Platform Icon + Index underneath */}
              <div className="shrink-0 flex flex-col items-center gap-1">
                {getPlatformBadge(`${item.course} ${item.title}`)}
                <span className="font-editorial italic text-[11px] text-[#63605a] group-hover/row:text-[#8f8b80] transition-colors select-none leading-none">
                  {pad2(idx + 1)}
                </span>
              </div>

              {/* Checkbox trigger */}
              <div
                className="shrink-0 cursor-pointer select-none touch-manipulation group/check px-1"
                onClick={() => handleToggleHomework(item.id)}
                title={item.done ? '点击标记为未完成' : '点击标记为已完成'}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleHomework(item.id);
                  }}
                  className="p-2 -m-2 flex items-center justify-center cursor-pointer touch-manipulation outline-none focus-visible:ring-2 focus-visible:ring-[#6b7cff] rounded"
                  aria-label={item.done ? '标记为未完成' : '标记为已完成'}
                  title={item.done ? '点击标记为未完成' : '点击标记为已完成'}
                >
                  <span
                    className={`w-5 h-5 rounded-[3px] border-2 flex items-center justify-center transition-all duration-150 active:scale-75 select-none ${
                      item.done
                        ? 'bg-[#e9e4d8] border-[#e9e4d8] text-[#1d1f24] shadow-xs'
                        : 'bg-transparent border-[#e9e4d8]/80 hover:border-[#6b7cff] hover:bg-[#6b7cff]/15 group-hover/check:border-[#6b7cff]'
                    }`}
                  >
                    {item.done ? (
                      <Check className="w-3.5 h-3.5 stroke-[3] text-[#1d1f24]" />
                    ) : null}
                  </span>
                </button>
              </div>

              {/* Content area */}
              <div
                onClick={() => handleToggleHomework(item.id)}
                className="flex-1 min-w-0 cursor-pointer select-none group/content"
                title={item.done ? '点击标记为未完成' : '点击标记为已完成'}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-xs px-1.5 py-0.5 bg-[#2a2d36] text-[#6b7cff] border border-[#6b7cff]/30 rounded group-hover/content:border-[#6b7cff]/60 transition-colors">
                    {item.course}
                  </span>
                  {item.title ? (
                    <span
                      className={`text-sm font-semibold break-words transition-colors ${
                        item.done ? 'line-through text-[#8f8b80]' : 'text-[#e9e4d8] group-hover/content:text-white'
                      }`}
                    >
                      {item.title}
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-3 text-xs text-[#8f8b80] mt-1">
                  {item.due ? (
                    (() => {
                      const detailed = calculateDetailedRemaining(item.due);
                      return (
                        <span
                          className={`flex items-center gap-1 font-mono font-bold flex-wrap ${
                            detailed.isOverdue || detailed.isUrgent ? 'text-[#ff6b57]' : isSoon ? 'text-[#e0a050]' : 'text-[#8f8b80]'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          <span>截止: {item.due}</span>
                          <span className="text-[11px] font-normal opacity-90">({detailed.remainingTime})</span>
                        </span>
                      );
                    })()
                  ) : (
                    <span className="text-[#63605a] font-mono">无具体截止日期</span>
                  )}
                </div>
              </div>

              {/* Right-side action buttons container (stacked vertically) */}
              <div className="shrink-0 flex flex-col items-end gap-2 pt-0.5">
                {/* One-click Add to Tasks / Jump to Pomodoro Focus */}
                {!item.done && (
                  <div>
                    {!existingTask ? (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (onAddTask) {
                            try {
                              await onAddTask(taskTitle);
                              toast(`已顺手加入待办：${taskTitle}`);
                            } catch (err: any) {
                              toast('加入待办失败，请重试');
                            }
                          }
                        }}
                        className="px-2 py-1 border border-[#3a3d46] hover:border-[#6b7cff] text-[#8f8b80] hover:text-[#6b7cff] text-[11px] rounded transition-all cursor-pointer flex items-center gap-1 active:scale-95 group/btn shadow-xs bg-[#1f222c]"
                        title="顺手将此项作业加到个人待办清单，方便规划与专注"
                      >
                        <Plus className="w-3 h-3 group-hover/btn:scale-110 transition-transform" />
                        <span>待办</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onJumpToFocusTask) {
                            onJumpToFocusTask(existingTask.title);
                          }
                        }}
                        className="px-2 py-1 bg-[#6b7cff]/20 hover:bg-[#6b7cff] text-[#6b7cff] hover:text-white border border-[#6b7cff]/40 hover:border-[#6b7cff] text-[11px] font-bold rounded transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-95"
                        title="此作业已在待办中，点击立即切换至专注番茄钟开始计时"
                      >
                        <span>🍅 去专注</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Edit & Delete buttons row */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingHomework(item);
                    }}
                    className="text-[#63605a] hover:text-[#6b7cff] transition-colors p-1 rounded hover:bg-[#252834] cursor-pointer shrink-0"
                    title="编辑作业"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(item.id);
                    }}
                    className="text-[#63605a] hover:text-[#ff6b57] transition-colors p-1 rounded hover:bg-[#252834] cursor-pointer shrink-0"
                    title="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        };

        return (
          <>
            {/* Status & View Mode Control Bar */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#e9e4d8]">
                {/* Completion Status Tabs */}
                <div className="flex text-xs font-semibold">
                  {(['all', 'todo', 'done'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`py-2 px-3 sm:px-4 transition-colors relative cursor-pointer ${
                        filter === f ? 'text-[#e9e4d8] font-bold' : 'text-[#8f8b80]'
                      }`}
                    >
                      {f === 'all' ? '全部状态' : f === 'todo' ? '未完成' : '已完成'}
                      {filter === f && (
                        <span className="absolute left-2 right-2 -bottom-0.5 h-0.5 bg-[#6b7cff]" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Right Toolbar: Due Date Sort + View Mode Switcher */}
                <div className="flex items-center gap-1.5 mb-1 flex-wrap justify-end">
                  {/* Due Date Sort Controls */}
                  <div className="flex items-center gap-0.5 bg-[#181a20] p-1 rounded-lg border border-[#2e313d] text-[11px] font-mono">
                    <span className="text-[#8f8b80] pl-1.5 pr-1 flex items-center gap-1 text-[10.5px]">
                      <Clock className="w-3 h-3 text-[#6b7cff]" />
                      <span className="hidden sm:inline">截止排序:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setDueDateSort('asc')}
                      className={`px-2 py-1 rounded flex items-center gap-1 transition-all cursor-pointer font-bold ${
                        dueDateSort === 'asc'
                          ? 'bg-[#6b7cff] text-white shadow-xs'
                          : 'text-[#8f8b80] hover:text-[#e9e4d8]'
                      }`}
                      title="截止日期升序（紧迫作业优先）"
                    >
                      <ArrowUp className="w-3 h-3" />
                      <span>紧迫优先</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDueDateSort('desc')}
                      className={`px-2 py-1 rounded flex items-center gap-1 transition-all cursor-pointer font-bold ${
                        dueDateSort === 'desc'
                          ? 'bg-[#6b7cff] text-white shadow-xs'
                          : 'text-[#8f8b80] hover:text-[#e9e4d8]'
                      }`}
                      title="截止日期降序（远期作业在前）"
                    >
                      <ArrowDown className="w-3 h-3" />
                      <span>远期在前</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDueDateSort('default')}
                      className={`px-1.5 py-1 rounded flex items-center gap-1 transition-all cursor-pointer font-bold ${
                        dueDateSort === 'default'
                          ? 'bg-[#2a2e3a] text-[#e9e4d8] shadow-xs'
                          : 'text-[#8f8b80] hover:text-[#e9e4d8]'
                      }`}
                      title="默认排序（录入时间排序）"
                    >
                      <ArrowUpDown className="w-3 h-3" />
                      <span className="hidden sm:inline">默认</span>
                    </button>
                  </div>

                  {/* View Mode Switcher (Grouped by Course vs Flat List) */}
                  <div className="flex items-center gap-1 bg-[#181a20] p-1 rounded-lg border border-[#2e313d] text-[11px]">
                    <button
                      type="button"
                      onClick={() => setViewMode('grouped')}
                      className={`px-2.5 py-1 rounded flex items-center gap-1 transition-all cursor-pointer font-bold ${
                        viewMode === 'grouped'
                          ? 'bg-[#6b7cff] text-white shadow-xs'
                          : 'text-[#8f8b80] hover:text-[#e9e4d8]'
                      }`}
                      title="按课程分类折叠展示"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>按课程分组</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('flat')}
                      className={`px-2.5 py-1 rounded flex items-center gap-1 transition-all cursor-pointer font-bold ${
                        viewMode === 'flat'
                          ? 'bg-[#6b7cff] text-white shadow-xs'
                          : 'text-[#8f8b80] hover:text-[#e9e4d8]'
                      }`}
                      title="按时间平铺展示"
                    >
                      <List className="w-3.5 h-3.5" />
                      <span>按时间平铺</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Horizontal Course Category Filter Chips */}
              {availableCourses.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                  <span className="text-[#8f8b80] font-mono text-[11px] shrink-0 flex items-center gap-1">
                    <Filter className="w-3 h-3 text-[#6b7cff]" />
                    <span>课程分类:</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => setSelectedCourseFilter('all')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer shrink-0 ${
                      selectedCourseFilter === 'all'
                        ? 'bg-[#6b7cff]/20 text-[#6b7cff] border-[#6b7cff]'
                        : 'bg-[#1e2028] text-[#8f8b80] border-[#33363d] hover:text-[#e9e4d8]'
                    }`}
                  >
                    全部课程 ({effectiveHomework.length})
                  </button>

                  {availableCourses.map(cName => {
                    const count = courseCounts[cName];
                    const isSelected = selectedCourseFilter === cName;
                    return (
                      <button
                        key={cName}
                        type="button"
                        onClick={() => setSelectedCourseFilter(cName)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-[#6b7cff] text-white border-[#6b7cff] shadow-xs'
                            : 'bg-[#1e2028] text-[#e9e4d8] border-[#33363d] hover:border-[#6b7cff]/50'
                        }`}
                      >
                        <span>{cName}</span>
                        {count && (
                          <span
                            className={`px-1.5 py-0.2 text-[9.5px] rounded-full font-mono ${
                              isSelected
                                ? 'bg-black/20 text-white'
                                : count.pending > 0
                                ? 'bg-[#6b7cff]/20 text-[#6b7cff]'
                                : 'bg-[#2a2d36] text-[#8f8b80]'
                            }`}
                          >
                            {count.pending > 0 ? count.pending : '✓'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Homework List Render */}
            {filteredList.length === 0 ? (
              <div className="py-10 px-4 text-center bg-[#1e222c] border border-dashed border-[#6b7cff]/40 rounded space-y-2">
                <div className="text-sm font-bold text-[#e9e4d8]">☁️ 云端数据库暂无待办作业</div>
                <div className="text-xs text-[#8f8b80]">
                  {filter !== 'all' || selectedCourseFilter !== 'all'
                    ? '当前筛选分类下无匹配作业'
                    : '暂无作业记录。在上方输入框单行快速录入，或点击「智能粘贴导入」粘贴群消息'}
                </div>
                <div className="pt-2 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSmartPasteModal(true)}
                    className="px-3.5 py-1.5 bg-[#6b7cff] hover:bg-[#5868e6] text-white text-xs font-bold rounded cursor-pointer transition-colors flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>智能粘贴群消息</span>
                  </button>
                  {filter === 'all' && (
                    <button
                      type="button"
                      onClick={() => setShowImportModal(true)}
                      className="px-3.5 py-1.5 bg-[#252834] hover:bg-[#303444] border border-[#e9e4d8]/40 text-[#e9e4d8] text-xs font-bold rounded cursor-pointer transition-colors flex items-center gap-1.5"
                    >
                      <DownloadCloud className="w-3.5 h-3.5 text-[#6b7cff]" />
                      <span>同步官方作业清单</span>
                    </button>
                  )}
                </div>
              </div>
            ) : viewMode === 'grouped' ? (
              /* Grouped by Course Collapsible Cards */
              <div className="space-y-3 pt-1">
                {groupedHomework.map(group => {
                  const isCollapsed = Boolean(collapsedCourses[group.courseName]);
                  return (
                    <div
                      key={group.courseName}
                      className="bg-[#1b1d24] border border-[#33363d] hover:border-[#6b7cff]/40 rounded-xl overflow-hidden shadow-sm transition-all"
                    >
                      {/* Card Header */}
                      <div
                        onClick={() => toggleCourseCollapse(group.courseName)}
                        className="w-full px-4 py-3 bg-[#1f222c] hover:bg-[#252834] flex items-center justify-between cursor-pointer select-none transition-colors border-b border-[#2e313d]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-[#6b7cff]/15 border border-[#6b7cff]/30 flex items-center justify-center text-[#6b7cff] shrink-0">
                            <BookOpen className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-sm text-[#e9e4d8] truncate">
                            {group.courseName}
                          </span>
                          <span
                            className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-bold shrink-0 ${
                              group.pendingCount > 0
                                ? 'bg-[#ff6b57]/20 text-[#ff6b57] border border-[#ff6b57]/30'
                                : 'bg-[#4ade80]/15 text-[#4ade80] border border-[#4ade80]/30'
                            }`}
                          >
                            {group.pendingCount > 0 ? `${group.pendingCount} 项待办` : '全部已完成 ✓'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[#8f8b80]">
                          <span className="text-xs font-mono hidden sm:inline">
                            ({group.items.length} 项作业)
                          </span>
                          {isCollapsed ? (
                            <ChevronDown className="w-4 h-4 text-[#8f8b80]" />
                          ) : (
                            <ChevronUp className="w-4 h-4 text-[#6b7cff]" />
                          )}
                        </div>
                      </div>

                      {/* Card Content Items */}
                      {!isCollapsed && (
                        <div className="p-3 divide-y divide-[#2a2d34]">
                          {group.items.map((item, idx) => renderHomeworkRow(item, idx))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Flat List Mode */
              <div className="divide-y divide-[#2a2d34] bg-[#1b1d24] border border-[#33363d] rounded-xl p-3">
                {filteredList.map((item, idx) => renderHomeworkRow(item, idx))}
              </div>
            )}
          </>
        );
      })()}

      {/* Smart Group Notice Paste Modal */}
      {showSmartPasteModal && (
        <SmartHomeworkPasteModal
          isOpen={showSmartPasteModal}
          onClose={() => setShowSmartPasteModal(false)}
          courses={courses}
          existingHomework={homework}
          onBatchImport={handleBatchImport}
          toast={toast}
        />
      )}

      {/* Free Checklist Import Modal */}
      {showImportModal && (
        <HomeworkImportModal
          user={user}
          courses={courses}
          existingHomework={homework}
          onImport={handleBatchImport}
          onClose={() => setShowImportModal(false)}
          toast={toast}
        />
      )}

      {/* Homework Edit Modal */}
      {editingHomework && onUpdate && (
        <HomeworkEditModal
          homework={editingHomework}
          courses={courses}
          onSave={onUpdate}
          onClose={() => setEditingHomework(null)}
          toast={toast}
        />
      )}
    </div>
  );
};
