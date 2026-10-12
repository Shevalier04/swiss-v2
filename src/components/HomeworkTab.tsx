import React, { useState } from 'react';
import { Course, Homework, User } from '../types';
import { dueDays, pad2 } from '../utils/time';
import { Trash2, Plus, Terminal, DownloadCloud } from 'lucide-react';
import { HomeworkImportModal } from './HomeworkImportModal';

interface HomeworkTabProps {
  user?: User | null;
  courses: Course[];
  homework: Homework[];
  onAdd: (course: string, title: string, due?: string) => Promise<void>;
  onBatchAdd?: (items: { course: string; title: string; due?: string }[]) => Promise<void>;
  onToggle: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  toast: (msg: string) => void;
}

export const HomeworkTab: React.FC<HomeworkTabProps> = ({
  user,
  courses,
  homework,
  onAdd,
  onBatchAdd,
  onToggle,
  onDelete,
  toast,
}) => {
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('all');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const courseNames = React.useMemo(() => {
    const names = Array.from(new Set(courses.map(c => c.name))).filter(Boolean);
    return names.length ? names : ['Web编程技术', '数据库概论', '软件工程导论', '其他'];
  }, [courses]);

  React.useEffect(() => {
    if (!selectedCourse && courseNames.length) {
      setSelectedCourse(courseNames[0]);
    }
  }, [courseNames, selectedCourse]);

  const handleAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim()) {
      toast('请输入作业内容');
      return;
    }
    setSubmitting(true);
    try {
      await onAdd(selectedCourse || courseNames[0] || '其他', title.trim(), dueDate || undefined);
      setTitle('');
      setDueDate('');
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

  const filteredList = homework.filter(h => {
    if (filter === 'todo') return !h.done;
    if (filter === 'done') return h.done;
    return true;
  });

  const pendingCount = homework.filter(h => !h.done).length;

  return (
    <div className="space-y-4 pb-6">
      {/* Title & Import Action */}
      <div className="flex items-end justify-between border-b-[2.5px] border-[#e9e4d8] pb-2">
        <div>
          <div className="font-editorial text-2xl sm:text-3xl font-extrabold tracking-wide text-[#e9e4d8]">
            全部作业
          </div>
          <div className="text-[9.5px] font-mono tracking-[3px] text-[#8f8b80] mt-0.5">
            ASSIGNMENTS
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="px-3 py-1.5 bg-[#252834] hover:bg-[#303444] text-[#e9e4d8] border border-[#6b7cff]/60 hover:border-[#6b7cff] rounded text-xs font-bold tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
            title={user?.role === 'admin' ? "控制台作业库管理与命令行控制输入" : "一键从控制台作业库批量导入"}
          >
            {user?.role === 'admin' ? (
              <Terminal className="w-3.5 h-3.5 text-[#4ade80]" />
            ) : (
              <DownloadCloud className="w-3.5 h-3.5 text-[#6b7cff]" />
            )}
            <span>一键导入作业</span>
            {user?.role === 'admin' && (
              <span className="text-[9px] px-1 py-0.2 bg-[#6b7cff] text-white rounded font-mono font-bold">
                ADMIN
              </span>
            )}
          </button>

          <div className="font-editorial italic text-xs text-[#8f8b80] hidden sm:block">
            {pendingCount} 项未完成
          </div>
        </div>
      </div>

      {/* Add Form */}
      <form onSubmit={handleAdd} className="bg-[#24262c] p-3.5 border border-[#33363d] rounded space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label className="block text-[9.5px] font-bold tracking-wider text-[#8f8b80] mb-1">
              课程
            </label>
            <select
              value={selectedCourse}
              onChange={e => setSelectedCourse(e.target.value)}
              className="w-full bg-transparent border-b-2 border-[#e9e4d8] text-sm text-[#e9e4d8] py-1 outline-none"
            >
              {courseNames.map(name => (
                <option key={name} value={name} className="bg-[#1d1f24] text-[#e9e4d8]">
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[9.5px] font-bold tracking-wider text-[#8f8b80] mb-1">
              截止日期
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full bg-transparent border-b-2 border-[#e9e4d8] text-sm text-[#e9e4d8] py-1 outline-none"
            />
          </div>

          <div>
            <label className="block text-[9.5px] font-bold tracking-wider text-[#8f8b80] mb-1">
              作业内容
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="如：第3章课后习题"
                className="flex-1 bg-transparent border-b-2 border-[#e9e4d8] text-sm text-[#e9e4d8] py-1 outline-none"
              />
              <button
                type="submit"
                disabled={submitting}
                className="px-3 py-1 bg-[#e9e4d8] hover:bg-[#6b7cff] text-[#1d1f24] hover:text-white font-bold text-sm transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </form>

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
        <div className="py-12 text-center text-[#63605a] font-editorial italic text-sm">
          — 暂无作业 —
        </div>
      ) : (
        <div className="divide-y divide-[#2a2d34]">
          {filteredList.map((item, idx) => {
            const d = dueDays(item.due);
            const isUrgent = !item.done && d <= 0;
            const isSoon = !item.done && d > 0 && d <= 2;

            return (
              <div
                key={item.id}
                className={`flex items-start gap-3 py-3 transition-opacity ${
                  item.done ? 'opacity-40' : ''
                }`}
              >
                <span className="font-editorial italic text-xs text-[#63605a] w-5 pt-1 text-right shrink-0">
                  {pad2(idx + 1)}
                </span>

                <button
                  onClick={() => onToggle(item.id)}
                  className={`w-5 h-5 border-2 border-[#e9e4d8] mt-0.5 flex items-center justify-center shrink-0 text-xs font-bold transition-colors cursor-pointer ${
                    item.done ? 'bg-[#e9e4d8] text-[#1d1f24]' : 'bg-transparent text-transparent'
                  }`}
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
                  <div className="flex items-center gap-2 text-xs text-[#8f8b80] mt-1">
                    <span>{item.course}</span>
                    <span>·</span>
                    {item.done ? (
                      <span className="text-[10px] px-1.5 py-0.2 bg-[#e9e4d8] text-[#1d1f24] font-bold">
                        已完成
                      </span>
                    ) : item.due ? (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 border font-bold ${
                          isUrgent
                            ? 'bg-[#ff6b57] text-white border-[#ff6b57]'
                            : isSoon
                            ? 'bg-[#33270f] text-[#e0a050] border-[#d99a4e]'
                            : 'border-[#e9e4d8] text-[#e9e4d8]'
                        }`}
                      >
                        {d < 0 ? '已逾期' : d === 0 ? '今天截止' : `${d}天后截止`}
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#63605a]">无截止日</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => onDelete(item.id)}
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
