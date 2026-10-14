import React, { useState } from 'react';
import { TaskItem } from '../types';
import { pad2 } from '../utils/time';
import { Trash2, Plus, Timer, Cloud, RefreshCw, Loader2 } from 'lucide-react';
import { PomodoroTimer } from './PomodoroTimer';
import { SAMPLE_TASKS } from '../utils/sampleData';
import { api } from '../services/api';

interface TasksTabProps {
  tasks: TaskItem[];
  onAddTask: (title: string) => Promise<void>;
  onToggleTask: (id: number) => Promise<void>;
  onDeleteTask: (id: number) => Promise<void>;
  onRefreshTasks?: () => Promise<void>;
  onImportPresetTasks?: () => Promise<void>;
  loading?: boolean;
  toast: (msg: string) => void;
}

export const TasksTab: React.FC<TasksTabProps> = ({
  tasks,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onRefreshTasks,
  onImportPresetTasks,
  loading = false,
  toast,
}) => {
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('all');
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedTaskForPomodoro, setSelectedTaskForPomodoro] = useState<string>('');

  const handleRefresh = async () => {
    if (!onRefreshTasks) return;
    setIsRefreshing(true);
    try {
      await onRefreshTasks();
      toast('任务列表已成功刷新');
    } catch (e: any) {
      toast('刷新失败，请检查网络');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      toast('请输入任务内容');
      return;
    }

    setSubmitting(true);
    try {
      await onAddTask(trimmed);
      setTitle('');
      toast('任务已保存至云端 D1 数据库');
    } catch (err: any) {
      console.error('Add task error:', err);
      toast(err.message || '保存失败，请检查网络');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (task: TaskItem) => {
    setTogglingId(task.id);
    try {
      await onToggleTask(task.id);
    } catch (err: any) {
      console.error('Toggle task error:', err);
      toast(err.message || '更新任务状态失败，请重试');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await onDeleteTask(id);
    } catch (err: any) {
      console.error('Delete task error:', err);
      toast(err.message || '删除失败，请检查网络');
    } finally {
      setDeletingId(null);
    }
  };

  const handleImportSampleTasks = async () => {
    try {
      if (onImportPresetTasks) {
        await onImportPresetTasks();
      } else {
        await api.batchAddTasks(SAMPLE_TASKS, false);
        if (onRefreshTasks) await onRefreshTasks();
      }
      toast('已成功导入 4 项示例任务');
    } catch (e: any) {
      toast(e.message || '导入失败');
    }
  };

  const filteredList = tasks.filter(t => {
    if (filter === 'todo') return !t.done;
    if (filter === 'done') return t.done;
    return true;
  });

  const pendingCount = tasks.filter(t => !t.done).length;

  return (
    <div className="space-y-5 pb-6">
      {/* Title & Cloud Sync Header */}
      <div className="flex items-end justify-between border-b-[2.5px] border-[#e9e4d8] pb-2">
        <div>
          <div className="flex items-center gap-2">
            <div className="font-editorial text-2xl sm:text-3xl font-extrabold tracking-wide text-[#e9e4d8]">
              个人任务与专注
            </div>
            <div
              className="flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 border border-[#383b45] text-[#54b285] bg-[#1a231e]"
              title="已直连 Cloudflare D1 关系型数据库"
            >
              <Cloud className="w-3 h-3 text-[#54b285]" />
              <span>D1 云端已同步</span>
            </div>
          </div>
          <div className="text-[9.5px] font-mono tracking-[3px] text-[#8f8b80] mt-0.5">
            CLOUDFLARE D1 TASKS & POMODORO TIMER
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onRefreshTasks && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
              className="flex items-center gap-1.5 text-xs text-[#8f8b80] hover:text-[#e9e4d8] transition-colors cursor-pointer disabled:opacity-50"
              title="从云端数据库重新加载任务"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">刷新</span>
            </button>
          )}
          <div className="font-editorial italic text-xs text-[#8f8b80]">
            {loading ? '加载中...' : `${pendingCount} 项待办`}
          </div>
        </div>
      </div>

      {/* Pomodoro Timer Card */}
      <PomodoroTimer
        currentTaskTitle={selectedTaskForPomodoro}
        toast={toast}
      />

      {/* Task Section Subheading */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-xs font-mono font-bold tracking-wider text-[#8f8b80]">
          — 待办清单 LIST —
        </span>
        {selectedTaskForPomodoro && (
          <button
            onClick={() => setSelectedTaskForPomodoro('')}
            className="text-[10px] font-mono text-[#8f8b80] hover:text-[#e9e4d8] underline cursor-pointer"
          >
            清除番茄钟关联
          </button>
        )}
      </div>

      {/* Add Form */}
      <form onSubmit={handleAdd} className="bg-[#24262c] p-3 border border-[#33363d] rounded flex gap-2">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="要做的事，如：精读英语第三单元课文"
          disabled={submitting}
          className="flex-1 bg-transparent border-b-2 border-[#e9e4d8] text-sm text-[#e9e4d8] py-1 px-1 outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-1.5 bg-[#e9e4d8] hover:bg-[#6b7cff] text-[#1d1f24] hover:text-white font-bold text-sm transition-colors cursor-pointer shrink-0 disabled:opacity-50 flex items-center gap-1.5"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">保存中</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              <span className="text-xs">添加</span>
            </>
          )}
        </button>
      </form>

      {/* Filters */}
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

      {/* Task List Content with Loading & Empty State */}
      {loading ? (
        <div className="py-14 flex flex-col items-center justify-center gap-3 text-[#8f8b80]">
          <Loader2 className="w-6 h-6 animate-spin text-[#6b7cff]" />
          <span className="text-xs font-mono tracking-wider">正在从云端 D1 数据库加载任务...</span>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="py-10 px-4 text-center bg-[#1e222c] border border-dashed border-[#6b7cff]/40 rounded space-y-2">
          <div className="text-sm font-bold text-[#e9e4d8]">☁️ 暂无待办任务</div>
          <div className="text-xs text-[#8f8b80]">
            {filter !== 'all' ? '当前筛选下无匹配任务' : '云端数据库暂无任务。在上方输入待办快速记录，或一键导入示例任务'}
          </div>
          {filter === 'all' && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleImportSampleTasks}
                className="px-3.5 py-1.5 bg-[#6b7cff] hover:bg-[#5868e6] text-white text-xs font-bold rounded cursor-pointer transition-colors"
              >
                一键导入 4 项示例任务
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="divide-y divide-[#2a2d34]">
          {filteredList.map((item, idx) => {
            const isSelectedForTimer = selectedTaskForPomodoro === item.title;
            const isToggling = togglingId === item.id;
            const isDeleting = deletingId === item.id;

            return (
              <div
                key={item.id}
                className={`flex items-start gap-3 py-3 transition-opacity ${
                  item.done ? 'opacity-40' : ''
                } ${isSelectedForTimer ? 'bg-[#24262d] -mx-2 px-2 border-l-2 border-[#6b7cff]' : ''}`}
              >
                <span className="font-editorial italic text-xs text-[#63605a] w-5 pt-1 text-right shrink-0">
                  {pad2(idx + 1)}
                </span>

                <button
                  onClick={() => handleToggle(item)}
                  disabled={isToggling}
                  className={`w-5 h-5 border-2 border-[#e9e4d8] mt-0.5 flex items-center justify-center shrink-0 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                    item.done ? 'bg-[#e9e4d8] text-[#1d1f24]' : 'bg-transparent text-transparent hover:border-[#6b7cff]'
                  }`}
                  title={item.done ? '标记为未完成' : '标记为已完成'}
                >
                  {isToggling ? (
                    <Loader2 className="w-3 h-3 animate-spin text-[#1d1f24]" />
                  ) : item.done ? (
                    '✓'
                  ) : null}
                </button>

                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-semibold break-words ${
                      item.done ? 'line-through text-[#8f8b80]' : 'text-[#e9e4d8]'
                    }`}
                  >
                    {item.title}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {item.done ? (
                      <span className="text-[10px] px-1.5 py-0.2 bg-[#e9e4d8] text-[#1d1f24] font-bold">
                        已完成
                      </span>
                    ) : (
                      <>
                        <span className="text-[10px] px-1.5 py-0.2 border border-[#6b7cff] text-[#6b7cff] font-bold">
                          进行中
                        </span>
                        <button
                          onClick={() => setSelectedTaskForPomodoro(item.title)}
                          className={`text-[10px] px-1.5 py-0.2 flex items-center gap-1 cursor-pointer transition-colors ${
                            isSelectedForTimer
                              ? 'bg-[#6b7cff] text-white font-bold'
                              : 'text-[#8f8b80] hover:text-[#e9e4d8] hover:bg-[#2e313a]'
                          }`}
                          title="在番茄钟中专注此任务"
                        >
                          <Timer className="w-3 h-3" />
                          {isSelectedForTimer ? '专注中' : '专注此任务'}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(item.id)}
                  disabled={isDeleting}
                  className="p-1 text-[#63605a] hover:text-[#ff6b57] transition-colors cursor-pointer shrink-0 disabled:opacity-40"
                  title="删除"
                >
                  {isDeleting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#ff6b57]" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
