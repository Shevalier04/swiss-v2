import React, { useState, useEffect, useCallback } from 'react';
import { User, Course, Homework, TaskItem, Notice, RemindSettings } from './types';
import { api } from './services/api';
import { SLOTS, toMinutes, isCourseInWeek, getWeekNo, getNextDayInfo, isSundayEvening } from './utils/time';
import { playReminderBeep } from './utils/audio';
import { SAMPLE_TASKS } from './utils/sampleData';

import { PWAInstallBar } from './components/PWAInstallBar';
import { AuthView } from './components/AuthView';
import { TodayTab } from './components/TodayTab';
import { TimetableTab } from './components/TimetableTab';
import { HomeworkTab } from './components/HomeworkTab';
import { TasksTab } from './components/TasksTab';
import { ProfileTab } from './components/ProfileTab';
import { WidgetTab } from './components/WidgetTab';
import { ReminderTab } from './components/ReminderTab';
import { CourseModal } from './components/CourseModal';
import { PdfImportModal } from './components/PdfImportModal';
import { AdminTerminalModal } from './components/AdminTerminalModal';
import { ReminderToast } from './components/ReminderToast';
import { SundayEveModal } from './components/SundayEveModal';
import { DataManagementModal } from './components/DataManagementModal';
import { BrowserDoctorModal } from './components/BrowserDoctorModal';
import { FloatingPomodoroWidget } from './components/FloatingPomodoroWidget';

import {
  CalendarDays,
  LayoutGrid,
  FileCheck2,
  CheckSquare,
  User as UserIcon,
  Database,
  Cloud,
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'hw' | 'tasks' | 'mine' | 'widget' | 'remind'>(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const tabParam = searchParams.get('tab');
      if (tabParam && ['today', 'week', 'hw', 'tasks', 'mine', 'widget', 'remind'].includes(tabParam)) {
        return tabParam as any;
      }
    } catch (e) {}
    return 'today';
  });

  // App Data
  const [courses, setCourses] = useState<Course[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [dismissedNoticeId, setDismissedNoticeId] = useState<number | null>(null);

  // Cross-tab Pomodoro Focus Link
  const [focusTaskTitle, setFocusTaskTitle] = useState<string>('');

  // Reminder Settings
  const [remindSettings, setRemindSettings] = useState<RemindSettings>(() => {
    try {
      const saved = localStorage.getItem('cs_remind_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      enabled: true,
      lead: 10,
      inapp: true,
      sys: true,
      sound: true,
      sundayEveEnabled: true,
      sundayEveHour: 20, // 20:00 (8:00 PM)
      sundayAutoAdvance: true, // Advance timetable to new week on Sunday evening
      everyEvePreview: false,
    };
  });

  // Modals & Popups
  const [activeCourseModal, setActiveCourseModal] = useState<Course | null>(null);
  const [coursePreset, setCoursePreset] = useState<{ day: number; s: number; e: number; weeks?: string } | null>(null);
  const [pdfFileToImport, setPdfFileToImport] = useState<File | null>(null);
  const [isAdminTerminalOpen, setIsAdminTerminalOpen] = useState(false);
  const [isDataManagementOpen, setIsDataManagementOpen] = useState(false);
  const [isDoctorModalOpen, setIsDoctorModalOpen] = useState(false);

  // Active floating reminder toast
  const [activeReminderCourse, setActiveReminderCourse] = useState<Course | null>(null);
  const [notifiedCourseIds, setNotifiedCourseIds] = useState<Set<number>>(new Set());

  // Active Sunday evening / next-day alert modal
  const [activeSundayEveAlert, setActiveSundayEveAlert] = useState<{
    firstCourse: Course;
    tomorrowCoursesCount: number;
    nextWeekNo: number;
  } | null>(null);

  // Global Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimeoutRef = React.useRef<any>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMsg(null);
    }, 2200);
  }, []);

  // Check auth session on startup
  useEffect(() => {
    async function initSession() {
      try {
        const me = await api.getMe();
        if (me && !me.disabled) {
          setCurrentUser(me);
          await loadAllUserData();
        }
      } catch (e) {
        // Not logged in or expired
      } finally {
        setInitialLoading(false);
      }
    }
    initSession();
  }, []);

  const loadAllUserData = async () => {
    try {
      const [cList, hList, tList, nList] = await Promise.all([
        api.getCourses(),
        api.getHomework(),
        api.getTasks(),
        api.getNotices(),
      ]);
      setCourses(cList);
      setHomework(hList);
      setTasks(tList);
      setNotices(nList);
    } catch (e: any) {
      console.error('Failed to load user data', e);
    }
  };

  const handleLoginSuccess = async (user: User) => {
    setCurrentUser(user);
    await loadAllUserData();
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const tabParam = searchParams.get('tab');
      if (tabParam && ['today', 'week', 'hw', 'tasks', 'mine', 'widget', 'remind'].includes(tabParam)) {
        setActiveTab(tabParam as any);
        return;
      }
    } catch (e) {}
    setActiveTab('today');
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setCourses([]);
    setHomework([]);
    setTasks([]);
  };

  const updateRemindSettings = (partial: Partial<RemindSettings>) => {
    setRemindSettings(prev => {
      const updated = { ...prev, ...partial };
      localStorage.setItem('cs_remind_settings', JSON.stringify(updated));
      return updated;
    });
  };

  // High-frequency reminder poll (every 20s)
  useEffect(() => {
    if (!currentUser || !remindSettings.enabled) return;

    const checkReminders = () => {
      const now = new Date();
      const currentWeek = Math.max(1, Math.min(25, getWeekNo(now)));
      const todayDayIdx = (now.getDay() + 6) % 7;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      // 1. Check current-day class starting alert (e.g. 10 mins before class)
      const todayCourses = courses.filter(
        c => c.day === todayDayIdx && isCourseInWeek(currentWeek, c.weeks)
      );

      for (const c of todayCourses) {
        const sMin = toMinutes(SLOTS[c.s].s);
        const left = sMin - currentMinutes;

        if (left > 0 && left <= remindSettings.lead && !notifiedCourseIds.has(c.id)) {
          setNotifiedCourseIds(prev => new Set(prev).add(c.id));

          if (remindSettings.inapp) {
            setActiveReminderCourse(c);
          }

          if (remindSettings.sound) {
            playReminderBeep();
          }

          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
              navigator.vibrate([300, 150, 300, 150, 400]);
            } catch {}
          }

          if (remindSettings.sys && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
              new Notification(`还有 ${left} 分钟上课 · ${c.name}`, {
                body: `${SLOTS[c.s].s} - ${SLOTS[c.e].e} ｜ 第${c.s}-${c.e}节${c.room ? ` ｜ @${c.room}` : ''}${c.teacher ? ` ｜ ${c.teacher}` : ''}`,
                icon: '/icon.svg',
              });
            } catch (e) {}
          }
          break;
        }
      }

      // 2. Check Sunday evening / evening preview alert
      if (remindSettings.sundayEveEnabled) {
        const isSundayEveTime = now.getDay() === 0 && now.getHours() >= (remindSettings.sundayEveHour || 20);
        const isEveTime = remindSettings.everyEvePreview && now.getHours() >= 20;

        if (isSundayEveTime || isEveTime) {
          const todayDateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-eve`;
          const lastEveAlert = localStorage.getItem('cs_last_eve_alert');

          if (lastEveAlert !== todayDateKey) {
            const nextDay = getNextDayInfo(now);
            const tomorrowCourses = courses
              .filter(c => c.day === nextDay.dayIdx && isCourseInWeek(nextDay.weekNo, c.weeks))
              .sort((a, b) => a.s - b.s);

            if (tomorrowCourses.length > 0) {
              const firstC = tomorrowCourses[0];
              localStorage.setItem('cs_last_eve_alert', todayDateKey);

              setActiveSundayEveAlert({
                firstCourse: firstC,
                tomorrowCoursesCount: tomorrowCourses.length,
                nextWeekNo: nextDay.weekNo,
              });

              if (remindSettings.sound) {
                playReminderBeep();
              }

              if (remindSettings.sys && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                try {
                  new Notification(
                    nextDay.isMonday
                      ? `🔔 周日晚间提醒 · 明天周一有课 (${SLOTS[firstC.s].s})`
                      : `🔔 晚间早课预告 · 明天早晨有课 (${SLOTS[firstC.s].s})`,
                    {
                      body: `首节课《${firstC.name}》第${firstC.s}-${firstC.e}节 ｜ @${firstC.room || '待定'} ｜ 明日共 ${tomorrowCourses.length} 门课程，课表已提前就绪！`,
                      icon: '/icon.svg',
                    }
                  );
                } catch (e) {}
              }
            }
          }
        }
      }
    };

    checkReminders();
    const timer = setInterval(checkReminders, 20000);
    return () => clearInterval(timer);
  }, [currentUser, courses, remindSettings, notifiedCourseIds]);

  const handleTriggerTestReminder = () => {
    const testCourse: Course = courses[0] || {
      id: 9999,
      name: '计算机网络（测试课）',
      teacher: '郑晓东',
      room: '明理9-310',
      day: (new Date().getDay() + 6) % 7,
      s: 3,
      e: 4,
      color: '#4f63e8',
    };

    if (remindSettings.inapp) {
      setActiveReminderCourse(testCourse);
    }
    if (remindSettings.sound) {
      playReminderBeep();
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([250, 100, 250]);
      } catch {}
    }
    if (remindSettings.sys && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(`测试提醒：还有 ${remindSettings.lead} 分钟上课`, {
          body: `${testCourse.name} ｜ ${SLOTS[testCourse.s].s} 开始 ｜ @${testCourse.room}`,
          icon: '/icon.svg',
        });
      } catch (e) {}
    }
    showToast('课前即时提醒测试已发出！');
  };

  const handleTriggerSundayTestReminder = () => {
    const now = new Date();
    const nextDay = getNextDayInfo(now);
    const tomorrowCourses = courses
      .filter(c => c.day === nextDay.dayIdx && isCourseInWeek(nextDay.weekNo, c.weeks))
      .sort((a, b) => a.s - b.s);

    const firstC = tomorrowCourses[0] || courses[0] || {
      id: 2000,
      name: 'Web编程技术（周一首节）',
      teacher: '葛江玲',
      room: '博学1-101-102-专业机房1',
      day: 0,
      s: 1,
      e: 2,
      color: '#4f63e8',
    };

    setActiveSundayEveAlert({
      firstCourse: firstC,
      tomorrowCoursesCount: tomorrowCourses.length || 3,
      nextWeekNo: nextDay.isMonday ? nextDay.weekNo : Math.max(1, Math.min(25, getWeekNo(now))) + 1,
    });

    if (remindSettings.sound) {
      playReminderBeep();
    }

    if (remindSettings.sys && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(`🔔【周日晚提醒】明天（周一）08:20 有课 · ${firstC.name}`, {
          body: `第${firstC.s}-${firstC.e}节 @${firstC.room || '待定'} · 新一周课表已提前为您更新！`,
          icon: '/icon.svg',
        });
      } catch (e) {}
    }
    showToast('周日晚间早课提醒测试已触发！');
  };

  const handleSaveCourse = async (courseData: Omit<Course, 'id'>, id?: number) => {
    if (id) {
      await api.updateCourse(id, courseData);
    } else {
      await api.addCourse(courseData);
    }
    await loadAllUserData();
  };

  const handleDeleteCourse = async (id: number) => {
    await api.deleteCourse(id);
    await loadAllUserData();
  };

  const handleAddHw = async (courseName: string, title: string, due?: string) => {
    await api.addHomework({ course: courseName, title, due });
    const list = await api.getHomework();
    setHomework(list);
  };

  const handleBatchAddHw = async (items: { course: string; title: string; due?: string }[]) => {
    if (!items || !items.length) return;
    let newCount = 0;
    let updatedCount = 0;

    // Fetch freshest homework to compare
    let currentHw = homework;
    try {
      currentHw = await api.getHomework();
    } catch (e) {}

    // Smart matching helper to identify duplicates and platform-prefixed variants
    const cleanTitleForMatching = (title: string): string => {
      return (title || '')
        .trim()
        .toLowerCase()
        .replace(/^\[.*?\]\s*/, '')
        .replace(/^(学习通|超星学习通|课堂派|pta|明理云盘|云盘)[\s:：\-_]*/i, '')
        .replace(/[\s:：\-_]*(学习通|超星学习通|课堂派|pta|明理云盘|云盘)$/i, '')
        .replace(/[\s\-_—~.,，。！!？?~、:：#*]+/g, '');
    };

    const isSameHomework = (courseA: string, titleA: string, courseB: string, titleB: string): boolean => {
      const cA = (courseA || '').trim().toLowerCase();
      const cB = (courseB || '').trim().toLowerCase();
      if (cA !== cB && !cA.includes(cB) && !cB.includes(cA)) {
        return false;
      }

      const rawA = (titleA || '').trim().toLowerCase();
      const rawB = (titleB || '').trim().toLowerCase();
      if (rawA === rawB) return true;

      const cleanA = cleanTitleForMatching(titleA);
      const cleanB = cleanTitleForMatching(titleB);
      if (!cleanA || !cleanB) return false;
      if (cleanA === cleanB) return true;

      if (cleanA.length >= 4 && cleanB.length >= 4) {
        if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) return true;
      }

      const normA = cleanA.replace(/三/g, '3').replace(/四/g, '4').replace(/一/g, '1').replace(/二/g, '2');
      const normB = cleanB.replace(/三/g, '3').replace(/四/g, '4').replace(/一/g, '1').replace(/二/g, '2');
      if (normA === normB) return true;
      if (normA.length >= 4 && normB.length >= 4 && (normA.includes(normB) || normB.includes(normA))) return true;

      return false;
    };

    const matchesToDelete: number[] = [];
    const preservedDoneMap = new Map<string, boolean>();

    for (const item of items) {
      const cName = (item.course || '').trim();
      const tName = (item.title || '').trim();

      // Find all matching variants in student's current homework
      const matchingIds: number[] = [];
      let anyMatchDone = false;

      currentHw.forEach(h => {
        if (isSameHomework(h.course, h.title, cName, tName)) {
          matchingIds.push(h.id);
          if (h.done) anyMatchDone = true;
        }
      });

      if (matchingIds.length > 0) {
        updatedCount++;
        matchesToDelete.push(...matchingIds);
        preservedDoneMap.set(`${cName.toLowerCase()}__${tName.toLowerCase()}`, anyMatchDone);
        // Exclude matched items so they are not matched twice
        currentHw = currentHw.filter(h => !matchingIds.includes(h.id));
      } else {
        newCount++;
      }
    }

    // Call api.deleteHomework for each existing matched variant to completely prune covered records
    for (const id of Array.from(new Set(matchesToDelete))) {
      try {
        await api.deleteHomework(id);
      } catch (e) {}
    }

    // Carry over preserved done status if previously completed
    const itemsToInsert = items.map(it => {
      const cName = (it.course || '').trim().toLowerCase();
      const tName = (it.title || '').trim().toLowerCase();
      const done = preservedDoneMap.get(`${cName}__${tName}`);
      return done !== undefined ? { ...it, done } : it;
    });

    try {
      await api.batchAddHomework(itemsToInsert as any, false);
    } catch (e) {
      for (const item of itemsToInsert) {
        await api.addHomework(item as any);
      }
    }

    await loadAllUserData();
    showToast(`已成功同步 ${items.length} 项作业（新增 ${newCount} 项，覆盖更新 ${updatedCount} 项）`);
  };

  const handleToggleHw = async (id: number) => {
    const targetHw = homework.find(h => Number(h.id) === Number(id));
    if (!targetHw) return;
    const willBeDone = !targetHw.done;

    // 1. Optimistic instant local update
    setHomework(prev =>
      prev.map(h => (Number(h.id) === Number(id) ? { ...h, done: willBeDone } : h))
    );

    // 2. Bidirectional sync: when homework marked as completed, check matching uncompleted task with platform prefix compatibility
    const hwFormattedTitle = `[${targetHw.course}] ${targetHw.title}`.trim();
    const cleanHwTitle = targetHw.title
      .replace(/^\[.*?\]\s*/, '')
      .replace(/^(PTA|课堂派|超星学习通|学习通|明理云盘|云盘)[\s:：-]*/i, '')
      .trim();

    // Only auto-sync if we are marking it AS DONE
    const matchedTask = willBeDone
      ? tasks.find(t => {
          if (t.done) return false;
          const tTrim = t.title.trim();
          const cleanTaskTitle = tTrim
            .replace(/^\[.*?\]\s*/, '')
            .replace(/^(PTA|课堂派|超星学习通|学习通|明理云盘|云盘)[\s:：-]*/i, '')
            .trim();
          return (
            tTrim === hwFormattedTitle ||
            tTrim === targetHw.title.trim() ||
            tTrim === cleanHwTitle ||
            cleanTaskTitle === cleanHwTitle ||
            tTrim.includes(targetHw.title.trim()) ||
            targetHw.title.trim().includes(cleanTaskTitle)
          );
        })
      : null;

    if (matchedTask) {
      // Optimistically update matching task too
      setTasks(prev =>
        prev.map(t => (Number(t.id) === Number(matchedTask.id) ? { ...t, done: true } : t))
      );
      try {
        await Promise.all([
          api.toggleHomework(id),
          api.toggleTask(matchedTask.id),
        ]);
        const [freshHw, freshTasks] = await Promise.all([
          api.getHomework(),
          api.getTasks(),
        ]);
        setHomework(freshHw);
        setTasks(freshTasks);
        showToast(`已同步完成对应待办任务`);
      } catch (e: any) {
        await loadAllUserData();
        showToast('更新状态失败，请重试');
      }
    } else {
      try {
        await api.toggleHomework(id);
        const list = await api.getHomework();
        setHomework(list);
      } catch (e: any) {
        setHomework(prev =>
          prev.map(h => (Number(h.id) === Number(id) ? { ...h, done: targetHw.done } : h))
        );
        showToast('更新状态失败，请重试');
      }
    }
  };

  const handleDeleteHw = async (id: number) => {
    setHomework(prev => prev.filter(h => Number(h.id) !== Number(id)));
    try {
      await api.deleteHomework(id);
      showToast('已删除作业');
    } catch (e: any) {
      showToast('删除作业失败');
    }
    const list = await api.getHomework();
    setHomework(list);
  };

  const handleUpdateHomework = async (id: number, data: { course: string; title: string; due: string }) => {
    const updated = await api.updateHomework(id, data);
    setHomework(prev => prev.map(h => (Number(h.id) === Number(id) ? updated : h)));
    const list = await api.getHomework();
    setHomework(list);
  };

  const handleAddTask = async (title: string) => {
    const tempId = Date.now();
    const optimisticTask: TaskItem = {
      id: tempId,
      title: title.trim(),
      done: false,
      created_at: new Date().toISOString(),
    };
    setTasks(prev => [optimisticTask, ...prev]);

    try {
      await api.addTask(title.trim());
      const list = await api.getTasks();
      setTasks(list);
    } catch (err: any) {
      setTasks(prev => prev.filter(t => t.id !== tempId));
      throw err;
    }
  };

  const handleToggleTask = async (id: number) => {
    const target = tasks.find(t => Number(t.id) === Number(id));
    if (!target) return;
    const willBeDone = !target.done;

    // 1. Optimistic instant local update
    setTasks(prev =>
      prev.map(t => (Number(t.id) === Number(id) ? { ...t, done: willBeDone } : t))
    );

    // 2. Bidirectional sync: when task marked as completed, check matching uncompleted homework with platform prefix compatibility
    const targetTitle = target.title.trim();
    const cleanTargetTitle = targetTitle
      .replace(/^\[.*?\]\s*/, '')
      .replace(/^(PTA|课堂派|超星学习通|学习通|明理云盘|云盘)[\s:：-]*/i, '')
      .trim();

    const matchedHw = willBeDone
      ? homework.find(h => {
          if (h.done) return false;
          const hFormatted = `[${h.course}] ${h.title}`.trim();
          const hTitle = h.title.trim();
          const cleanHwTitle = hTitle
            .replace(/^\[.*?\]\s*/, '')
            .replace(/^(PTA|课堂派|超星学习通|学习通|明理云盘|云盘)[\s:：-]*/i, '')
            .trim();
          return (
            hFormatted === targetTitle ||
            hTitle === targetTitle ||
            cleanHwTitle === cleanTargetTitle ||
            targetTitle.includes(hTitle) ||
            hTitle.includes(cleanTargetTitle)
          );
        })
      : null;

    if (matchedHw) {
      // Optimistically update matching homework too
      setHomework(prev =>
        prev.map(h => (Number(h.id) === Number(matchedHw.id) ? { ...h, done: true } : h))
      );
      try {
        await Promise.all([
          api.toggleTask(id),
          api.toggleHomework(matchedHw.id),
        ]);
        const [freshTasks, freshHw] = await Promise.all([
          api.getTasks(),
          api.getHomework(),
        ]);
        setTasks(freshTasks);
        setHomework(freshHw);
        showToast(`已同步完成对应作业：${matchedHw.title}`);
      } catch (err: any) {
        await loadAllUserData();
        showToast('更新状态失败，请重试');
      }
    } else {
      try {
        await api.toggleTask(id);
        const list = await api.getTasks();
        setTasks(list);
      } catch (e: any) {
        setTasks(prev =>
          prev.map(t => (Number(t.id) === Number(id) ? { ...t, done: target.done } : t))
        );
        showToast('更新任务状态失败，请重试');
      }
    }
  };

  const handleJumpToFocusTask = (taskTitle: string) => {
    setFocusTaskTitle(taskTitle);
    setActiveTab('tasks');
  };

  const handleDeleteTask = async (id: number) => {
    setTasks(prev => prev.filter(t => Number(t.id) !== Number(id)));
    try {
      await api.deleteTask(id);
      showToast('已删除任务');
    } catch (e: any) {
      showToast('删除任务失败');
    }
    const list = await api.getTasks();
    setTasks(list);
  };

  const handleResetTemplate = async () => {
    try {
      const resetCourses = await api.resetTemplateCourses();
      setCourses(resetCourses);
      await loadAllUserData();
      showToast('25 门示例课表已同步至云端 D1');
    } catch (e: any) {
      showToast(e.message || '重置失败');
    }
  };

  const handleImportPresetHw = async () => {
    try {
      const pool = await api.getConsoleHomeworkTemplates();
      if (!pool || pool.length === 0) {
        showToast('官方作业池当前暂无作业，请先在管理终端发布或同步');
        return;
      }
      await handleBatchAddHw(pool);
      showToast(`已从官方作业池同步 ${pool.length} 项作业`);
    } catch (e: any) {
      showToast(e.message || '导入作业失败');
    }
  };

  const handleImportPresetTasks = async () => {
    try {
      await api.batchAddTasks(SAMPLE_TASKS, false);
      await loadAllUserData();
      showToast('4 项示例任务已同步至云端 D1');
    } catch (e: any) {
      showToast(e.message || '导入任务失败');
    }
  };

  const handleExportData = () => {
    if (!currentUser) return;
    const backup = {
      username: currentUser.username,
      name: currentUser.name,
      courses,
      homework,
      tasks,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `课程表备份-${currentUser.name || currentUser.username}.json`;
    a.click();
    showToast('课表数据已导出为 JSON 文件');
  };

  const handleClearData = async () => {
    if (!window.confirm('确定要清空所有课表与数据吗？此操作不可撤销。')) return;

    try {
      showToast('正在清空数据，请稍候...');
      await api.batchReplaceCourses([]);
      for (const h of homework) await api.deleteHomework(h.id);
      for (const t of tasks) await api.deleteTask(t.id);
      await loadAllUserData();
      showToast('所有数据已成功清空');
    } catch (e: any) {
      showToast(e.message || '清空失败，请重试');
    }
  };

  const handleConfirmPdfImport = async (newCourses: Course[]) => {
    await api.batchReplaceCourses(newCourses);
    await loadAllUserData();
  };

  const pendingHwCount = homework.filter(h => !h.done).length;
  const pendingTaskCount = tasks.filter(t => !t.done).length;

  // PWA Badging API - Sync unread homework & tasks to desktop app icon
  useEffect(() => {
    const badgeCount = pendingHwCount + pendingTaskCount;
    if (typeof navigator !== 'undefined' && (navigator as any).setAppBadge) {
      if (badgeCount > 0) {
        (navigator as any).setAppBadge(badgeCount).catch(() => {});
      } else {
        (navigator as any).clearAppBadge().catch(() => {});
      }
    }
  }, [pendingHwCount, pendingTaskCount]);

  // Handle URL change / shortcuts popstate
  useEffect(() => {
    const handleUrlTab = () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const tabParam = searchParams.get('tab');
        if (tabParam && ['today', 'week', 'hw', 'tasks', 'mine', 'widget', 'remind'].includes(tabParam)) {
          setActiveTab(tabParam as any);
        }
      } catch (e) {}
    };
    handleUrlTab();
    window.addEventListener('popstate', handleUrlTab);
    return () => window.removeEventListener('popstate', handleUrlTab);
  }, []);

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1d1f24] text-[#e9e4d8]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#6b7cff] border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="font-editorial text-sm tracking-widest">掌上课表 正在加载...</div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <div className="editorial-paper-bg" />
        <AuthView onLoginSuccess={handleLoginSuccess} toast={showToast} />
        {toastMsg && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#e9e4d8] text-[#1d1f24] font-editorial text-xs font-bold py-2 px-5 shadow-2xl tracking-wider rounded-sm animate-fade-in border border-black">
            {toastMsg}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="relative h-[100dvh] bg-[#1d1f24] text-[#e9e4d8] font-sans overflow-hidden">
      {/* Background Paper Texture */}
      <div className="editorial-paper-bg" />

      {/* Main Container constrained to Mobile App Viewport */}
      <div className="relative z-10 max-w-[480px] mx-auto h-[100dvh] flex flex-col bg-[#1d1f24] shadow-2xl border-x border-[#2a2d34]/40 overflow-hidden">
        {/* Top In-App Install Prompt Bar */}
        <div className="shrink-0 z-30">
          <PWAInstallBar />
        </div>

        {/* Lightweight Top Status Bar - Only shown on Timetable or Profile tabs to save vertical space on Today, Homework, Tasks */}
        {(activeTab === 'week' || activeTab === 'mine') && (
          <div className="px-4 py-1.5 flex items-center justify-between border-b border-[#33363d]/40 bg-[#17191e]/90 shrink-0 text-xs select-none">
            <div className="flex items-center gap-1.5 font-mono text-[10.5px] text-[#8f8b80]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[#c4c0b6]">D1 云端</span>
              <span className="text-[#45474e]">·</span>
              <span>{courses.length}课 / {homework.length}作业 / {tasks.length}任务</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsDoctorModalOpen(true)}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold text-[#8ea4ff] hover:text-white hover:bg-[#6b7cff]/30 transition-all cursor-pointer border border-[#6b7cff]/30 active:scale-95"
                title="浏览器能力诊断中心"
              >
                <span>内核诊断</span>
              </button>
              {currentUser.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => setIsDataManagementOpen(true)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold text-[#6b7cff] hover:text-white hover:bg-[#6b7cff]/30 transition-all cursor-pointer border border-[#6b7cff]/30 active:scale-95"
                  title="数据管理与一键导入 (管理员)"
                >
                  <Database className="w-2.5 h-2.5" />
                  <span>数据管理</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Scrollable Tab Page Container */}
        <main className="flex-1 overflow-y-auto px-4.5 pt-3 pb-6 overscroll-contain">
          {activeTab === 'today' && (
            <TodayTab
              user={currentUser}
              courses={courses}
              homework={homework}
              notices={notices}
              dismissedNoticeId={dismissedNoticeId}
              onDismissNotice={id => setDismissedNoticeId(id)}
              onOpenCourse={c => {
                setActiveCourseModal(c);
                setCoursePreset(null);
              }}
              onOpenWeekSchedule={() => setActiveTab('week')}
              onOpenDataManagement={currentUser.role === 'admin' ? () => setIsDataManagementOpen(true) : undefined}
              onImportPreset={handleResetTemplate}
            />
          )}

          {activeTab === 'week' && (
            <TimetableTab
              courses={courses}
              homework={homework}
              onOpenCourse={c => {
                setActiveCourseModal(c);
                setCoursePreset(null);
              }}
              onQuickAdd={(day, slot, week) => {
                setActiveCourseModal(null);
                setCoursePreset({
                  day,
                  s: slot,
                  e: Math.min(11, slot + 1),
                  weeks: `${week}-${week}周`,
                });
              }}
              onRefreshCourses={loadAllUserData}
              onOpenDataManagement={currentUser.role === 'admin' ? () => setIsDataManagementOpen(true) : undefined}
              onImportPreset={handleResetTemplate}
              sundayAutoAdvance={remindSettings.sundayAutoAdvance}
              toast={showToast}
            />
          )}

          {activeTab === 'hw' && (
            <HomeworkTab
              user={currentUser}
              courses={courses}
              homework={homework}
              tasks={tasks}
              onAdd={handleAddHw}
              onBatchAdd={handleBatchAddHw}
              onToggle={handleToggleHw}
              onDelete={handleDeleteHw}
              onUpdate={handleUpdateHomework}
              onAddTask={handleAddTask}
              onJumpToFocusTask={handleJumpToFocusTask}
              onImportPreset={handleImportPresetHw}
              toast={showToast}
            />
          )}

          {activeTab === 'tasks' && (
            <TasksTab
              tasks={tasks}
              onAddTask={handleAddTask}
              onToggleTask={handleToggleTask}
              onDeleteTask={handleDeleteTask}
              onRefreshTasks={loadAllUserData}
              onImportPresetTasks={handleImportPresetTasks}
              focusTaskTitle={focusTaskTitle}
              setFocusTaskTitle={setFocusTaskTitle}
              toast={showToast}
            />
          )}

          {activeTab === 'mine' && (
            <ProfileTab
              user={currentUser}
              remindSettings={remindSettings}
              pendingHwCount={pendingHwCount}
              pendingTaskCount={pendingTaskCount}
              onLogout={handleLogout}
              onOpenAdmin={() => setIsAdminTerminalOpen(true)}
              onOpenDataManagement={currentUser.role === 'admin' ? () => setIsDataManagementOpen(true) : undefined}
              onSwitchTab={tab => setActiveTab(tab)}
              onResetTemplate={handleResetTemplate}
              onExportData={handleExportData}
              onClearData={handleClearData}
              onSelectPdfFile={f => setPdfFileToImport(f)}
              onUpdateUser={u => setCurrentUser(u)}
              onOpenDoctor={() => setIsDoctorModalOpen(true)}
              toast={showToast}
            />
          )}

          {activeTab === 'widget' && (
            <WidgetTab
              user={currentUser}
              courses={courses}
              homework={homework}
              leadMinutes={remindSettings.lead}
              toast={showToast}
              onOpenCourse={c => {
                setActiveCourseModal(c);
                setCoursePreset(null);
              }}
            />
          )}

          {activeTab === 'remind' && (
            <ReminderTab
              settings={remindSettings}
              onUpdateSettings={updateRemindSettings}
              courses={courses}
              onTriggerTestReminder={handleTriggerTestReminder}
              onTriggerSundayTestReminder={handleTriggerSundayTestReminder}
              onOpenDoctor={() => setIsDoctorModalOpen(true)}
              toast={showToast}
            />
          )}
        </main>

        {/* Bottom Tab Navigation Bar */}
        <nav className="shrink-0 z-30 flex bg-[#22242a] border-t-2 border-[#e9e4d8] text-[10px] tracking-widest font-semibold select-none pb-[env(safe-area-inset-bottom)] shadow-2xl">
          <button
            onClick={() => setActiveTab('today')}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 transition-colors relative cursor-pointer ${
              activeTab === 'today' ? 'text-[#e9e4d8]' : 'text-[#7a766c]'
            }`}
          >
            {activeTab === 'today' && (
              <span className="absolute top-0 left-[26%] right-[26%] h-1 bg-[#6b7cff]" />
            )}
            <CalendarDays className="w-5 h-5 mb-1" />
            <span>今日</span>
          </button>

          <button
            onClick={() => setActiveTab('week')}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 transition-colors relative cursor-pointer ${
              activeTab === 'week' ? 'text-[#e9e4d8]' : 'text-[#7a766c]'
            }`}
          >
            {activeTab === 'week' && (
              <span className="absolute top-0 left-[26%] right-[26%] h-1 bg-[#6b7cff]" />
            )}
            <LayoutGrid className="w-5 h-5 mb-1" />
            <span>课程表</span>
          </button>

          <button
            onClick={() => setActiveTab('hw')}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 transition-colors relative cursor-pointer ${
              activeTab === 'hw' ? 'text-[#e9e4d8]' : 'text-[#7a766c]'
            }`}
          >
            {activeTab === 'hw' && (
              <span className="absolute top-0 left-[26%] right-[26%] h-1 bg-[#6b7cff]" />
            )}
            <FileCheck2 className="w-5 h-5 mb-1" />
            <span>作业</span>
            {pendingHwCount > 0 && (
              <span className="absolute top-1 right-[calc(50%-18px)] px-1 bg-[#ff6b57] text-white text-[9px] font-bold rounded-full min-w-[15px] h-[15px] flex items-center justify-center">
                {pendingHwCount > 99 ? '99' : pendingHwCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 transition-colors relative cursor-pointer ${
              activeTab === 'tasks' ? 'text-[#e9e4d8]' : 'text-[#7a766c]'
            }`}
          >
            {activeTab === 'tasks' && (
              <span className="absolute top-0 left-[26%] right-[26%] h-1 bg-[#6b7cff]" />
            )}
            <CheckSquare className="w-5 h-5 mb-1" />
            <span>任务</span>
            {pendingTaskCount > 0 && (
              <span className="absolute top-1 right-[calc(50%-18px)] px-1 bg-[#6b7cff] text-white text-[9px] font-bold rounded-full min-w-[15px] h-[15px] flex items-center justify-center">
                {pendingTaskCount > 99 ? '99' : pendingTaskCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('mine')}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 transition-colors relative cursor-pointer ${
              activeTab === 'mine' || activeTab === 'widget' || activeTab === 'remind'
                ? 'text-[#e9e4d8]'
                : 'text-[#7a766c]'
            }`}
          >
            {(activeTab === 'mine' || activeTab === 'widget' || activeTab === 'remind') && (
              <span className="absolute top-0 left-[26%] right-[26%] h-1 bg-[#6b7cff]" />
            )}
            <UserIcon className="w-5 h-5 mb-1" />
            <span>我的</span>
          </button>
        </nav>
      </div>

      {/* Sunday Evening Class Alert Modal */}
      {activeSundayEveAlert && (
        <SundayEveModal
          firstCourse={activeSundayEveAlert.firstCourse}
          tomorrowCoursesCount={activeSundayEveAlert.tomorrowCoursesCount}
          nextWeekNo={activeSundayEveAlert.nextWeekNo}
          onClose={() => setActiveSundayEveAlert(null)}
          onViewMonday={() => {
            setActiveTab('today');
            setActiveSundayEveAlert(null);
          }}
          onViewWeekTimetable={() => {
            setActiveTab('week');
            setActiveSundayEveAlert(null);
          }}
        />
      )}

      {/* Floating Reminder Card */}
      {activeReminderCourse && (
        <ReminderToast
          course={activeReminderCourse}
          onDismiss={() => setActiveReminderCourse(null)}
          onClick={() => {
            setActiveTab('today');
            setActiveReminderCourse(null);
          }}
        />
      )}

      {/* Course Modal */}
      {(activeCourseModal || coursePreset) && (
        <CourseModal
          course={activeCourseModal}
          preset={coursePreset}
          existingCourses={courses}
          homework={homework}
          onToggleHomework={handleToggleHw}
          onSave={handleSaveCourse}
          onDelete={handleDeleteCourse}
          onClose={() => {
            setActiveCourseModal(null);
            setCoursePreset(null);
          }}
          toast={showToast}
        />
      )}

      {/* PDF Import Modal */}
      {pdfFileToImport && (
        <PdfImportModal
          pdfFile={pdfFileToImport}
          onConfirmImport={handleConfirmPdfImport}
          onClose={() => setPdfFileToImport(null)}
          toast={showToast}
        />
      )}

      {/* Terminal Modal */}
      {isAdminTerminalOpen && (
        <AdminTerminalModal
          onClose={() => setIsAdminTerminalOpen(false)}
          toast={showToast}
          onRefreshParent={loadAllUserData}
        />
      )}

      {/* Cloud Data Management Modal (Terminal Admin Only) */}
      {currentUser.role === 'admin' && (
        <DataManagementModal
          isOpen={isDataManagementOpen}
          onClose={() => setIsDataManagementOpen(false)}
          courses={courses}
          homework={homework}
          tasks={tasks}
          onRefresh={loadAllUserData}
          toast={showToast}
        />
      )}

      {/* Browser Doctor Modal */}
      <BrowserDoctorModal
        isOpen={isDoctorModalOpen}
        onClose={() => setIsDoctorModalOpen(false)}
        toast={showToast}
      />

      {/* Floating Pomodoro Widget when timer is running */}
      <FloatingPomodoroWidget setActiveTab={setActiveTab} />

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#e9e4d8] text-[#1d1f24] font-editorial text-xs font-bold py-2 px-5 shadow-2xl tracking-wider rounded-sm border border-black animate-fade-in">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
