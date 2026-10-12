import React, { useState, useEffect, useMemo } from 'react';
import { Course, Homework, User } from '../types';
import { api } from '../services/api';
import {
  X,
  Terminal,
  DownloadCloud,
  Check,
  Plus,
  Trash2,
  Sparkles,
  CheckSquare,
  Square,
  RefreshCw,
} from 'lucide-react';

interface ConsoleTemplateItem {
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
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState<'pool' | 'console'>('pool');
  const [templates, setTemplates] = useState<ConsoleTemplateItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      setActiveTab('pool');
    }
  }, [isAdmin]);

  const [consoleInput, setConsoleInput] = useState<string>(
    'Web编程技术 | 完成前端响应式界面制作 | 2026-10-18\n数据库概论 | 第三章 ER 图设计报告与SQL多表查询 | 2026-10-21\n计算机网络 | Wireshark 抓包分析 TCP 三次握手 | 2026-10-26'
  );

  const courseNames = useMemo(() => {
    const list = Array.from(new Set(courses.map(c => c.name))).filter(Boolean);
    return list.length ? list : ['Web编程技术', '数据库概论', 'Java开发技术', '计算机网络', '软件工程导论'];
  }, [courses]);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await api.getConsoleHomeworkTemplates();
      setTemplates(data || []);
      const newSelected = new Set<number>();
      (data || []).forEach(t => {
        const alreadyExists = existingHomework.some(
          h => h.course === t.course && h.title.trim().toLowerCase() === t.title.trim().toLowerCase()
        );
        if (!alreadyExists) {
          newSelected.add(t.id);
        }
      });
      setSelectedIds(newSelected);
    } catch (e: any) {
      toast('获取控制台作业库失败');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === templates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(templates.map(t => t.id)));
    }
  };

  const parsedConsoleItems = useMemo(() => {
    const lines = consoleInput.split('\n');
    const items: { course: string; title: string; due?: string }[] = [];

    lines.forEach(rawLine => {
      let line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) return;

      if (line.startsWith('>')) line = line.slice(1).trim();
      if (line.toLowerCase().startsWith('hw add ')) line = line.slice(7).trim();
      if (line.toLowerCase().startsWith('homework add ')) line = line.slice(13).trim();

      const parts = line.split(/[|｜]/).map(s => s.trim());
      if (parts.length >= 2) {
        const course = parts[0] || courseNames[0] || '其他';
        const title = parts[1];
        let due = parts[2];
        if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) {
          const m = /^(\d{1,2})[-/.](\d{1,2})$/.exec(due);
          if (m) {
            due = `2026-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
          }
        }
        if (title) {
          items.push({ course, title, due: due || undefined });
        }
      } else if (parts.length === 1 && parts[0]) {
        items.push({ course: courseNames[0] || '其他', title: parts[0] });
      }
    });

    return items;
  }, [consoleInput, courseNames]);

  const handleImportFromPool = async () => {
    const toImport = templates
      .filter(t => selectedIds.has(t.id))
      .map(t => ({ course: t.course, title: t.title, due: t.due }));

    if (toImport.length === 0) {
      toast('请至少勾选一项要导入的作业');
      return;
    }

    setImporting(true);
    try {
      await onImport(toImport);
      toast(`已成功从控制台导入 ${toImport.length} 项作业！`);
      onClose();
    } catch (e: any) {
      toast(e.message || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const handleImportFromConsoleInput = async (publishToPool = false) => {
    if (parsedConsoleItems.length === 0) {
      toast('未能解析出有效的作业，请检查控制台输入格式');
      return;
    }

    setImporting(true);
    try {
      await onImport(parsedConsoleItems);

      if (publishToPool) {
        for (const item of parsedConsoleItems) {
          await api.addConsoleHomeworkTemplate(item);
        }
        await loadTemplates();
      }

      toast(`已从控制台批量导入 ${parsedConsoleItems.length} 项作业！`);
      onClose();
    } catch (e: any) {
      toast(e.message || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteTemplate = async (id: number, title: string) => {
    setTemplates(prev => prev.filter(t => Number(t.id) !== Number(id)));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    try {
      await api.deleteConsoleHomeworkTemplate(id);
      toast(`已从控制台作业库删除：${title}`);
      await loadTemplates();
    } catch (e: any) {
      toast('删除失败');
      await loadTemplates();
    }
  };

  const handleClearPool = async () => {
    setTemplates([]);
    setSelectedIds(new Set());
    try {
      await api.clearConsoleHomeworkTemplates();
      toast('已清空控制台作业库');
      await loadTemplates();
    } catch (e: any) {
      toast('清空失败');
      await loadTemplates();
    }
  };

  const handleFillExamples = () => {
    setConsoleInput(
      `Web编程技术 | 完成前端响应式界面制作与CSS3动画 | 2026-10-18\n数据库概论 | 第三章 ER 图设计报告与SQL多表查询 | 2026-10-21\nJava开发技术 | 完成第四章对象与面向对象编程实验报告 | 2026-10-23\n计算机网络 | Wireshark 抓包分析 TCP 三次握手 | 2026-10-26\n软件工程导论 | 可行性研究与系统需求规格说明书 | 2026-10-30`
    );
    toast('已填入控制台格式示例');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-[#1c1e24] border-2 border-[#e9e4d8] text-[#e9e4d8] shadow-2xl rounded-sm flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-[#e9e4d8] bg-[#23262e]">
          <div>
            <div className="flex items-center gap-2">
              {isAdmin ? (
                <Terminal className="w-5 h-5 text-[#4ade80]" />
              ) : (
                <DownloadCloud className="w-5 h-5 text-[#6b7cff]" />
              )}
              <h3 className="font-editorial text-lg sm:text-xl font-bold tracking-wide flex items-center gap-2">
                <span>{isAdmin ? '一键导入作业 · 控制台控制输入' : '一键导入作业'}</span>
                {isAdmin && (
                  <span className="text-[10px] px-1.5 py-0.2 bg-[#6b7cff] text-white font-mono font-bold rounded">
                    ADMIN
                  </span>
                )}
              </h3>
            </div>
            <div className="text-[9.5px] font-mono tracking-[2.5px] text-[#8f8b80] mt-0.5">
              {isAdmin
                ? 'CONSOLE BATCH IMPORT & CLI CONTROL'
                : 'SYNC ASSIGNMENTS FROM CONSOLE · 控制台同步'}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 border border-[#e9e4d8] hover:bg-[#e9e4d8] hover:text-[#1d1f24] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch - Only visible to admin */}
        {isAdmin && (
          <div className="flex border-b border-[#33363f] bg-[#17191f] text-xs font-bold">
            <button
              onClick={() => setActiveTab('pool')}
              className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 transition-colors cursor-pointer relative ${
                activeTab === 'pool'
                  ? 'text-[#e9e4d8] bg-[#22252e]'
                  : 'text-[#8f8b80] hover:text-[#e9e4d8]'
              }`}
            >
              <DownloadCloud className="w-4 h-4 text-[#6b7cff]" />
              <span>控制台作业库 ({templates.length})</span>
              {activeTab === 'pool' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6b7cff]" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('console')}
              className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 transition-colors cursor-pointer relative ${
                activeTab === 'console'
                  ? 'text-[#e9e4d8] bg-[#22252e]'
                  : 'text-[#8f8b80] hover:text-[#e9e4d8]'
              }`}
            >
              <Terminal className="w-4 h-4 text-[#4ade80]" />
              <span>控制台命令行录入 ({parsedConsoleItems.length}) · 管理员</span>
              {activeTab === 'console' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4ade80]" />
              )}
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === 'pool' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[#8f8b80] flex-wrap gap-2">
                <span>勾选需要一键导入到你个人作业列表的项目：</span>
                <div className="flex items-center gap-2.5">
                  {isAdmin && templates.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearPool}
                      className="text-xs text-[#ff6b57] hover:underline flex items-center gap-1 cursor-pointer"
                      title="清空控制台作业库（仅管理员）"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>清空作业库</span>
                    </button>
                  )}
                  <button
                    onClick={handleSelectAll}
                    className="text-[#6b7cff] hover:underline cursor-pointer"
                  >
                    {selectedIds.size === templates.length ? '取消全选' : '全选'}
                  </button>
                  <button
                    onClick={loadTemplates}
                    className="p-1 hover:text-[#e9e4d8] cursor-pointer"
                    title="刷新作业库"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="py-12 text-center text-xs text-[#8f8b80]">
                  正在从控制台加载作业库...
                </div>
              ) : templates.length === 0 ? (
                <div className="py-10 text-center text-xs text-[#8f8b80] border border-dashed border-[#33363f] p-4">
                  {isAdmin
                    ? '控制台作业库当前暂无作业。你可在上方「控制台命令行录入」中录入或导入！'
                    : '控制台作业库当前暂无作业，管理员录入后即可在此一键导入。'}
                </div>
              ) : (
                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {templates.map(item => {
                    const isSelected = selectedIds.has(item.id);
                    const alreadyHas = existingHomework.some(
                      h => h.course === item.course && h.title.trim() === item.title.trim()
                    );

                    return (
                      <div
                        key={item.id}
                        onClick={() => toggleSelect(item.id)}
                        className={`p-3 border rounded transition-all cursor-pointer flex items-start gap-3 select-none ${
                          isSelected
                            ? 'bg-[#252834] border-[#6b7cff]/80 text-[#e9e4d8]'
                            : 'bg-[#181a20] border-[#2e323e] text-[#a8a399] hover:border-[#444858]'
                        }`}
                      >
                        <button
                          type="button"
                          className="mt-0.5 text-[#6b7cff] shrink-0"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-[#6b7cff]" />
                          ) : (
                            <Square className="w-4 h-4 text-[#63605a]" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-bold px-1.5 py-0.2 bg-[#2d3142] border border-[#444962] text-[#8ea4ff] rounded">
                              {item.course}
                            </span>
                            <span className="font-semibold text-sm text-[#e9e4d8] truncate">
                              {item.title}
                            </span>
                            {alreadyHas && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-[#33363f] text-[#8f8b80] rounded">
                                已在清单中
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[#8f8b80] mt-1 font-mono">
                            <span>截止: {item.due || '无截止日期'}</span>
                            <span>·</span>
                            <span>由 {item.creator || '控制台'} 统一配置</span>
                          </div>
                        </div>

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              handleDeleteTemplate(item.id, item.title);
                            }}
                            className="p-1.5 text-[#8f8b80] hover:text-[#ff6b57] hover:bg-[#ff6b57]/15 rounded transition-colors cursor-pointer shrink-0"
                            title="从控制台作业库中删除此项错误作业"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[#8f8b80]">
                <span>控制台指令控制输入（每行一条作业）：</span>
                <button
                  type="button"
                  onClick={handleFillExamples}
                  className="text-xs text-[#4ade80] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>载入示例指令</span>
                </button>
              </div>

              <div className="bg-[#12141a] border-2 border-[#33363f] rounded font-mono text-xs overflow-hidden shadow-inner">
                <div className="bg-[#1a1d24] px-3 py-1.5 border-b border-[#2d313c] flex items-center justify-between text-[#8f8b80] text-[10.5px]">
                  <span className="flex items-center gap-1.5 text-[#4ade80]">
                    <span className="w-2 h-2 rounded-full bg-[#4ade80] inline-block animate-pulse" />
                    BASH / CONSOLE HOMEWORK INPUT
                  </span>
                  <span>格式：课名 | 作业内容 | 截止日期(YYYY-MM-DD)</span>
                </div>
                <textarea
                  value={consoleInput}
                  onChange={e => setConsoleInput(e.target.value)}
                  rows={6}
                  placeholder={`Web编程技术 | 完成实验三 | 2026-10-20\n数据库概论 | SQL查询报告 | 2026-10-22`}
                  className="w-full bg-transparent p-3 text-[#e9e4d8] outline-none font-mono text-xs leading-relaxed resize-none border-none placeholder-[#505462]"
                />
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-[#8f8b80] font-mono flex items-center justify-between">
                  <span>实时解析预览（共 {parsedConsoleItems.length} 项有效作业）：</span>
                </div>

                {parsedConsoleItems.length === 0 ? (
                  <div className="text-xs text-[#63605a] italic py-2">
                    暂无可解析的作业行，请在上方输入
                  </div>
                ) : (
                  <div className="max-h-[140px] overflow-y-auto space-y-1 border border-[#2d313c] p-2 bg-[#14161d] rounded">
                    {parsedConsoleItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs py-1 px-1.5 border-b border-[#22242d] last:border-none"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-[10px] text-[#4ade80] font-mono shrink-0">
                            #{idx + 1}
                          </span>
                          <span className="text-[10.5px] px-1 bg-[#262a3a] text-[#8ea4ff] rounded shrink-0">
                            {item.course}
                          </span>
                          <span className="text-[#e9e4d8] truncate font-medium">
                            {item.title}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-[#8f8b80] shrink-0 ml-2">
                          {item.due || '无截止'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-3 sm:p-4 border-t-2 border-[#e9e4d8] bg-[#23262e] flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs text-[#8f8b80]">
            {activeTab === 'pool'
              ? `已选择 ${selectedIds.size} / ${templates.length} 项`
              : `控制台已就绪 ${parsedConsoleItems.length} 项`}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 border border-[#8f8b80] hover:bg-white/10 text-xs font-semibold cursor-pointer transition-colors"
            >
              取消
            </button>

            {activeTab === 'pool' ? (
              <button
                onClick={handleImportFromPool}
                disabled={importing || selectedIds.size === 0}
                className="px-4 py-1.5 bg-[#6b7cff] hover:bg-[#5b6cee] disabled:opacity-50 text-white font-bold text-xs tracking-wider rounded flex items-center gap-1.5 cursor-pointer shadow-md transition-colors"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                <span>一键导入所选作业 ({selectedIds.size})</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleImportFromConsoleInput(true)}
                  disabled={importing || parsedConsoleItems.length === 0}
                  className="px-3 py-1.5 bg-[#252834] hover:bg-[#323646] text-[#4ade80] border border-[#4ade80]/40 font-bold text-xs tracking-wider rounded flex items-center gap-1 cursor-pointer transition-colors"
                  title="导入到自己清单的同时，同步写入控制台作业库供全班一键导入"
                >
                  <Plus className="w-3 h-3" />
                  <span>导入并发布至控制台库</span>
                </button>

                <button
                  onClick={() => handleImportFromConsoleInput(false)}
                  disabled={importing || parsedConsoleItems.length === 0}
                  className="px-4 py-1.5 bg-[#4ade80] hover:bg-[#3ecc72] text-[#12141a] font-bold text-xs tracking-wider rounded flex items-center gap-1.5 cursor-pointer shadow-md transition-colors"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>执行控制台导入 ({parsedConsoleItems.length})</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
