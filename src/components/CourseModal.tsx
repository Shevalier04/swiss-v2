import React, { useState, useEffect, useMemo } from 'react';
import { Course, Homework } from '../types';
import { WEEKDAYS, SLOTS, PALETTE, isWeeksOverlap } from '../utils/time';
import { X, Trash2, Check } from 'lucide-react';

interface CourseModalProps {
  course: Course | null;
  preset?: { day: number; s: number; e: number; weeks?: string } | null;
  existingCourses: Course[];
  homework?: Homework[];
  onToggleHomework?: (id: number) => void;
  onSave: (courseData: Omit<Course, 'id'>, id?: number) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
  onClose: () => void;
  toast: (msg: string) => void;
}

export const CourseModal: React.FC<CourseModalProps> = ({
  course,
  preset,
  existingCourses,
  homework,
  onToggleHomework,
  onSave,
  onDelete,
  onClose,
  toast,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [teacher, setTeacher] = useState('');
  const [room, setRoom] = useState('');
  const [weeks, setWeeks] = useState('');
  const [day, setDay] = useState(0);
  const [startSlot, setStartSlot] = useState(1);
  const [endSlot, setEndSlot] = useState(2);
  const [color, setColor] = useState(PALETTE[0]);
  const [saving, setSaving] = useState(false);

  const courseHomework = useMemo(() => {
    if (!course || !homework) return [];
    const cName = course.name.trim().toLowerCase();
    return homework.filter(h => {
      const hCourse = (h.course || '常规课程').trim().toLowerCase();
      return hCourse === cName || cName.includes(hCourse) || hCourse.includes(cName);
    });
  }, [course, homework]);

  useEffect(() => {
    if (course) {
      setName(course.name);
      setTeacher(course.teacher || '');
      setRoom(course.room || '');
      setWeeks(course.weeks || '');
      setDay(course.day);
      setStartSlot(course.s);
      setEndSlot(course.e);
      setColor(course.color || PALETTE[0]);
      setIsEditing(false);
    } else if (preset) {
      setName('');
      setTeacher('');
      setRoom('');
      setWeeks(preset.weeks || '');
      setDay(preset.day);
      setStartSlot(preset.s);
      setEndSlot(preset.e);
      setColor(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
      setIsEditing(true);
    }
  }, [course, preset]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      toast('请输入课程名');
      return;
    }
    if (startSlot > endSlot) {
      toast('结束节次不能早于开始节次');
      return;
    }

    const hasConflict = existingCourses.some(c => {
      if (course && c.id === course.id) return false;
      if (c.day !== day) return false;
      if (!isWeeksOverlap(c.weeks, weeks)) return false;
      return !(endSlot < c.s || startSlot > c.e);
    });

    if (hasConflict) {
      toast('与该时段已有课程冲突，请检查星期与节次');
      return;
    }

    setSaving(true);
    try {
      await onSave(
        {
          name: name.trim(),
          teacher: teacher.trim(),
          room: room.trim(),
          weeks: weeks.trim(),
          day,
          s: startSlot,
          e: endSlot,
          color,
        },
        course?.id
      );
      toast(course ? '课程修改已保存' : '已添加新课程');
      onClose();
    } catch (err: any) {
      toast(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!course || !onDelete) return;
    try {
      await onDelete(course.id);
      toast(`已删除课程：${course.name}`);
      onClose();
    } catch (err: any) {
      toast(err.message || '删除失败');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs">
      <div className="w-full max-w-[480px] bg-[#24262c] border-t-4 sm:border-2 border-[#e9e4d8] p-5 rounded-t-xl sm:rounded-lg shadow-2xl max-h-[85vh] overflow-y-auto text-[#e9e4d8]">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-[#33363d]">
          <div>
            <h3 className="font-editorial text-2xl font-bold tracking-wide">
              {course ? (isEditing ? '编辑课程' : course.name) : '添加课程'}
            </h3>
            <div className="text-[9.5px] font-mono tracking-[3px] text-[#8f8b80] mt-0.5">
              {course ? (isEditing ? 'EDIT COURSE' : `COURSE DETAIL · ${WEEKDAYS[course.day]}`) : 'NEW COURSE'}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#8f8b80] hover:text-[#e9e4d8] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Read-Only Details */}
        {!isEditing && course ? (
          <div className="py-3 space-y-2.5 text-sm divide-y divide-[#2a2d34]">
            <div className="flex justify-between py-1.5">
              <span className="text-[#8f8b80]">星期</span>
              <span className="font-bold">{WEEKDAYS[course.day]}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[#8f8b80]">节次</span>
              <span className="font-bold">
                第 {course.s} - {course.e} 节 ({SLOTS[course.s].s} - {SLOTS[course.e].e})
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[#8f8b80]">周次范围</span>
              <span className="font-mono">{course.weeks || '全学期 (1-25周)'}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[#8f8b80]">教室地点</span>
              <span className="font-bold">{course.room || '待定'}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[#8f8b80]">授课教师</span>
              <span className="font-bold">{course.teacher || '待定'}</span>
            </div>

            {/* Course Homework Section */}
            <div className="pt-3 pb-1">
              <div className="font-bold text-[11px] uppercase tracking-wider text-[#8f8b80] mb-2 flex items-center justify-between">
                <span>相关作业记录 ({courseHomework.length})</span>
              </div>
              {courseHomework.length === 0 ? (
                <div className="py-3 text-center text-xs text-[#8f8b80] bg-[#1d1f24] rounded-lg border border-[#33363d]">
                  当前课程暂无作业记录
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {courseHomework.map(item => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg bg-[#1d1f24] border border-[#33363d] transition-all ${
                        item.done ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => onToggleHomework?.(item.id)}
                          className={`w-4 h-4 rounded-[3px] border-2 flex items-center justify-center shrink-0 cursor-pointer ${
                            item.done ? 'bg-[#e9e4d8] border-[#e9e4d8] text-[#1d1f24]' : 'border-[#e9e4d8]'
                          }`}
                        >
                          {item.done ? <Check className="w-3 h-3 stroke-[3]" /> : null}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className={`text-xs font-semibold truncate ${item.done ? 'line-through text-[#8f8b80]' : 'text-[#e9e4d8]'}`}>
                            {item.title}
                          </div>
                          {item.due ? (
                            <div className="text-[10px] text-[#8f8b80] font-mono mt-0.5">
                              截止: {item.due}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 flex gap-2.5">
              <button
                onClick={() => setIsEditing(true)}
                className="flex-1 py-2.5 bg-[#e9e4d8] hover:bg-white text-[#1d1f24] font-bold text-xs tracking-wider transition-colors cursor-pointer"
              >
                修改此课程
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2.5 border border-[#ff6b57] text-[#ff6b57] hover:bg-[#ff6b57] hover:text-white font-bold text-xs transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="py-3 space-y-3.5 text-xs">
            <div>
              <label className="block text-[#8f8b80] font-bold mb-1">课程名称 *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="如：计算机网络"
                className="w-full bg-transparent border-b-2 border-[#e9e4d8] text-sm text-[#e9e4d8] py-1.5 outline-none font-editorial"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#8f8b80] font-bold mb-1">任课教师</label>
                <input
                  type="text"
                  value={teacher}
                  onChange={e => setTeacher(e.target.value)}
                  placeholder="选填"
                  className="w-full bg-transparent border-b-2 border-[#e9e4d8] text-sm text-[#e9e4d8] py-1.5 outline-none"
                />
              </div>

              <div>
                <label className="block text-[#8f8b80] font-bold mb-1">上课地点</label>
                <input
                  type="text"
                  value={room}
                  onChange={e => setRoom(e.target.value)}
                  placeholder="如：明理9-310"
                  className="w-full bg-transparent border-b-2 border-[#e9e4d8] text-sm text-[#e9e4d8] py-1.5 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[#8f8b80] font-bold mb-1">
                周次格式 (如 2-14周 或 2-14周,16-17周，留空=全学期)
              </label>
              <input
                type="text"
                value={weeks}
                onChange={e => setWeeks(e.target.value)}
                placeholder="留空表示全学期"
                className="w-full bg-transparent border-b-2 border-[#e9e4d8] text-sm text-[#e9e4d8] py-1.5 outline-none font-mono"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[#8f8b80] font-bold mb-1">星期</label>
                <select
                  value={day}
                  onChange={e => setDay(Number(e.target.value))}
                  className="w-full bg-transparent border-b-2 border-[#e9e4d8] text-sm text-[#e9e4d8] py-1.5 outline-none"
                >
                  {WEEKDAYS.map((w, idx) => (
                    <option key={w} value={idx} className="bg-[#1d1f24] text-[#e9e4d8]">
                      {w}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#8f8b80] font-bold mb-1">起始节次</label>
                <select
                  value={startSlot}
                  onChange={e => setStartSlot(Number(e.target.value))}
                  className="w-full bg-transparent border-b-2 border-[#e9e4d8] text-sm text-[#e9e4d8] py-1.5 outline-none"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(n => (
                    <option key={n} value={n} className="bg-[#1d1f24] text-[#e9e4d8]">
                      第{n}节 ({SLOTS[n].s})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#8f8b80] font-bold mb-1">结束节次</label>
                <select
                  value={endSlot}
                  onChange={e => setEndSlot(Number(e.target.value))}
                  className="w-full bg-transparent border-b-2 border-[#e9e4d8] text-sm text-[#e9e4d8] py-1.5 outline-none"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(n => (
                    <option key={n} value={n} className="bg-[#1d1f24] text-[#e9e4d8]">
                      第{n}节 ({SLOTS[n].e})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[#8f8b80] font-bold mb-1.5">色块配色</label>
              <div className="flex gap-2">
                {PALETTE.map(col => (
                  <button
                    type="button"
                    key={col}
                    onClick={() => setColor(col)}
                    style={{ backgroundColor: col }}
                    className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                      color === col ? 'ring-2 ring-white scale-110' : 'opacity-70'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="pt-3 flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-3 bg-[#e9e4d8] hover:bg-[#6b7cff] text-[#1d1f24] hover:text-white font-bold text-xs tracking-widest transition-colors cursor-pointer disabled:opacity-50"
              >
                {saving ? '保存中...' : '保 存'}
              </button>
              {course && (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-3 border border-[#8f8b80] text-[#8f8b80] hover:text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  取消
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
