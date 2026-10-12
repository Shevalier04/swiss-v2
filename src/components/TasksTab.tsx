import React, { useState, useEffect, useCallback } from 'react';
import { TaskItem } from '../types';
import { pad2 } from '../utils/time';
import { Trash2, Plus, Timer, Cloud, RefreshCw } from 'lucide-react';
import { PomodoroTimer } from './PomodoroTimer';

interface TasksTabProps {
  tasks?: TaskItem[];
  onAdd?: (title: string) => Promise<void>;
  onToggle?: (id: number) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
  toast: (msg: string) => void;
}

export const TasksTab: React.FC<TasksTabProps> = ({
  tasks,
  onAdd,
  onToggle,
  onDelete,
  toast,
}) => {
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('all');
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'connected' | 'syncing' | 'offline'>('connected');
  const [selectedTaskForPomodoro, setSelectedTaskForPomodoro] = useState<string>('');

  // Primary task state synced with /api/tasks
  const [taskList, setTaskList] = useState<TaskItem[]>(() => {
    if (tasks && tasks.length > 0) return tasks;
    try {
      const cached = localStorage.getItem('cs_tasks_cloud_cache');
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  });

  // Fetch tasks asynchronously from Cloudflare Pages Functions (/api/tasks)
  const syncFromApi = useCallback(async (quiet = false) => {
    setIsSyncing(true);
    setCloudStatus('syncing');
    try {
      const token = localStorage.getItem('cs_app_token');
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/tasks', { headers });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
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

      setTaskList(formatted);
      localStorage.setItem('cs_tasks_cloud_cache', JSON.stringify(formatted));
      setCloudStatus('connected');
      if (!quiet) toast('云端任务已成功同步');
    } catch (err: any) {
      console.warn('Sync /api/tasks failed, using local/cached data:', err);
      setCloudStatus('offline');
      if (!quiet) toast('已切换至本地离线模式');
    } finally {
      setIsSyncing(false);
    }
  }, [toast]);

  // Initial load
  useEffect(() => {
    syncFromApi(true);
  }, [syncFromApi]);

  // Sync if parent passes updated tasks prop
  useEffect(() => {
    if (tasks && tasks.length > 0 && taskList.length === 0) {
      setTaskList(tasks);
    }
  }, [tasks]);

  // Add task asynchronously via POST /api/tasks
  const handleAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      toast('请输入任务内容');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('cs_app_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let addedTask: TaskItem | null = null;
      try {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers,
          body: JSON.stringify({ title: trimmed }),
        });

        if (res.ok) {
          const data = await res.json();
          const taskObj = data.task || data;
          if (taskObj && taskObj.id) {
            addedTask = {
              id: Number(taskObj.id),
              title: taskObj.title || trimmed,
              done: Boolean(taskObj.completed !== undefined ? taskObj.completed : taskObj.done),
            };
          }
        }
      } catch (networkErr) {
        console.warn('Network error posting to /api/tasks:', networkErr);
      }

      if (!addedTask) {
        addedTask = {
          id: Date.now(),
          title: trimmed,
          done: false,
        };
      }

      const nextList = [addedTask, ...taskList.filter(t => t.id !== addedTask!.id)];
      setTaskList(nextList);
      localStorage.setItem('cs_tasks_cloud_cache', JSON.stringify(nextList));

      if (onAdd) {
        await onAdd(trimmed).catch(() => {});
      }

      setTitle('');
      toast('任务已保存并同步至云端');
    } catch (err: any) {
      toast(err.message || '添加失败');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle task status asynchronously via PUT /api/tasks
  const handleToggle = async (id: number) => {
    const target = taskList.find(t => t.id === id);
    if (!target) return;

    const nextDone = !target.done;
    const nextList = taskList.map(t => (t.id === id ? { ...t, done: nextDone } : t));
    setTaskList(nextList);
    localStorage.setItem('cs_tasks_cloud_cache', JSON.stringify(nextList));

    try {
      const token = localStorage.getItem('cs_app_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // Call Cloudflare Pages PUT /api/tasks
      await fetch('/api/tasks', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ id, completed: nextDone, done: nextDone }),
      }).catch(() => {});

      if (onToggle) {
        await onToggle(id).catch(() => {});
      }
    } catch (err) {
      console.warn('Toggle task sync error:', err);
    }
  };

  // Delete task asynchronously via DELETE /api/tasks
  const handleDelete = async (id: number) => {
    const nextList = taskList.filter(t => t.id !== id);
    setTaskList(nextList);
    localStorage.setItem('cs_tasks_cloud_cache', JSON.stringify(nextList));

    try {
      const token = localStorage.getItem('cs_app_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // Try DELETE with query param first, then body
      const res = await fetch(`/api/tasks?id=${id}`, {
        method: 'DELETE',
        headers,
      }).catch(() => null);

      if (!res || !res.ok) {
        await fetch('/api/tasks', {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ id }),
        }).catch(() => {});
      }

      if (onDelete) {
        await onDelete(id).catch(() => {});
      }
      toast('任务已删除');
    } catch (err) {
      console.warn('Delete task sync error:', err);
      toast('任务已删除');
    }
  };

  const filteredList = taskList.filter(t => {
    if (filter === 'todo') return !t.done;
    if (filter === 'done') return t.done;
    return true;
  });

  const pendingCount = taskList.filter(t => !t.done).length;

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
              className={`flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 border ${
                cloudStatus === 'connected'
                  ? 'border-[#383b45] text-[#54b285] bg-[#1a231e]'
                  : cloudStatus === 'syncing'
                  ? 'border-[#6b7cff]/40 text-[#6b7cff] bg-[#1d2030]'
                  : 'border-[#ff6b57]/40 text-[#ff6b57] bg-[#2a1d1d]'
              }`}
              title="Cloudflare D1 云端数据库连接状态"
            >
              <Cloud className={`w-3 h-3 ${cloudStatus === 'syncing' ? 'animate-pulse' : ''}`} />
              <span>{cloudStatus === 'connected' ? 'D1 云端已同步' : cloudStatus === 'syncing' ? '同步中...' : '离线存储'}</span>
            </div>
          </div>
          <div className="text-[9.5px] font-mono tracking-[3px] text-[#8f8b80] mt-0.5">
            CLOUDFLARE D1 TASKS & POMODORO TIMER
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => syncFromApi(false)}
            disabled={isSyncing}
            className="flex items-center gap-1 text-xs text-[#8f8b80] hover:text-[#e9e4d8] transition-colors cursor-pointer disabled:opacity-50"
            title="从云端数据库重新加载任务"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">刷新</span>
          </button>
          <div className="font-editorial italic text-xs text-[#8f8b80]">
            {pendingCount} 项待办
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
          className="flex-1 bg-transparent border-b-2 border-[#e9e4d8] text-sm text-[#e9e4d8] py-1 px-1 outline-none"
        />
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-1.5 bg-[#e9e4d8] hover:bg-[#6b7cff] text-[#1d1f24] hover:text-white font-bold text-sm transition-colors cursor-pointer shrink-0 disabled:opacity-50 flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          <span className="text-xs">添加</span>
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

      {/* Task List */}
      {filteredList.length === 0 ? (
        <div className="py-12 text-center text-[#63605a] font-editorial italic text-sm">
          — 暂无待办任务，添加一个吧 —
        </div>
      ) : (
        <div className="divide-y divide-[#2a2d34]">
          {filteredList.map((item, idx) => {
            const isSelectedForTimer = selectedTaskForPomodoro === item.title;
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
                  onClick={() => handleToggle(item.id)}
                  className={`w-5 h-5 border-2 border-[#e9e4d8] mt-0.5 flex items-center justify-center shrink-0 text-xs font-bold transition-colors cursor-pointer ${
                    item.done ? 'bg-[#e9e4d8] text-[#1d1f24]' : 'bg-transparent text-transparent'
                  }`}
                  title={item.done ? '标记为未完成' : '标记为已完成'}
                >
                  ✓
                </button>

                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-semibold ${
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
                  className="p-1 text-[#63605a] hover:text-[#ff6b57] transition-colors cursor-pointer shrink-0"
                  title="删除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
