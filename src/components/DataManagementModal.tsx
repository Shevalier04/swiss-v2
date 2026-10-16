import React, { useState } from 'react';
import { Course, Homework, TaskItem } from '../types';
import { api } from '../services/api';
import { SAMPLE_COURSES, SAMPLE_TASKS } from '../utils/sampleData';
import {
  X,
  Database,
  Cloud,
  Download,
  Upload,
  Trash2,
  Sparkles,
  FileText,
  Code,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from 'lucide-react';

interface DataManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: Course[];
  homework: Homework[];
  tasks: TaskItem[];
  onRefresh: () => Promise<void>;
  toast: (msg: string) => void;
}

export const DataManagementModal: React.FC<DataManagementModalProps> = ({
  isOpen,
  onClose,
  courses,
  homework,
  tasks,
  onRefresh,
  toast,
}) => {
  const [activeTab, setActiveTab] = useState<'preset' | 'batch' | 'export' | 'clear'>('preset');
  const [loading, setLoading] = useState(false);
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');

  // Batch paste state
  const [batchTarget, setBatchTarget] = useState<'all' | 'courses' | 'assignments' | 'tasks'>('all');
  const [batchFormat, setBatchFormat] = useState<'json' | 'text'>('json');
  const [rawText, setRawText] = useState('');

  if (!isOpen) return null;

  // 1. Preset imports
  const handleImportPresetCourses = async () => {
    setLoading(true);
    try {
      await api.batchAddCourses(SAMPLE_COURSES, importMode === 'replace');
      await onRefresh();
      toast(`已成功导入 ${SAMPLE_COURSES.length} 门示例课程到云端 D1`);
    } catch (e: any) {
      toast(e.message || '导入课程失败');
    } finally {
      setLoading(false);
    }
  };

  const handleImportPresetHomework = async () => {
    setLoading(true);
    try {
      const pool = await api.getConsoleHomeworkTemplates();
      if (!pool || pool.length === 0) {
        toast('官方作业池当前暂无作业，请先在管理终端发布或同步');
        return;
      }
      await api.batchAddHomework(pool, importMode === 'replace');
      await onRefresh();
      toast(`已成功从官方作业池导入 ${pool.length} 项作业到当前账号`);
    } catch (e: any) {
      toast(e.message || '导入作业失败');
    } finally {
      setLoading(false);
    }
  };

  const handleImportPresetTasks = async () => {
    setLoading(true);
    try {
      await api.batchAddTasks(SAMPLE_TASKS, importMode === 'replace');
      await onRefresh();
      toast(`已成功导入 ${SAMPLE_TASKS.length} 项示例任务到云端 D1`);
    } catch (e: any) {
      toast(e.message || '导入任务失败');
    } finally {
      setLoading(false);
    }
  };

  const handleImportAllPresets = async () => {
    setLoading(true);
    try {
      const pool = await api.getConsoleHomeworkTemplates();
      const calls: Promise<any>[] = [
        api.batchAddCourses(SAMPLE_COURSES, importMode === 'replace'),
        api.batchAddTasks(SAMPLE_TASKS, importMode === 'replace'),
      ];
      if (pool && pool.length > 0) {
        calls.push(api.batchAddHomework(pool, importMode === 'replace'));
      }
      await Promise.all(calls);
      await onRefresh();
      toast(`已一键填充课表与任务${pool?.length ? `及 ${pool.length} 项官方作业` : ''}`);
    } catch (e: any) {
      toast(e.message || '批量填充失败');
    } finally {
      setLoading(false);
    }
  };

  // 2. Batch Text / JSON import
  const handleFillTemplateJson = () => {
    const template = {
      courses: [
        {
          name: "Web编程技术",
          teacher: "葛江玲",
          room: "博学1-101",
          day: 0,
          s: 1,
          e: 2,
          weeks: "2-14周",
          color: "#4f63e8"
        }
      ],
      assignments: [
        {
          course: "Web编程技术",
          title: "期中大作业项目提交",
          due: "2026-10-25"
        }
      ],
      tasks: [
        {
          title: "背诵英语单词 50 个"
        }
      ]
    };
    setRawText(JSON.stringify(template, null, 2));
  };

  const handleParseAndImport = async () => {
    if (!rawText.trim()) {
      toast('请输入或粘贴导入内容');
      return;
    }

    setLoading(true);
    try {
      if (batchFormat === 'json') {
        const parsed = JSON.parse(rawText.trim());

        if (Array.isArray(parsed)) {
          // If array, use selected target
          if (batchTarget === 'courses') {
            await api.batchAddCourses(parsed, importMode === 'replace');
            toast(`已导入 ${parsed.length} 门课程`);
          } else if (batchTarget === 'assignments') {
            await api.batchAddHomework(parsed, importMode === 'replace');
            toast(`已导入 ${parsed.length} 项作业`);
          } else if (batchTarget === 'tasks') {
            await api.batchAddTasks(parsed, importMode === 'replace');
            toast(`已导入 ${parsed.length} 项任务`);
          } else {
            // Check first item keys
            const first = parsed[0] || {};
            if (first.day !== undefined || first.weekday !== undefined || first.s !== undefined) {
              await api.batchAddCourses(parsed, importMode === 'replace');
              toast(`智能识别：已导入 ${parsed.length} 门课程`);
            } else if (first.course || first.course_name) {
              await api.batchAddHomework(parsed, importMode === 'replace');
              toast(`智能识别：已导入 ${parsed.length} 项作业`);
            } else {
              await api.batchAddTasks(parsed, importMode === 'replace');
              toast(`智能识别：已导入 ${parsed.length} 项任务`);
            }
          }
        } else if (typeof parsed === 'object' && parsed !== null) {
          // Multi-section JSON
          let count = 0;
          if (Array.isArray(parsed.courses)) {
            await api.batchAddCourses(parsed.courses, importMode === 'replace');
            count += parsed.courses.length;
          }
          if (Array.isArray(parsed.assignments) || Array.isArray(parsed.homework)) {
            const hwList = parsed.assignments || parsed.homework;
            await api.batchAddHomework(hwList, importMode === 'replace');
            count += hwList.length;
          }
          if (Array.isArray(parsed.tasks)) {
            await api.batchAddTasks(parsed.tasks, importMode === 'replace');
            count += parsed.tasks.length;
          }
          toast(`导入成功！共处理 ${count} 项数据`);
        }
      } else {
        // Plain text parsing line-by-line
        const lines = rawText
          .split('\n')
          .map(l => l.trim())
          .filter(Boolean);

        if (batchTarget === 'tasks') {
          const taskItems = lines.map(line => ({ title: line }));
          await api.batchAddTasks(taskItems, importMode === 'replace');
          toast(`已导入 ${taskItems.length} 项任务`);
        } else if (batchTarget === 'assignments') {
          const hwItems = lines.map(line => {
            const parts = line.split(/[,，\t]/).map(p => p.trim());
            return {
              course: parts[0] || '常规课程',
              title: parts[1] || parts[0] || '待办作业',
              due: parts[2] || undefined,
            };
          });
          await api.batchAddHomework(hwItems, importMode === 'replace');
          toast(`已导入 ${hwItems.length} 项作业`);
        } else {
          // Courses simple line format: 名称, 教师, 教室, 星期(1-7), 节次(1-2), 周次
          const courseItems = lines.map((line, idx) => {
            const parts = line.split(/[,，\t]/).map(p => p.trim());
            const dayNum = Math.max(0, Math.min(6, (Number(parts[3] || 1) - 1 + 7) % 7));
            const slotStr = parts[4] || '1-2';
            const [s, e] = slotStr.includes('-') ? slotStr.split('-').map(Number) : [Number(slotStr) || 1, Number(slotStr) || 2];
            return {
              name: parts[0] || `课程 ${idx + 1}`,
              teacher: parts[1] || '',
              room: parts[2] || '',
              day: dayNum,
              s: s || 1,
              e: e || s || 2,
              weeks: parts[5] || '1-18周',
              color: '#4f63e8',
            };
          });
          await api.batchAddCourses(courseItems, importMode === 'replace');
          toast(`已导入 ${courseItems.length} 门课程`);
        }
      }

      setRawText('');
      await onRefresh();
    } catch (e: any) {
      toast(`解析失败: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 3. Export
  const handleExportJson = () => {
    const backup = {
      appName: '掌上课表 Swiss Editorial',
      version: '4.2',
      exportedAt: new Date().toISOString(),
      summary: {
        courseCount: courses.length,
        homeworkCount: homework.length,
        taskCount: tasks.length,
      },
      courses,
      assignments: homework,
      tasks,
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `课表云端数据备份-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    toast('已生成并下载 JSON 完整备份文件');
  };

  // 4. Clear
  const handleClearTarget = async (target: 'courses' | 'assignments' | 'tasks' | 'all') => {
    const targetName =
      target === 'courses' ? '课程表' : target === 'assignments' ? '作业' : target === 'tasks' ? '待办任务' : '全部云端数据';
    if (!window.confirm(`确定要清空云端数据库中的【${targetName}】吗？此操作不可逆！`)) {
      return;
    }

    setLoading(true);
    try {
      if (target === 'courses' || target === 'all') {
        await api.clearAllCourses();
      }
      if (target === 'assignments' || target === 'all') {
        await api.clearAllHomework();
      }
      if (target === 'tasks' || target === 'all') {
        await api.clearAllTasks();
      }
      await onRefresh();
      toast(`已成功清空${targetName}`);
    } catch (e: any) {
      toast(e.message || '清空失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl bg-[#1d1f24] border-2 border-[#e9e4d8] text-[#e9e4d8] shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[#e9e4d8] px-4 py-3 bg-[#26282e]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#6b7cff]/20 text-[#6b7cff] flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="font-editorial text-lg font-extrabold tracking-wide flex items-center gap-2">
                <span>云端数据管理中心</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-[#6b7cff] text-white font-mono font-bold rounded">
                  仅终端管理员
                </span>
              </div>
              <div className="text-[10px] font-mono text-[#8f8b80] flex items-center gap-1.5">
                <Cloud className="w-3 h-3 text-[#4ade80]" />
                <span>CLOUDFLARE D1 (swiss-db) · 仅终端管理员可操作</span>
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

        {/* Tab switcher */}
        <div className="grid grid-cols-4 border-b border-[#33363d] text-xs font-mono font-bold bg-[#17191d]">
          {[
            { id: 'preset', label: '预设模板', icon: Sparkles },
            { id: 'batch', label: '批量导入', icon: Upload },
            { id: 'export', label: '备份导出', icon: Download },
            { id: 'clear', label: '清空重置', icon: Trash2 },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`py-2.5 flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-b-2 ${
                  isActive
                    ? 'border-[#6b7cff] text-[#e9e4d8] bg-[#24262c]'
                    : 'border-transparent text-[#8f8b80] hover:text-[#e9e4d8]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#6b7cff]' : ''}`} />
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.label.slice(0, 2)}</span>
              </button>
            );
          })}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Global mode toggle (for preset and batch) */}
          {(activeTab === 'preset' || activeTab === 'batch') && (
            <div className="flex items-center justify-between bg-[#24262c] p-2.5 rounded border border-[#33363d] text-xs">
              <span className="text-[#8f8b80] font-mono">导入模式：</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setImportMode('replace')}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                    importMode === 'replace'
                      ? 'bg-[#6b7cff] text-white shadow-sm'
                      : 'bg-[#1a1c20] text-[#8f8b80] hover:text-[#e9e4d8]'
                  }`}
                >
                  覆盖清空原数据
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('append')}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                    importMode === 'append'
                      ? 'bg-[#6b7cff] text-white shadow-sm'
                      : 'bg-[#1a1c20] text-[#8f8b80] hover:text-[#e9e4d8]'
                  }`}
                >
                  追加保留原数据
                </button>
              </div>
            </div>
          )}

          {/* TAB 1: PRESET */}
          {activeTab === 'preset' && (
            <div className="space-y-3">
              <div className="text-xs text-[#8f8b80]">
                内置大学标准学期课表、作业与备考任务模板，一键点击直接异步持久化存储至 Cloudflare D1 边缘数据库：
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  onClick={handleImportPresetCourses}
                  disabled={loading}
                  className="p-3.5 bg-[#24262c] hover:bg-[#2b2e36] border border-[#33363d] hover:border-[#6b7cff] rounded text-left transition-all group cursor-pointer disabled:opacity-50"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm text-[#e9e4d8] group-hover:text-[#6b7cff]">
                      导入示例课程表
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#6b7cff]/20 text-[#6b7cff] font-mono">
                      25 门课
                    </span>
                  </div>
                  <div className="text-xs text-[#8f8b80] line-clamp-2">
                    包含 Web编程、Java、数据库、计网等标准课程及周次节次
                  </div>
                </button>

                <button
                  onClick={handleImportPresetHomework}
                  disabled={loading}
                  className="p-3.5 bg-[#24262c] hover:bg-[#2b2e36] border border-[#33363d] hover:border-[#6b7cff] rounded text-left transition-all group cursor-pointer disabled:opacity-50"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm text-[#e9e4d8] group-hover:text-[#6b7cff]">
                      从 D1 官方作业池同步
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#ff6b57]/20 text-[#ff6b57] font-mono">
                      全员作业
                    </span>
                  </div>
                  <div className="text-xs text-[#8f8b80] line-clamp-2">
                    从 Cloudflare D1 homework_pool 官方作业库拉取全班最新作业
                  </div>
                </button>

                <button
                  onClick={handleImportPresetTasks}
                  disabled={loading}
                  className="p-3.5 bg-[#24262c] hover:bg-[#2b2e36] border border-[#33363d] hover:border-[#6b7cff] rounded text-left transition-all group cursor-pointer disabled:opacity-50"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm text-[#e9e4d8] group-hover:text-[#6b7cff]">
                      导入示例待办任务
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#4ade80]/20 text-[#4ade80] font-mono">
                      4 条待办
                    </span>
                  </div>
                  <div className="text-xs text-[#8f8b80] line-clamp-2">
                    复习计网网络层、六级背词、LeetCode 算法等日常计划
                  </div>
                </button>

                <button
                  onClick={handleImportAllPresets}
                  disabled={loading}
                  className="p-3.5 bg-[#6b7cff]/15 hover:bg-[#6b7cff]/25 border border-[#6b7cff] rounded text-left transition-all group cursor-pointer disabled:opacity-50"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm text-[#6b7cff]">
                      ⚡ 一键全量填充全部
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#6b7cff] text-white font-mono font-bold">
                      推荐
                    </span>
                  </div>
                  <div className="text-xs text-[#8f8b80]">
                    同时导入全套课表 + 作业 + 任务，新设备一秒就绪
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: BATCH IMPORT */}
          {activeTab === 'batch' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[#8f8b80]">格式:</span>
                  <button
                    onClick={() => setBatchFormat('json')}
                    className={`px-2 py-0.5 rounded text-xs ${
                      batchFormat === 'json' ? 'bg-[#6b7cff] text-white' : 'bg-[#24262c] text-[#8f8b80]'
                    }`}
                  >
                    JSON
                  </button>
                  <button
                    onClick={() => setBatchFormat('text')}
                    className={`px-2 py-0.5 rounded text-xs ${
                      batchFormat === 'text' ? 'bg-[#6b7cff] text-white' : 'bg-[#24262c] text-[#8f8b80]'
                    }`}
                  >
                    简易文本
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[#8f8b80]">目标:</span>
                  <select
                    value={batchTarget}
                    onChange={(e) => setBatchTarget(e.target.value as any)}
                    className="bg-[#24262c] border border-[#33363d] px-2 py-0.5 rounded text-[#e9e4d8] outline-none"
                  >
                    <option value="all">全量/自动识别</option>
                    <option value="courses">课程表 (Courses)</option>
                    <option value="assignments">课后作业 (Assignments)</option>
                    <option value="tasks">待办任务 (Tasks)</option>
                  </select>
                </div>
              </div>

              {batchFormat === 'json' ? (
                <div className="flex justify-between items-center text-[11px] text-[#8f8b80]">
                  <span>支持直接粘贴包含 courses、assignments、tasks 对象的 JSON</span>
                  <button
                    type="button"
                    onClick={handleFillTemplateJson}
                    className="text-[#6b7cff] hover:underline cursor-pointer"
                  >
                    填入示例模板
                  </button>
                </div>
              ) : (
                <div className="text-[11px] text-[#8f8b80]">
                  简易文本格式（每行一条）：
                  <br />
                  • 课表：课程名, 教师, 教室, 星期(1-7), 节次(如1-2), 周次
                  <br />
                  • 作业：课程名, 作业标题, 截止日期(YYYY-MM-DD)
                  <br />
                  • 任务：直接每行写一条任务标题
                </div>
              )}

              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={
                  batchFormat === 'json'
                    ? '{\n  "courses": [...],\n  "assignments": [...],\n  "tasks": [...]\n}'
                    : '示例：\nWeb编程技术, 葛江玲, 明理9-310, 1, 1-2, 2-14周\n数据库概论, 陈晓艳, 博学1-104, 3, 3-4, 2-14周'
                }
                rows={7}
                className="w-full bg-[#17191d] border border-[#33363d] rounded p-2.5 font-mono text-xs text-[#e9e4d8] outline-none focus:border-[#6b7cff]"
              />

              <button
                onClick={handleParseAndImport}
                disabled={loading || !rawText.trim()}
                className="w-full py-2.5 bg-[#6b7cff] hover:bg-[#5868e6] text-white font-bold text-sm rounded flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span>解析并写入云端 D1 数据库</span>
              </button>
            </div>
          )}

          {/* TAB 3: EXPORT */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              <div className="bg-[#24262c] p-3.5 rounded border border-[#33363d] space-y-2">
                <div className="font-bold text-sm text-[#e9e4d8] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#4ade80]" />
                  <span>当前云端数据库存储总览</span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 text-center font-mono">
                  <div className="bg-[#1a1c20] p-2 rounded">
                    <div className="text-lg font-bold text-[#6b7cff]">{courses.length}</div>
                    <div className="text-[10px] text-[#8f8b80]">门课程</div>
                  </div>
                  <div className="bg-[#1a1c20] p-2 rounded">
                    <div className="text-lg font-bold text-[#ff6b57]">{homework.length}</div>
                    <div className="text-[10px] text-[#8f8b80]">项作业</div>
                  </div>
                  <div className="bg-[#1a1c20] p-2 rounded">
                    <div className="text-lg font-bold text-[#4ade80]">{tasks.length}</div>
                    <div className="text-[10px] text-[#8f8b80]">条任务</div>
                  </div>
                </div>
              </div>

              <div className="text-xs text-[#8f8b80]">
                一键将云端存储中的全部课表、作业与任务导出为结构化 JSON 文件。该备份文件可在任何其他设备上通过「批量导入」恢复全部数据。
              </div>

              <button
                onClick={handleExportJson}
                className="w-full py-3 bg-[#e9e4d8] hover:bg-white text-[#1d1f24] font-bold text-sm rounded flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
              >
                <Download className="w-4 h-4" />
                <span>一键备份导出全部数据 (.json)</span>
              </button>
            </div>
          )}

          {/* TAB 4: CLEAR */}
          {activeTab === 'clear' && (
            <div className="space-y-3">
              <div className="p-3 bg-[#ff6b57]/10 border border-[#ff6b57]/30 rounded text-xs text-[#ff6b57] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>清空操作会直接从 Cloudflare D1 云端数据库中永久删除对应记录，请在操作前先备份重要数据。</span>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  onClick={() => handleClearTarget('courses')}
                  disabled={loading}
                  className="w-full py-2.5 px-3 bg-[#24262c] hover:bg-[#ff6b57]/20 border border-[#33363d] hover:border-[#ff6b57] rounded text-left text-xs text-[#e9e4d8] flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>清空全部云端课程 ({courses.length} 门)</span>
                  <Trash2 className="w-3.5 h-3.5 text-[#ff6b57]" />
                </button>

                <button
                  onClick={() => handleClearTarget('assignments')}
                  disabled={loading}
                  className="w-full py-2.5 px-3 bg-[#24262c] hover:bg-[#ff6b57]/20 border border-[#33363d] hover:border-[#ff6b57] rounded text-left text-xs text-[#e9e4d8] flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>清空全部云端作业 ({homework.length} 项)</span>
                  <Trash2 className="w-3.5 h-3.5 text-[#ff6b57]" />
                </button>

                <button
                  onClick={() => handleClearTarget('tasks')}
                  disabled={loading}
                  className="w-full py-2.5 px-3 bg-[#24262c] hover:bg-[#ff6b57]/20 border border-[#33363d] hover:border-[#ff6b57] rounded text-left text-xs text-[#e9e4d8] flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>清空全部云端任务 ({tasks.length} 条)</span>
                  <Trash2 className="w-3.5 h-3.5 text-[#ff6b57]" />
                </button>

                <button
                  onClick={() => handleClearTarget('all')}
                  disabled={loading}
                  className="w-full py-3 px-3 bg-[#ff6b57] hover:bg-[#e05643] text-white font-bold text-xs rounded flex items-center justify-center gap-2 transition-colors cursor-pointer mt-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>一键清空全部云端数据 (课表 + 作业 + 任务)</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#33363d] px-4 py-2.5 bg-[#26282e] flex items-center justify-between text-xs text-[#8f8b80]">
          <div className="flex items-center gap-1.5 font-mono">
            {loading ? (
              <span className="flex items-center gap-1 text-[#6b7cff]">
                <Loader2 className="w-3 h-3 animate-spin" />
                正在与 D1 同步中...
              </span>
            ) : (
              <span className="text-emerald-400">● 云端已连接</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-[#33363d] hover:bg-[#40434b] text-[#e9e4d8] rounded transition-colors cursor-pointer font-bold"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
