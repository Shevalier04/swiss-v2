import React, { useState, useEffect, useMemo } from 'react';
import { Course, Homework, User } from '../types';
import { api } from '../services/api';
import { SAMPLE_ASSIGNMENTS } from '../utils/sampleData';
import {
  X,
  CheckSquare,
  Square,
  DownloadCloud,
  Check,
  Search,
  RotateCcw,
  Calendar,
  AlertCircle,
  Loader2,
  BookOpen,
} from 'lucide-react';

export interface HomeworkTemplateItem {
  id: number;
  course: string;
  title: string;
  due?: string;
  creator?: string;
}

interface HomeworkImportModalProps {
  user?: User | null;
  courses: Course[];
  existingHomework: Homework[];
  onImport: (items: { course: string; title: string; due?: string }[]) => Promise<void>;
  onClose: () => void;
  toast: (msg: string) => void;
}

export const HomeworkImportModal: React.FC<HomeworkImportModalProps> = ({
  user,
  courses,
  existingHomework,
  onImport,
  onClose,
  toast,
}) => {
  const [templates, setTemplates] = useState<HomeworkTemplateItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all');

  const courseNames = useMemo(() => {
    const list = Array.from(new Set(courses.map(c => c.name))).filter(Boolean);
    return list.length ? list : ['Web编程技术', '数据库概论', 'Java开发技术', '计算机网络', '软件工程导论'];
  }, [courses]);

  // Normalized matching helper: course.trim().toLowerCase() and title.trim().toLowerCase()
  const isItemExisting = (course: string, title: string) => {
    const c = (course || '').trim().toLowerCase();
    const t = (title || '').trim().toLowerCase();
    if (!t) return false;
    return existingHomework.some(
      h => (h.course || '').trim().toLowerCase() === c && (h.title || '').trim().toLowerCase() === t
    );
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await api.getConsoleHomeworkTemplates();
      let list: HomeworkTemplateItem[] = Array.isArray(data) ? [...data] : [];

      // Combine with sample presets if empty
      if (list.length === 0) {
        list = SAMPLE_ASSIGNMENTS.map((s, idx) => ({
          id: -(idx + 1),
          course: s.course,
          title: s.title,
          due: s.due,
          creator: '官方预设',
        }));
      }

      setTemplates(list);
      // Select all by default for user convenience
      setSelectedIds(new Set(list.map(t => t.id)));
    } catch (e: any) {
      toast('获取官方作业池失败，已载入内置标准作业');
      const sampleItems = SAMPLE_ASSIGNMENTS.map((s, idx) => ({
        id: -(idx + 1),
        course: s.course,
        title: s.title,
        due: s.due,
        creator: '官方预设',
      }));
      setTemplates(sampleItems);
      setSelectedIds(new Set(sampleItems.map(t => t.id)));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPresets = () => {
    loadTemplates();
    toast('已重新从服务器同步官方作业池');
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredTemplates = useMemo(() => {
    return templates.filter(item => {
      if (selectedCourseFilter !== 'all' && item.course !== selectedCourseFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return (
        item.course.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        (item.due && item.due.toLowerCase().includes(q))
      );
    });
  }, [templates, selectedCourseFilter, searchQuery]);

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredTemplates.map(t => t.id);
    const allFilteredSelected = filteredIds.every(id => selectedIds.has(id));

    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredIds.forEach(id => next.delete(id));
      } else {
        filteredIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const stats = useMemo(() => {
    let newCount = 0;
    let updatedCount = 0;
    templates.forEach(t => {
      if (selectedIds.has(t.id)) {
        if (isItemExisting(t.course, t.title)) {
          updatedCount++;
        } else {
          newCount++;
        }
      }
    });
    return { newCount, updatedCount, totalSelected: selectedIds.size };
  }, [templates, selectedIds, existingHomework]);

  const handleImport = async () => {
    const toImport = templates
      .filter(t => selectedIds.has(t.id))
      .map(t => ({ course: t.course, title: t.title, due: t.due }));

    if (toImport.length === 0) {
      toast('请勾选至少一项要导入的作业');
      return;
    }

    setImporting(true);
    try {
      await onImport(toImport);
      onClose();
    } catch (e: any) {
      toast(e.message || '导入作业失败');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-2xl bg-[#1d1f24] border-2 border-[#e9e4d8] text-[#e9e4d8] shadow-2xl rounded-xs flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-[#e9e4d8] bg-[#24262c]">
          <div>
            <div className="flex items-center gap-2">
              <DownloadCloud className="w-5 h-5 text-[#6b7cff]" />
              <h3 className="font-editorial text-lg sm:text-xl font-bold tracking-wide">
                官方作业清单同步
              </h3>
            </div>
            <div className="text-[9.5px] font-mono tracking-[2.5px] text-[#8f8b80] mt-0.5">
              OFFICIAL ASSIGNMENT POOL · 自由勾选 · 智能覆盖去重
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 border border-[#e9e4d8] hover:bg-[#e9e4d8] hover:text-[#1d1f24] flex items-center justify-center transition-colors cursor-pointer"
            title="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-3 bg-[#17191f] border-b border-[#33363f] space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#8f8b80] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜索课程名称或作业标题..."
                className="w-full bg-[#101216] border border-[#33363d] focus:border-[#6b7cff] rounded py-1.5 pl-8 pr-3 text-xs text-[#e9e4d8] outline-none placeholder:text-[#63605a]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8f8b80] hover:text-[#e9e4d8] text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleResetPresets}
              className="px-2.5 py-1.5 bg-[#252834] hover:bg-[#303444] text-[#8f8b80] hover:text-[#e9e4d8] border border-[#3a3e50] text-xs rounded flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              title="重新从服务器拉取最新官方作业池"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">刷新作业池</span>
            </button>
          </div>

          {/* Course filter tags & Select all toggle */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 text-xs">
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
              <button
                type="button"
                onClick={() => setSelectedCourseFilter('all')}
                className={`px-2 py-0.5 rounded text-[11px] cursor-pointer transition-colors shrink-0 ${
                  selectedCourseFilter === 'all'
                    ? 'bg-[#e9e4d8] text-[#1d1f24] font-bold'
                    : 'bg-[#22252c] text-[#8f8b80] hover:text-[#e9e4d8]'
                }`}
              >
                全部课程
              </button>
              {courseNames.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedCourseFilter(c)}
                  className={`px-2 py-0.5 rounded text-[11px] cursor-pointer transition-colors shrink-0 ${
                    selectedCourseFilter === c
                      ? 'bg-[#6b7cff] text-white font-bold'
                      : 'bg-[#22252c] text-[#8f8b80] hover:text-[#e9e4d8]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleSelectAllFiltered}
              className="text-xs text-[#8f8b80] hover:text-[#e9e4d8] cursor-pointer flex items-center gap-1 shrink-0 font-medium select-none"
            >
              {filteredTemplates.length > 0 &&
              filteredTemplates.every(t => selectedIds.has(t.id)) ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-[#6b7cff]" />
                  <span>取消全选</span>
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5" />
                  <span>全选</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Assignment Checklist Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-xs text-[#8f8b80] space-y-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#6b7cff]" />
              <span>正在获取官方作业列表...</span>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#8f8b80] space-y-2">
              <AlertCircle className="w-5 h-5 text-[#8f8b80] mx-auto opacity-50" />
              <div>未找到匹配的官方作业项</div>
              <button
                type="button"
                onClick={handleResetPresets}
                className="text-[#6b7cff] hover:underline cursor-pointer"
              >
                点击重新从官方作业池加载
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTemplates.map(item => {
                const isSelected = selectedIds.has(item.id);
                const existing = isItemExisting(item.course, item.title);

                return (
                  <div
                    key={item.id}
                    onClick={() => toggleSelect(item.id)}
                    className={`p-3 rounded border transition-all cursor-pointer flex items-start gap-3 select-none ${
                      isSelected
                        ? 'bg-[#22252c] border-[#6b7cff]/60 shadow-xs'
                        : 'bg-[#181a1f] border-[#2f323a] opacity-60 hover:opacity-85'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        toggleSelect(item.id);
                      }}
                      className="mt-0.5 cursor-pointer shrink-0 text-[#8f8b80] hover:text-[#e9e4d8]"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-[#6b7cff]" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[11px] font-bold px-1.5 py-0.5 bg-[#2c2f38] text-[#8ea4ff] border border-[#444a5a] rounded">
                          {item.course}
                        </span>

                        {existing ? (
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/15 text-amber-300 border border-amber-500/40 rounded font-mono font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            已存在 · 勾选将覆盖更新
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-700/40 text-slate-300 border border-slate-600/50 rounded font-mono font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            未导入
                          </span>
                        )}

                        {item.due && (
                          <span className="text-[10px] font-mono text-[#8f8b80] flex items-center gap-1 ml-auto">
                            <Calendar className="w-3 h-3 text-[#6b7cff]" />
                            <span>截止: {item.due}</span>
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-semibold text-[#e9e4d8] break-words">
                        {item.title}
                      </div>

                      {item.creator && (
                        <div className="text-[10px] font-mono text-[#63605a] mt-1">
                          发布者: {item.creator}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Summary & Action Buttons */}
        <div className="border-t-2 border-[#e9e4d8] p-3 sm:p-4 bg-[#24262c] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-[#8f8b80] flex items-center gap-2 flex-wrap">
            <span>
              已选 <strong className="text-[#e9e4d8]">{stats.totalSelected}</strong> 项
            </span>
            <span>·</span>
            <span>
              新增 <strong className="text-emerald-400">{stats.newCount}</strong>
            </span>
            <span>·</span>
            <span>
              覆盖更新 <strong className="text-amber-400">{stats.updatedCount}</strong>
            </span>
            <span className="text-[11px] text-[#63605a] hidden sm:inline">
              （更新将保留您已完成的打勾状态）
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-1.5 border border-[#444] hover:bg-[#333] text-[#e9e4d8] text-xs rounded cursor-pointer transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              disabled={importing || stats.totalSelected === 0}
              onClick={handleImport}
              className="flex-1 sm:flex-initial px-5 py-1.5 bg-[#6b7cff] hover:bg-[#5868e6] disabled:opacity-40 text-white font-bold text-xs rounded transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
            >
              {importing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>正在同步导入...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>导入选中作业 ({stats.totalSelected})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
