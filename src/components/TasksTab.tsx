import React, { useState, useEffect, useCallback } from 'react';
import { TaskItem } from '../types';
import { pad2 } from '../utils/time';
import { Trash2, Plus, Timer, Cloud, RefreshCw, Loader2, CheckCircle2, Circle } from 'lucide-react';
import { PomodoroTimer } from './PomodoroTimer';

interface TasksTabProps {
  toast: (msg: string) => void;
}

export const TasksTab: React.FC<TasksTabProps> = ({ toast }) => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('all');
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedTaskForPomodoro, setSelectedTaskForPomodoro] = useState<string>('');

  const getAuthHeaders = (): HeadersInit => {
    const token = localStorage.getItem('cs_app_token');
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  // 1. Fetch tasks from Cloudflare Pages /api/tasks (Cloudflare D1)
  const fetchTasks = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsRefreshing(true);
    try {
      const res = await fetch('/api/tasks', {
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        throw new Error(`网络请求失败 (${res.status})`);
      }

      const data = await res.json();
      let rawList: any[] = [];
      if (Array.isArray(data)) {
        rawList = data;
      } else if (Array.isArray(data.tasks)) {
        rawList = data.tasks;
      } else if (Array.isArray(data.data)) {
        rawList = data.data;
      }

      const formatted: TaskItem[] = rawList.map((item: any) => ({
        id: Number(item.id),
        title: String(item.title || ''),
        done: Boolean(item.completed !== undefined ? item.completed : item.done),
      }));

      setTasks(formatted);
      if (!isSilent) {
        toast('任务列表已成功刷新');
      }
    } catch (err: any) {
      console.error('Fetch /api/tasks error:', err);
      toast('无法同步云端任务，请检查网络');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [toast]);

  // Initial load
  useEffect(() => {
    fetchTasks(true);
  }, [fetchTasks]);

  // 2. Add Task (POST /api/tasks)
  const handleAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      toast('请输入任务内容');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ title: trimmed }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `创建失败 (${res.status})`);
      }

      const data = await res.json();
      const rawTask = data.task || data;
      const createdItem: TaskItem = {
        id: Number(rawTask.id || Date.now()),
        title: rawTask.title || trimmed,
        done: Boolean(rawTask.completed !== undefined ? rawTask.completed : rawTask.done),
      };

      setTasks(prev => [createdItem, ...prev]);
      setTitle('');
      toast('任务已保存至云端 D1 数据库');
    } catch (err: any) {
      console.error('Add task error:', err);
      toast(err.message || '保存失败，请检查网络');
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Toggle Task (PUT /api/tasks)
  const handleToggle = async (task: TaskItem) => {
    const nextCompleted = !task.done;
    setTogglingId(task.id);

    try {
      const res = await fetch('/api/tasks', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id: task.id,
          completed: nextCompleted,
          done: nextCompleted,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `更新失败 (${res.status})`);
      }

      // Update state directly upon confirmation
      setTasks(prev =>
        prev.map(t => (t.id === task.id ? { ...t, done: nextCompleted } : t))
      );
    } catch (err: any) {
      console.error('Toggle task error:', err);
      toast(err.message || '更新任务状态失败，请重试');
    } finally {
      setTogglingId(null);
    }
  };

  // 4. Delete Task (DELETE /api/tasks)
  const handleDelete = async (id: number) => {
    setDeletingId(id);

    try {
      let res = await fetch(`/api/tasks?id=${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        // Fallback for servers expecting body
        res = await fetch('/api/tasks', {
          method: 'DELETE',
          headers: getAuthHeaders(),
          body: JSON.stringify({ id }),
        });
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `删除失败 (${res.status})`);
      }

      setTasks(prev => prev.filter(t => t.id !== id));
      toast('任务已从云端删除');
    } catch (err: any) {
      console.error('Delete task error:', err);
      toast(err.message || '删除失败，请检查网络');
    } finally {
      setDeletingId(null);
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
          <button
            onClick={() => fetchTasks(false)}
            disabled={isRefreshing || loading}
            className="flex items-center gap-1.5 text-xs text-[#8f8b80] hover:text-[#e9e4d8] transition-colors cursor-pointer disabled:opacity-50"
            title="从云端数据库重新加载任务"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">刷新</span>
          </button>
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
        <div className="py-14 text-center text-[#63605a] font-editorial italic text-sm">
          — 暂无待办任务 —
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
