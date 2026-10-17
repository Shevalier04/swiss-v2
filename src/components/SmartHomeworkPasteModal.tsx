import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  HelpCircle,
  RotateCcw,
} from 'lucide-react';

interface SmartHomeworkPasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: Course[];
  existingHomework?: Homework[];
  onBatchImport: (items: { course: string; title: string; due?: string }[]) => Promise<void>;
  toast: (msg: string) => void;
}

const SAMPLE_PRESETS = [
  {
    name: '标准清单',
    text: `今日班级群作业通知：
1. 高数：完成课后习题 P32 第1-5题 @明天
2. 大学英语：Unit 2 核心单词抄写及背诵 @周五
3. 计算机网络：完成 Wireshark 抓包实验报告 截止时间：10月25日
4. Web编程技术：响应式布局大作业开题 @下周一`,
  },
  {
    name: '微信聊天记录',
    text: `学委-小李 2026/10/15 14:32:05
@所有人 同学们好，各科课代表汇总的作业如下：
[图片]
[文件] 实验三要求.pdf
1. 计网：完成第四章Wireshark实验报告 周五前交学习通
2. 数据库：绘制图书管理系统E-R图 本周日晚22点截止
3. 线代：第45页 习题2、4、7题 明天交
请大家按时提交，逾期不补！
班长 14:35:10
收到请回复1`,
  },
  {
    name: '按科目分块',
    text: `【大学英语】
1. 背诵 Unit 3 核心词汇并打卡
2. 翻译课后短文到作业本 @周五

【高等数学】
1. 课后习题 P58 第1-4题
2. 预习第三章导数与微分 @明天

【计算机网络】
完成PacketTracer路由配置实验报告 截止：10月28日`,
  },
  {
    name: '口语化通知',
    text: `高数老师：同学们，今天的作业是教材第88页第3题和第5题，明天课前课代表收齐送到办公室。
英语课代表：Unit 4 听说训练请在周五晚前在雨课堂提交打卡。
计网助教：实验二报告截止时间是下周三晚上24点前。`,
  },
  {
    name: '界面设计作业',
    text: '界面设计作业 10月21日晚上21:30截止 【表情】',
  },
];

export const SmartHomeworkPasteModal: React.FC<SmartHomeworkPasteModalProps> = ({
  isOpen,
  onClose,
  courses = [],
  existingHomework = [],
  onBatchImport,
  toast,
}) => {
  const [inputText, setInputText] = useState('');
  const [parsedItems, setParsedItems] = useState<ParsedGroupAssignmentItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Extract valid course names safely
  const courseNames = useMemo(() => {
    const list = (courses || [])
      .map(c => c?.name)
      .filter((n): n is string => Boolean(n && typeof n === 'string'));
    const unique = Array.from(new Set(list));
    return unique.length ? unique : ['Web编程技术', '数据库概论', '计算机网络', '软件工程导论', '高等数学'];
  }, [courses]);

  // Real-time parsing when inputText changes
  useEffect(() => {
    if (!inputText.trim()) {
      setParsedItems([]);
      return;
    }
    try {
      const results = parseGroupNoticeText(inputText, courseNames);
      setParsedItems(results);
    } catch (err) {
      console.error('Error parsing notice text:', err);
      setParsedItems([]);
    }
  }, [inputText, courseNames]);

  // Check if item already exists by course and title
  const isItemExisting = useCallback((course: string, title: string) => {
    const c = (course || '').trim().toLowerCase();
    const t = (title || '').trim().toLowerCase();
    if (!t) return false;
    return (existingHomework || []).some(
      h => h && (h.course || '').trim().toLowerCase() === c && (h.title || '').trim().toLowerCase() === t
    );
  }, [existingHomework]);

  // Selected items & statistics computed with hooks at top level
  const selectedItems = useMemo(() => {
    return parsedItems.filter(it => it.selected);
  }, [parsedItems]);

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
  }, [selectedItems, isItemExisting]);

  // Hook-safe conditional return AFTER all hooks
  if (!isOpen) {
    return null;
  }

  const toggleSelect = (id: string) => {
    setParsedItems(prev =>
      prev.map(it => (it.id === id ? { ...it, selected: !it.selected } : it))
    );
  };

  const toggleSelectAll = () => {
    const allSelected = parsedItems.length > 0 && parsedItems.every(it => it.selected);
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

  const handleSubmit = async () => {
    if (selectedItems.length === 0) {
      toast('请勾选至少一条作业导入');
      return;
    }

    setSubmitting(true);
    try {
      const payload = selectedItems.map(it => ({
        course: (it.course || '').trim() || (courseNames[0] || '常规课程'),
        title: (it.title || '').trim(),
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

  const handleModalClose = () => {
    onClose();
    setInputText('');
    setParsedItems([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-editorial-up">
      <div className="w-full max-w-2xl bg-[#1d1f24] border-2 border-[#e9e4d8] text-[#e9e4d8] shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[#e9e4d8] px-4 py-3 bg-[#26282e]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#6b7cff]/20 text-[#6b7cff] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#6b7cff]" />
            </div>
            <div>
              <div className="font-editorial text-base sm:text-lg font-extrabold tracking-wide">
                班级群消息智能识别粘贴
              </div>
              <div className="text-[10px] font-mono text-[#8f8b80]">
                智能提取 课程名 · 作业内容 · 截止时间 (@明天/周五前/10-25)
              </div>
            </div>
          </div>
          <button
            onClick={handleModalClose}
            className="w-8 h-8 border border-[#e9e4d8] hover:bg-[#e9e4d8] hover:text-[#1d1f24] flex items-center justify-center transition-colors cursor-pointer"
            title="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {/* Quick preset chips & Guide Toggle */}
          <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-[#8f8b80]">快速示例：</span>
              {SAMPLE_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setInputText(preset.text)}
                  className="px-2 py-0.5 bg-[#26282e] hover:bg-[#33363d] text-[#e9e4d8] border border-[#3a3d46] rounded text-[11px] font-mono cursor-pointer transition-colors"
                >
                  {preset.name}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowGuide(!showGuide)}
                className="text-[#6b7cff] hover:underline cursor-pointer text-xs flex items-center gap-1"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>{showGuide ? '收起规则' : '识别规则'}</span>
              </button>

              {inputText && (
                <button
                  type="button"
                  onClick={() => setInputText('')}
                  className="text-[#8f8b80] hover:text-[#ff6b57] cursor-pointer text-xs flex items-center gap-0.5"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>清空</span>
                </button>
              )}
            </div>
          </div>

          {/* Collapsible Format Guide */}
          {showGuide && (
            <div className="p-3 bg-[#16181d] border border-[#33363d] rounded text-xs space-y-1.5 font-mono text-[#8f8b80] animate-editorial-up">
              <div className="font-bold text-[#e9e4d8] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#6b7cff]" />
                智能识别算法支持的群消息格式说明：
              </div>
              <ul className="list-disc list-inside space-y-1 pl-1 text-[11px]">
                <li>
                  <strong className="text-[#e9e4d8]">群聊杂质与表情包过滤</strong>：自动去除微信/QQ昵称、时间戳（如
                  <code className="text-[#8ea4ff]"> 学委 14:30</code>）、<code className="text-[#8ea4ff]">@所有人</code>、
                  <code className="text-[#8ea4ff]">[图片]</code>、<code className="text-[#8ea4ff]">【表情】</code>、
                  <code className="text-[#8ea4ff]">[抱拳]</code> 等，绝不误填为作业内容。
                </li>
                <li>
                  <strong className="text-[#e9e4d8]">课程简称自动关联</strong>：课表有《高等数学》，群消息发
                  <code className="text-[#8ea4ff]"> 高数</code>、<code className="text-[#8ea4ff]">计网</code>、
                  <code className="text-[#8ea4ff]">线代</code>、<code className="text-[#8ea4ff]">数据库</code>等，会自动精准映射回课表标准课程名。
                </li>
                <li>
                  <strong className="text-[#e9e4d8]">科目分块继承</strong>：若群消息按科目分组（如
                  <code className="text-[#8ea4ff]">【大学英语】</code>下一行多条作业），子任务自动继承所属科目。
                </li>
                <li>
                  <strong className="text-[#e9e4d8]">自然语言截止时间</strong>：支持
                  <code className="text-[#8ea4ff]"> @明天</code>、<code className="text-[#8ea4ff]">@周五</code>、
                  <code className="text-[#8ea4ff]">10月25日截止</code>、<code className="text-[#8ea4ff]">周日晚前交</code>、
                  <code className="text-[#8ea4ff]">今晚24点</code>并自动转换为标准 YYYY-MM-DD。
                </li>
              </ul>
            </div>
          )}

          {/* Textarea input */}
          <div className="space-y-1">
            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="直接粘贴微信/QQ群中的作业通知消息文本...（支持聊天记录转发文本、大纲排版或普通口语通知）"
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

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
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
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-[#8f8b80] font-mono">#{idx + 1}</span>
                              {item.matchedFromCourseTable && (
                                <span className="text-[9px] px-1 py-0.2 bg-[#6b7cff]/15 text-[#8ea4ff] border border-[#6b7cff]/30 rounded font-mono">
                                  课表匹配
                                </span>
                              )}
                            </div>
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
                                value={item.course || ''}
                                onChange={e => updateItemField(item.id, 'course', e.target.value)}
                                placeholder="课程名称"
                                className="w-full bg-[#16181d] border border-[#33363d] focus:border-[#6b7cff] px-2 py-1 rounded text-[#e9e4d8] text-xs outline-none"
                              />
                            </div>

                            {/* Title input */}
                            <div className="sm:col-span-5">
                              <label className="block text-[9px] text-[#8f8b80] mb-0.5 font-mono flex items-center justify-between">
                                <span>作业内容</span>
                                {!item.title && (
                                  <span className="text-[#8f8b80]/70">（无需填）</span>
                                )}
                              </label>
                              <input
                                type="text"
                                value={item.title || ''}
                                onChange={e => updateItemField(item.id, 'title', e.target.value)}
                                placeholder="未识别到具体内容（无需填或可补充）"
                                className="w-full bg-[#16181d] border border-[#33363d] focus:border-[#6b7cff] px-2 py-1 rounded text-[#e9e4d8] text-xs outline-none placeholder:text-[#8f8b80]/40"
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
                                type="text"
                                value={item.due || ''}
                                onChange={e => updateItemField(item.id, 'due', e.target.value)}
                                placeholder="如 2026-10-15 22:00"
                                className="w-full bg-[#16181d] border border-[#33363d] focus:border-[#6b7cff] px-1.5 py-1 rounded text-[#e9e4d8] text-xs outline-none font-mono"
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
            <div className="py-6 text-center text-xs text-[#8f8b80] flex flex-col items-center justify-center gap-1.5">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <AlertCircle className="w-4 h-4" />
                <span>未能自动解析出作业条目</span>
              </div>
              <p className="text-[11px] text-[#8f8b80] max-w-sm">
                请确认文本包含课程名与作业内容（如：高数 习题P32 @明天），或点击上方「识别规则」了解格式规范。
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#33363d] px-4 py-3 bg-[#26282e] flex items-center justify-between">
          <button
            type="button"
            onClick={handleModalClose}
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
