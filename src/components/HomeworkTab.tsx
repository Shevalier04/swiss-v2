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
} from 'lucide-react';
import { HomeworkImportModal } from './HomeworkImportModal';
import { SmartHomeworkPasteModal } from './SmartHomeworkPasteModal';

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
  toast,
}) => {
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('all');

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

    const currentItem = homework.find(h => Number(h.id) === Number(id));
    if (!currentItem) return;
    const currentDone = optimisticToggles[id] !== undefined ? optimisticToggles[id] : currentItem.done;
    const nextDone = !currentDone;

    // 1. Instant local optimistic update (0ms UI feedback)
    setOptimisticToggles(prev => ({ ...prev, [id]: nextDone }));

    // 2. Trigger parent toggle
    onToggle(id).catch(() => {
      // Revert if error
      setOptimisticToggles(prev => {
        const next = { ...prev };
        delete next[id];
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
    return homework.map(h => {
      const override = optimisticToggles[h.id];
      return override !== undefined ? { ...h, done: override } : h;
    });
  }, [homework, optimisticToggles]);

  const filteredList = useMemo(() => {
    return effectiveHomework.filter(h => {
      if (filter === 'todo') return !h.done;
      if (filter === 'done') return h.done;
      return true;
    });
  }, [effectiveHomework, filter]);

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
            className="pt-2.5 mt-2 border-t border-[#33363d] grid grid-cols-1 sm:grid-cols-3 gap-2.5 animate-fade-in"
          >
            <div>
              <label className="block text-[9.5px] font-bold tracking-wider text-[#8f8b80] mb-1">
                选择课程
              </label>
              <select
                value={selectedCourse}
                onChange={e => setSelectedCourse(e.target.value)}
                className="w-full bg-[#181a1f] border border-[#33363d] text-xs text-[#e9e4d8] py-1.5 px-2 rounded outline-none"
              >
                {courseNames.map(name => (
                  <option key={name} value={name} className="bg-[#1d1f24] text-[#e9e4d8]">
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
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

            <div>
              <label className="block text-[9.5px] font-bold tracking-wider text-[#8f8b80] mb-1">
                作业内容
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualTitle}
                  onChange={e => setManualTitle(e.target.value)}
                  placeholder="如：第3章课后习题"
                  className="flex-1 bg-[#181a1f] border border-[#33363d] text-xs text-[#e9e4d8] py-1 px-2 rounded outline-none"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1 bg-[#6b7cff] hover:bg-[#5868e6] text-white font-bold text-xs rounded transition-colors cursor-pointer shrink-0"
                >
                  添加
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b-2 border-[#e9e4d8] text-xs font-semibold">
        {(['all', 'todo', 'done'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`py-2 px-4 transition-colors relative cursor-pointer ${
              filter === f ? 'text-[#e9e4d8] font-bold' : 'text-[#8f8b80]'
            }`}
          >
            {f === 'all' ? '全部' : f === 'todo' ? '未完成' : '已完成'}
            {filter === f && (
              <span className="absolute left-2 right-2 -bottom-0.5 h-0.5 bg-[#6b7cff]" />
            )}
          </button>
        ))}
      </div>

      {/* Homework List */}
      {filteredList.length === 0 ? (
        <div className="py-10 px-4 text-center bg-[#1e222c] border border-dashed border-[#6b7cff]/40 rounded space-y-2">
          <div className="text-sm font-bold text-[#e9e4d8]">☁️ 云端数据库暂无待办作业</div>
          <div className="text-xs text-[#8f8b80]">
            {filter !== 'all' ? '当前筛选下无匹配作业' : '暂无作业记录。在上方输入框单行快速录入，或点击「智能粘贴导入」粘贴群消息'}
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
      ) : (
        <div className="divide-y divide-[#2a2d34]">
          {filteredList.map((item, idx) => {
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
                className={`flex items-start gap-3 py-3 -mx-2 px-2 rounded transition-all duration-150 hover:bg-[#20222a]/50 group/row ${
                  item.done ? 'opacity-40' : ''
                }`}
              >
                {/* Left interactive trigger zone: Index + Enlarged Checkbox */}
                <div
                  className="flex items-center gap-2 shrink-0 pt-0.5 cursor-pointer select-none touch-manipulation group/check"
                  onClick={() => handleToggleHomework(item.id)}
                  title={item.done ? '点击标记为未完成' : '点击标记为已完成'}
                >
                  <span className="font-editorial italic text-xs text-[#63605a] group-hover/check:text-[#8f8b80] w-5 text-right transition-colors select-none">
                    {pad2(idx + 1)}
                  </span>

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

                {/* Content area: Also clickable to toggle completion with ease */}
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

                {/* One-click Add to Tasks / Jump to Pomodoro Focus */}
                {!item.done && (
                  <div className="shrink-0 flex items-center pt-0.5">
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
                        className="px-2 py-0.5 border border-[#3a3d46] hover:border-[#6b7cff] text-[#8f8b80] hover:text-[#6b7cff] text-[11px] rounded transition-all cursor-pointer flex items-center gap-1 active:scale-95 group/btn"
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
                        className="px-2 py-0.5 bg-[#6b7cff]/20 hover:bg-[#6b7cff] text-[#6b7cff] hover:text-white border border-[#6b7cff]/40 hover:border-[#6b7cff] text-[11px] font-bold rounded transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-95"
                        title="此作业已在待办中，点击立即切换至专注番茄钟开始计时"
                      >
                        <span>🍅 去专注</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Delete button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item.id);
                  }}
                  className="text-[#63605a] hover:text-[#ff6b57] transition-colors p-1.5 -m-0.5 cursor-pointer shrink-0"
                  title="删除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

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
    </div>
  );
};
