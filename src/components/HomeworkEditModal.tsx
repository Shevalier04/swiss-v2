import React, { useState } from 'react';
import { Homework, Course } from '../types';
import { X, Check, Calendar, BookOpen, FileText } from 'lucide-react';

interface HomeworkEditModalProps {
  homework: Homework;
  courses: Course[];
  onSave: (id: number, updated: { course: string; title: string; due: string }) => Promise<void>;
  onClose: () => void;
  toast: (msg: string) => void;
}

export const HomeworkEditModal: React.FC<HomeworkEditModalProps> = ({
  homework,
  courses,
  onSave,
  onClose,
  toast,
}) => {
  const [course, setCourse] = useState<string>(homework.course || '常规课程');
  const [title, setTitle] = useState<string>(homework.title || '');
  const [due, setDue] = useState<string>(homework.due || '');
  const [saving, setSaving] = useState<boolean>(false);

  // Extract unique course names from existing courses
  const availableCourses = Array.from(
    new Set([...courses.map(c => c.name), homework.course || '常规课程'].filter(Boolean))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast('作业标题不能为空');
      return;
    }

    setSaving(true);
    try {
      await onSave(homework.id, {
        course: course.trim(),
        title: title.trim(),
        due: due.trim(),
      });
      toast('作业更新成功');
      onClose();
    } catch (err: any) {
      toast(err.message || '更新作业失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#181a20] border-2 border-[#6b7cff]/40 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 bg-[#1f222c] border-b border-[#2e313d] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#6b7cff]/20 border border-[#6b7cff]/40 flex items-center justify-center text-[#6b7cff]">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="font-editorial font-bold text-base text-[#e9e4d8]">编辑作业内容</div>
              <div className="text-[10px] font-mono text-[#8f8b80]">EDIT ASSIGNMENT</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#8f8b80] hover:text-[#e9e4d8] hover:bg-[#252834] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Course Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#c8c5bc] flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[#6b7cff]" />
              <span>所属课程</span>
            </label>
            <div className="flex gap-2">
              <select
                value={course}
                onChange={e => setCourse(e.target.value)}
                className="flex-1 bg-[#121318] border border-[#333742] focus:border-[#6b7cff] text-xs text-[#e9e4d8] rounded-xl px-3 py-2.5 outline-none cursor-pointer transition-colors"
              >
                {availableCourses.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="text"
              value={course}
              onChange={e => setCourse(e.target.value)}
              placeholder="或直接输入自定义课程名称..."
              className="w-full bg-[#121318] border border-[#333742] focus:border-[#6b7cff] text-xs text-[#e9e4d8] rounded-xl px-3 py-2 outline-none transition-colors mt-1.5"
            />
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#c8c5bc] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#6b7cff]" />
              <span>作业名称与内容</span>
            </label>
            <textarea
              rows={3}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="例如：实验二 数据库基本查询与更新..."
              className="w-full bg-[#121318] border border-[#333742] focus:border-[#6b7cff] text-xs text-[#e9e4d8] rounded-xl p-3 outline-none transition-colors resize-none"
              required
            />
          </div>

          {/* Deadline */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#c8c5bc] flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#6b7cff]" />
              <span>截止时间</span>
            </label>
            <input
              type="text"
              value={due}
              onChange={e => setDue(e.target.value)}
              placeholder="例如：26.10.19 8:00 或 本周日 23:59"
              className="w-full bg-[#121318] border border-[#333742] focus:border-[#6b7cff] text-xs text-[#e9e4d8] rounded-xl px-3 py-2.5 outline-none transition-colors font-mono"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-[#252834]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#252834] hover:bg-[#303444] text-[#8f8b80] hover:text-[#e9e4d8] text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-[#6b7cff] hover:bg-[#5868e6] text-white text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? (
                <>保存中...</>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>保存修改</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
