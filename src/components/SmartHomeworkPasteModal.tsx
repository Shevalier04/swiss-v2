import React, { useState, useEffect, useMemo } from 'react';
import { Course, Homework } from '../types';
import { parseGroupNoticeText, ParsedGroupAssignmentItem } from '../utils/assignmentParser';
import {
  X,
  Sparkles,
  ClipboardCheck,
  Calendar,
  CheckSquare,
  Square,
  Trash2,
  Check,
  Loader2,
  FileText,
  AlertCircle,
} from 'lucide-react';

interface SmartHomeworkPasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: Course[];
  existingHomework?: Homework[];
  onBatchImport: (items: { course: string; title: string; due?: string }[]) => Promise<void>;
  toast: (msg: string) => void;
}

export const SmartHomeworkPasteModal: React.FC<SmartHomeworkPasteModalProps> = ({
  isOpen,
  onClose,
  courses,
  existingHomework = [],
  onBatchImport,
  toast,
}) => {
  const [inputText, setInputText] = useState('');
  const [parsedItems, setParsedItems] = useState<ParsedGroupAssignmentItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const courseNames = useMemo(() => {
    return Array.from(new Set(courses.map(c => c.name))).filter(Boolean);
  }, [courses]);

  // 当输入变化时实时解析
  useEffect(() => {
    if (!inputText.trim()) {
      setParsedItems([]);
      return;
    }
    const results = parseGroupNoticeText(inputText, courseNames);
    setParsedItems(results);
  }, [inputText, courseNames]);

  if (!isOpen) return null;

  const handleFillSample = () => {
    const sample = `今日班级群作业通知：
1. 高数：完成课后习题 P32 第1-5题 @明天
2. 大学英语：Unit 2 核心单词抄写及背诵 @周五
3. 计算机网络：完成 Wireshark 抓包实验报告 截止时间：10月25日
4. Web编程技术：响应式布局大作业开题 @下周一`;
    setInputText(sample);
  };

  const toggleSelect = (id: string) => {
    setParsedItems(prev =>
      prev.map(it => (it.id === id ? { ...it, selected: !it.selected } : it))
    );
  };

  const toggleSelectAll = () => {
    const allSelected = parsedItems.every(it => it.selected);
    setParsedItems(prev => prev.map(it => ({ ...it, selected: !allSelected })));
  };

  const updateItemField = (id: string, field: 'course' | 'title' | 'due', value: string) => {
    setParsedItems(prev =>
      prev.map(it => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  const removeItem = (id: string) => {
    setParsedItems(prev => prev.filter(it => it.id !== id));
  };

  const isItemExisting = (course: string, title: string) => {
    const c = (course || '').trim().toLowerCase();
    const t = (title || '').trim().toLowerCase();
    if (!t) return false;
    return existingHomework.some(
      h => (h.course || '').trim().toLowerCase() === c && (h.title || '').trim().toLowerCase() === t
    );
  };

  const selectedItems = parsedItems.filter(it => it.selected);

  const stats = useMemo(() => {
    let newCount = 0;
    let updatedCount = 0;
    selectedItems.forEach(it => {
      if (isItemExisting(it.course, it.title)) {
        updatedCount++;
      } else {
        newCount++;
      }
    });
    return { newCount, updatedCount };
  }, [selectedItems, existingHomework]);

  const handleSubmit = async () => {
    if (selectedItems.length === 0) {
      toast('请勾选至少一条作业导入');
      return;
    }

    setSubmitting(true);
    try {
      const payload = selectedItems.map(it => ({
        course: it.course.trim() || (courseNames[0] || '常规课程'),
        title: it.title.trim(),
        due: it.due || undefined,
      }));

      await onBatchImport(payload);
      onClose();
      setInputText('');
      setParsedItems([]);
    } catch (e: any) {
      toast(e.message || '批量导入失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-[#1d1f24] border-2 border-[#e9e4d8] text-[#e9e4d8] shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[#e9e4d8] px-4 py-3 bg-[#26282e]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#6b7cff]/20 text-[#6b7cff] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#6b7cff]" />
            </div>
            <div>
              <div className="font-editorial text-base sm:text-lg font-extrabold tracking-wide">
                班级群消息一键批量导入
              </div>
              <div className="text-[10px] font-mono text-[#8f8b80]">
                智能提取 课程名 · 作业内容 · 截止时间 (@明天/@周X)
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#33363d] rounded text-[#8f8b80] hover:text-[#e9e4d8] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Textarea input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-[#8f8b80]">
              <span className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                粘贴微信/QQ群中的作业通知消息：
              </span>
              <button
                type="button"
                onClick={handleFillSample}
                className="text-[#6b7cff] hover:underline cursor-pointer text-xs"
              >
                填入示例通知文本
              </button>
            </div>
            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="直接粘贴群聊文本，如：&#10;1. 高数：完成课后习题P32 1-5题 @明天&#10;2. 大学英语：Unit 2 单词抄写及背诵 @周五&#10;3. 计算机网络：抓包实验报告 截止时间：10月25日"
              rows={4}
              className="w-full bg-[#16181d] border border-[#33363d] focus:border-[#6b7cff] rounded p-2.5 text-xs text-[#e9e4d8] font-mono outline-none resize-y"
            />
          </div>

          {/* Parsed list preview */}
          {parsedItems.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between border-b border-[#33363d] pb-1.5 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-[#e9e4d8]">
                    已智能识别 {parsedItems.length} 条作业
                  </span>
                  <span className="text-[10.5px] px-2 py-0.5 bg-[#6b7cff]/20 text-[#8ea4ff] border border-[#6b7cff]/40 rounded font-mono font-semibold">
                    已选 {selectedItems.length} 条（新增 {stats.newCount} 项，覆盖更新 {stats.updatedCount} 项）
                  </span>
                </div>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-xs text-[#8f8b80] hover:text-[#e9e4d8] cursor-pointer flex items-center gap-1 shrink-0"
                >
                  {selectedItems.length === parsedItems.length ? (
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

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {parsedItems.map((item, idx) => {
                  const existing = isItemExisting(item.course, item.title);
                  return (
                    <div
                      key={item.id}
                      className={`p-2.5 rounded border transition-all ${
                        item.selected
                          ? 'bg-[#22252c] border-[#6b7cff]/50'
                          : 'bg-[#181a1f] border-[#2f323a] opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <button
                          type="button"
                          onClick={() => toggleSelect(item.id)}
                          className="mt-1 cursor-pointer shrink-0 text-[#8f8b80] hover:text-[#e9e4d8]"
                        >
                          {item.selected ? (
                            <CheckSquare className="w-4 h-4 text-[#6b7cff]" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>

                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[10px] text-[#8f8b80] font-mono">作业 #{idx + 1}</span>
                            {existing ? (
                              <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded font-mono font-bold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                覆盖更新
                              </span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded font-mono font-bold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                新增
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                        {/* Course input */}
                        <div className="sm:col-span-4">
                          <label className="block text-[9px] text-[#8f8b80] mb-0.5 font-mono">
                            课程名称
                          </label>
                          <input
                            type="text"
                            value={item.course}
                            onChange={e => updateItemField(item.id, 'course', e.target.value)}
                            placeholder="课程名称"
                            className="w-full bg-[#16181d] border border-[#33363d] focus:border-[#6b7cff] px-2 py-1 rounded text-[#e9e4d8] text-xs outline-none"
                          />
                        </div>

                        {/* Title input */}
                        <div className="sm:col-span-5">
                          <label className="block text-[9px] text-[#8f8b80] mb-0.5 font-mono">
                            作业内容
                          </label>
                          <input
                            type="text"
                            value={item.title}
                            onChange={e => updateItemField(item.id, 'title', e.target.value)}
                            placeholder="作业内容"
                            className="w-full bg-[#16181d] border border-[#33363d] focus:border-[#6b7cff] px-2 py-1 rounded text-[#e9e4d8] text-xs outline-none"
                          />
                        </div>

                        {/* Due date input */}
                        <div className="sm:col-span-3">
                          <label className="block text-[9px] text-[#8f8b80] mb-0.5 font-mono flex items-center justify-between">
                            <span>截止日期</span>
                            {item.due && (
                              <span className="text-emerald-400">已识别</span>
                            )}
                          </label>
                          <input
                            type="date"
                            value={item.due || ''}
                            onChange={e => updateItemField(item.id, 'due', e.target.value)}
                            className="w-full bg-[#16181d] border border-[#33363d] focus:border-[#6b7cff] px-1.5 py-1 rounded text-[#e9e4d8] text-xs outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="mt-1 p-1 text-[#8f8b80] hover:text-[#ff6b57] transition-colors cursor-pointer"
                        title="删除该项"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}

          {inputText.trim() && parsedItems.length === 0 && (
            <div className="py-6 text-center text-xs text-[#8f8b80] flex items-center justify-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>未解析到作业项，请检查格式或点击右上角「填入示例通知文本」参考格式。</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#33363d] px-4 py-3 bg-[#26282e] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-[#33363d] hover:bg-[#3f434c] text-[#e9e4d8] text-xs font-bold rounded cursor-pointer transition-colors"
          >
            取消
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || selectedItems.length === 0}
            className="px-4 py-2 bg-[#6b7cff] hover:bg-[#5868e6] text-white text-xs font-bold rounded flex items-center gap-2 cursor-pointer shadow-md transition-colors disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>正在批量存入云端 D1...</span>
              </>
            ) : (
              <>
                <ClipboardCheck className="w-4 h-4" />
                <span>导入所选作业 ({selectedItems.length} 项)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
