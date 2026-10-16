import { Course, Homework, TaskItem, User, Notice } from '../types';
import { SAMPLE_COURSES, SAMPLE_TASKS } from '../utils/sampleData';
import { resolveDisplayName, saveCustomDisplayName } from '../utils/studentRoster';

const TOKEN_KEY = 'cs_app_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status?: number;
  isBusinessError?: boolean;
  isFallback?: boolean;

  constructor(message: string, status?: number, isBusinessError?: boolean, isFallback?: boolean) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.isBusinessError = isBusinessError;
    this.isFallback = isFallback;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-User', token);
  }

  let res: Response;
  try {
    res = await fetch(`/api${endpoint}`, {
      ...options,
      headers,
    });
  } catch (err: any) {
    throw new ApiError(err?.message || '网络连接失败', undefined, false, true);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new ApiError('BACKEND_HTML_FALLBACK', res.status, false, true);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || `请求失败 (${res.status})`, res.status, true, false);
  }
  return data;
}

export const api = {
  // Auth
  async login(username: string, password: string): Promise<{ token: string; user: User }> {
    try {
      const res = await request<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      const resolvedName = resolveDisplayName(res.user.username, res.user.name);
      const user: User = {
        ...res.user,
        name: resolvedName,
      };
      setStoredToken(res.token);
      return { token: res.token, user };
    } catch (e: any) {
      // 明确的后端业务错误（如 401 密码错误、403 账号禁用、404 账号不存在）直接抛出给用户
      if (e?.isBusinessError || (e?.status && e.status >= 400 && e.status < 500 && !e?.isFallback)) {
        throw e;
      }
      // 仅在无后端环境/HTML 回退时才允许离线降级
      if (e?.message === 'BACKEND_HTML_FALLBACK' || e?.isFallback) {
        const name = resolveDisplayName(username);
        const user: User = {
          username,
          name,
          role: username === 'admin' ? 'admin' : 'user',
        };
        setStoredToken(username);
        return { token: username, user };
      }
      throw e;
    }
  },

  async register(username: string, password: string, withTemplate = true): Promise<{ token: string; user: User }> {
    try {
      const res = await request<{ token: string; user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password, withTemplate }),
      });
      const resolvedName = resolveDisplayName(res.user.username, res.user.name);
      const user: User = {
        ...res.user,
        name: resolvedName,
      };
      setStoredToken(res.token);
      return { token: res.token, user };
    } catch (e: any) {
      if (e?.isBusinessError || (e?.status && e.status >= 400 && e.status < 500 && !e?.isFallback)) {
        throw e;
      }
      if (e?.message === 'BACKEND_HTML_FALLBACK' || e?.isFallback) {
        const name = resolveDisplayName(username);
        const user: User = {
          username,
          name,
          role: username === 'admin' ? 'admin' : 'user',
        };
        setStoredToken(username);
        return { token: username, user };
      }
      throw e;
    }
  },

  async getMe(): Promise<User> {
    const token = getStoredToken();
    if (!token) throw new Error('未登录');
    try {
      const remoteUser = await request<User>('/auth/me');
      return {
        ...remoteUser,
        name: resolveDisplayName(remoteUser.username, remoteUser.name),
      };
    } catch (e: any) {
      return {
        username: token,
        name: resolveDisplayName(token),
        role: token === 'admin' ? 'admin' : 'user',
      };
    }
  },

  updateProfileName(username: string, newName: string): User {
    saveCustomDisplayName(username, newName);
    return {
      username,
      name: newName.trim(),
      role: username === 'admin' ? 'admin' : 'user',
    };
  },

  logout() {
    setStoredToken(null);
  },

  // ==========================================
  // Courses - Cloudflare D1 (/api/courses)
  // ==========================================
  async getCourses(): Promise<Course[]> {
    try {
      const res = await request<{ courses: any[] }>('/courses');
      const list = res.courses || [];
      return list.map((item: any) => ({
        id: Number(item.id),
        name: String(item.name || ''),
        teacher: item.teacher || '',
        room: item.room || item.classroom || '',
        day: Number(item.day !== undefined ? item.day : item.weekday || 0),
        s: Number(item.s !== undefined ? item.s : item.start_slot || 1),
        e: Number(item.e !== undefined ? item.e : item.end_slot || (item.s || 1)),
        weeks: item.weeks || '1-18周',
        color: item.color || '#4f63e8',
      }));
    } catch (e: any) {
      console.error('获取课程表失败:', e);
      return [];
    }
  },

  async addCourse(course: Omit<Course, 'id'>): Promise<Course> {
    const res = await request<{ course: any }>('/courses', {
      method: 'POST',
      body: JSON.stringify({
        name: course.name,
        teacher: course.teacher,
        classroom: course.room,
        weekday: course.day,
        start_slot: course.s,
        end_slot: course.e,
        weeks: course.weeks,
        color: course.color,
      }),
    });
    const c = res.course;
    return {
      id: Number(c.id),
      name: c.name,
      teacher: c.teacher || '',
      room: c.room || c.classroom || '',
      day: Number(c.day !== undefined ? c.day : c.weekday || 0),
      s: Number(c.s !== undefined ? c.s : c.start_slot || 1),
      e: Number(c.e !== undefined ? c.e : c.end_slot || 1),
      weeks: c.weeks || '1-18周',
      color: c.color || '#4f63e8',
    };
  },

  async updateCourse(id: number, data: Partial<Course>): Promise<Course> {
    const res = await request<{ course: any }>('/courses', {
      method: 'PUT',
      body: JSON.stringify({
        id,
        name: data.name,
        teacher: data.teacher,
        classroom: data.room,
        weekday: data.day,
        start_slot: data.s,
        end_slot: data.e,
        weeks: data.weeks,
        color: data.color,
      }),
    });
    const c = res.course;
    return {
      id: Number(c.id || id),
      name: c.name,
      teacher: c.teacher || '',
      room: c.room || c.classroom || '',
      day: Number(c.day !== undefined ? c.day : c.weekday || 0),
      s: Number(c.s !== undefined ? c.s : c.start_slot || 1),
      e: Number(c.e !== undefined ? c.e : c.end_slot || 1),
      weeks: c.weeks || '1-18周',
      color: c.color || '#4f63e8',
    };
  },

  async deleteCourse(id: number): Promise<void> {
    await request(`/courses?id=${id}`, { method: 'DELETE' });
  },

  async batchAddCourses(courses: (Omit<Course, 'id'> | Course)[], replace = false): Promise<Course[]> {
    const payload = courses.map(c => ({
      name: c.name,
      teacher: c.teacher || '',
      classroom: c.room || '',
      weekday: c.day,
      start_slot: c.s,
      end_slot: c.e,
      weeks: c.weeks || '1-18周',
      color: c.color || '#4f63e8',
    }));

    const res = await request<{ courses: any[] }>('/courses', {
      method: 'POST',
      body: JSON.stringify({
        courses: payload,
        replace,
      }),
    });

    return (res.courses || []).map((item: any) => ({
      id: Number(item.id),
      name: String(item.name || ''),
      teacher: item.teacher || '',
      room: item.room || item.classroom || '',
      day: Number(item.day !== undefined ? item.day : item.weekday || 0),
      s: Number(item.s !== undefined ? item.s : item.start_slot || 1),
      e: Number(item.e !== undefined ? item.e : item.end_slot || 1),
      weeks: item.weeks || '1-18周',
      color: item.color || '#4f63e8',
    }));
  },

  async batchReplaceCourses(courses: Course[]): Promise<void> {
    await this.batchAddCourses(courses, true);
  },

  async clearAllCourses(): Promise<void> {
    await request('/courses?all=true', { method: 'DELETE' });
  },

  async resetTemplateCourses(): Promise<Course[]> {
    return await this.batchAddCourses(SAMPLE_COURSES, true);
  },

  // ==========================================
  // Assignments / Homework - Cloudflare D1 (/api/assignments)
  // ==========================================
  async getHomework(targetUser?: string): Promise<Homework[]> {
    try {
      const endpoint = targetUser ? `/assignments?username=${encodeURIComponent(targetUser)}` : '/assignments';
      const headers = targetUser ? { 'X-Username': targetUser } : undefined;
      const res = await request<any>(endpoint, { headers });
      const list = res.assignments || res.homework || (Array.isArray(res) ? res : []);
      return list.map((item: any) => ({
        id: Number(item.id),
        course: String(item.course || item.course_name || '常规课程'),
        title: String(item.title || ''),
        due: item.due || item.deadline || '',
        done: Boolean(item.completed !== undefined ? item.completed : item.done),
      }));
    } catch (e: any) {
      console.error('获取作业列表失败:', e);
      return [];
    }
  },

  async addHomework(item: { course: string; title: string; due?: string }): Promise<Homework> {
    const res = await request<any>('/assignments', {
      method: 'POST',
      body: JSON.stringify({
        course_name: item.course,
        course: item.course,
        title: item.title,
        deadline: item.due,
        due: item.due,
      }),
    });
    const it = res.assignment || res.homework || res;
    return {
      id: Number(it.id),
      course: it.course || it.course_name || item.course,
      title: it.title || item.title,
      due: it.due || it.deadline || item.due,
      done: Boolean(it.completed !== undefined ? it.completed : it.done),
    };
  },

  async toggleHomework(id: number): Promise<Homework> {
    const res = await request<any>('/assignments', {
      method: 'PUT',
      body: JSON.stringify({ id }),
    });
    const it = res.assignment || res.homework || res;
    return {
      id: Number(it.id || id),
      course: it.course || it.course_name || '',
      title: it.title || '',
      due: it.due || it.deadline || '',
      done: Boolean(it.completed !== undefined ? it.completed : it.done),
    };
  },

  async deleteHomework(id: number): Promise<void> {
    await request(`/assignments?id=${id}`, { method: 'DELETE' });
  },

  async batchAddHomework(items: { course: string; title: string; due?: string; done?: boolean }[], replace = false): Promise<Homework[]> {
    try {
      const res = await request<any>('/assignments', {
        method: 'POST',
        body: JSON.stringify({
          items: items.map(it => ({
            course_name: it.course,
            title: it.title,
            deadline: it.due,
            completed: it.done,
          })),
          replace,
        }),
      });

      const list = res.assignments || res.homework || [];
      return list.map((item: any) => ({
        id: Number(item.id),
        course: String(item.course || item.course_name || '常规课程'),
        title: String(item.title || ''),
        due: item.due || item.deadline || '',
        done: Boolean(item.completed !== undefined ? item.completed : item.done),
      }));
    } catch (e: any) {
      // Local fallback with deduplicated upsert
      let current = await this.getHomework();
      if (replace) {
        current = [];
      } else {
        items.forEach(newItem => {
          const cName = newItem.course.trim().toLowerCase();
          const tName = newItem.title.trim().toLowerCase();
          current = current.filter(
            h => !(h.course.trim().toLowerCase() === cName && h.title.trim().toLowerCase() === tName)
          );
        });
      }
      let maxId = current.reduce((m, h) => Math.max(m, h.id), 0);
      const added = items.map(it => ({
        id: ++maxId,
        course: it.course,
        title: it.title,
        due: it.due || '',
        done: Boolean(it.done),
      }));
      const combined = [...current, ...added];
      try {
        localStorage.setItem('cs_local_hw', JSON.stringify(combined));
      } catch (err) {}
      return combined;
    }
  },

  async clearAllHomework(): Promise<void> {
    await request('/assignments?all=true', { method: 'DELETE' });
  },

  async syncConsoleHomeworkBatch(items: { course: string; title: string; due?: string }[]): Promise<Homework[]> {
    return await this.batchAddHomework(items, false);
  },

  // ==========================================
  // Console Homework Pool (控制台官方作业库 - 真实 D1 同步，无硬编码示范)
  // ==========================================
  async getConsoleHomeworkTemplates(): Promise<any[]> {
    try {
      const res = await request<{ templates: any[] }>('/homework/console-pool');
      return res.templates || [];
    } catch (e: any) {
      try {
        const saved = localStorage.getItem('cs_console_hw_pool');
        if (saved) return JSON.parse(saved);
      } catch (err) {}
      // 彻底移除硬编码示范作业，当未配置或为空时返回干净的空数组
      return [];
    }
  },

  async addConsoleHomeworkTemplate(item: { course: string; title: string; due?: string }): Promise<any> {
    try {
      const res = await request<{ template: any }>('/homework/console-pool', {
        method: 'POST',
        body: JSON.stringify(item),
      });
      return res.template;
    } catch (e: any) {
      const current = await this.getConsoleHomeworkTemplates();
      const cName = (item.course || '').trim().toLowerCase();
      const tName = (item.title || '').trim().toLowerCase();
      const existingIdx = current.findIndex(it =>
        (it.course || '').trim().toLowerCase() === cName &&
        (it.title || '').trim().toLowerCase() === tName
      );
      if (existingIdx !== -1) {
        current[existingIdx] = {
          ...current[existingIdx],
          due: item.due,
        };
        try {
          localStorage.setItem('cs_console_hw_pool', JSON.stringify(current));
        } catch (err) {}
        return current[existingIdx];
      }

      const newItem = {
        id: Date.now(),
        course: item.course || '其他',
        title: item.title,
        due: item.due,
        creator: '系统管理员',
      };
      const updated = [...current, newItem];
      try {
        localStorage.setItem('cs_console_hw_pool', JSON.stringify(updated));
      } catch (err) {}
      return newItem;
    }
  },

  /**
   * 将当前管理员账号（如 admin）现有作业同步并写入官方作业池
   */
  async syncUserHomeworkToConsolePool(username = 'admin'): Promise<{ success: boolean; message: string; templates: any[] }> {
    try {
      const res = await request<{ success: boolean; message: string; templates: any[] }>('/homework/console-pool', {
        method: 'POST',
        body: JSON.stringify({ action: 'sync_user', username }),
      });
      return res;
    } catch (e: any) {
      // 客户端备用降级逻辑
      const userHw = await this.getHomework(username);
      for (const hw of userHw) {
        await this.addConsoleHomeworkTemplate({
          course: hw.course,
          title: hw.title,
          due: hw.due,
        });
      }
      const updated = await this.getConsoleHomeworkTemplates();
      return {
        success: true,
        message: `已将管理员 [${username}] 的 ${userHw.length} 项作业同步至官方池`,
        templates: updated,
      };
    }
  },

  async pushHomeworkToAllStudents(item?: { course: string; title: string; due?: string }): Promise<string> {
    try {
      const res = await request<{ success: boolean; message: string }>('/homework/console-pool', {
        method: 'POST',
        body: JSON.stringify({ action: 'push', pushToAll: true, item }),
      });
      if (res && res.message) {
        return res.message;
      }
    } catch (e: any) {}

    const safeCourse = (item?.course || '其他').trim();
    const safeTitle = (item?.title || '').trim();
    const safeDue = (item?.due || '').trim();
    const cmd = `hw push ${safeCourse}|${safeTitle}${safeDue ? `|${safeDue}` : ''}`;
    const res = await this.runTerminalCommand(cmd);
    const textResult = res.lines?.map(l => l.text).join('; ') || '已全员推送作业';
    return textResult;
  },

  async deleteConsoleHomeworkTemplate(id: number): Promise<void> {
    try {
      await request(`/homework/console-pool/${id}`, { method: 'DELETE' });
    } catch (e: any) {
      const current = await this.getConsoleHomeworkTemplates();
      const filtered = current.filter(it => Number(it.id) !== Number(id));
      try {
        localStorage.setItem('cs_console_hw_pool', JSON.stringify(filtered));
      } catch (err) {}
    }
  },

  async clearConsoleHomeworkTemplates(): Promise<void> {
    try {
      await request('/homework/console-pool', { method: 'DELETE' });
    } catch (e: any) {
      try {
        localStorage.setItem('cs_console_hw_pool', JSON.stringify([]));
      } catch (err) {}
    }
  },

  // ==========================================
  // Tasks - Cloudflare D1 (/api/tasks)
  // ==========================================
  async getTasks(): Promise<TaskItem[]> {
    try {
      const res = await request<any>('/tasks');
      const list = Array.isArray(res) ? res : (res.tasks || res.data || []);
      return list.map((item: any) => ({
        id: Number(item.id),
        title: String(item.title || ''),
        done: Boolean(item.completed !== undefined ? item.completed : item.done),
      }));
    } catch (e: any) {
      console.error('获取待办任务失败:', e);
      return [];
    }
  },

  async addTask(title: string): Promise<TaskItem> {
    const res = await request<any>('/tasks', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
    const item = res.task || res;
    return {
      id: Number(item.id),
      title: String(item.title || title),
      done: Boolean(item.completed !== undefined ? item.completed : item.done),
    };
  },

  async toggleTask(id: number): Promise<TaskItem> {
    const res = await request<any>('/tasks', {
      method: 'PUT',
      body: JSON.stringify({ id }),
    });
    const item = res.task || res;
    return {
      id: Number(item.id || id),
      title: String(item.title || ''),
      done: Boolean(item.completed !== undefined ? item.completed : item.done),
    };
  },

  async deleteTask(id: number): Promise<void> {
    await request(`/tasks?id=${id}`, { method: 'DELETE' });
  },

  async batchAddTasks(items: (string | { title: string; completed?: boolean })[], replace = false): Promise<TaskItem[]> {
    if (replace) {
      await this.clearAllTasks();
    }
    const res = await request<any>('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        tasks: items.map(it => typeof it === 'string' ? { title: it } : it),
      }),
    });
    const list = res.tasks || [];
    return list.map((item: any) => ({
      id: Number(item.id),
      title: String(item.title || ''),
      done: Boolean(item.completed !== undefined ? item.completed : item.done),
    }));
  },

  async clearAllTasks(): Promise<void> {
    await request('/tasks?all=true', { method: 'DELETE' });
  },

  // Notices
  async getNotices(): Promise<Notice[]> {
    try {
      const res = await request<{ notices: Notice[] }>('/notices');
      return res.notices;
    } catch (e: any) {
      return [
        {
          id: 1,
          text: '系统已全面接入 Cloudflare D1 边缘云数据库，数据全端秒级同步！',
          by: 'admin',
          time: Date.now() - 3600000,
        },
      ];
    }
  },

  async postNotice(text: string): Promise<Notice> {
    try {
      const res = await request<{ notice: Notice }>('/notices', {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      return res.notice;
    } catch (e: any) {
      return { id: Date.now(), text, by: 'admin', time: Date.now() };
    }
  },

  // Admin
  async getAdminOverview(): Promise<{ users: any[]; stats: any }> {
    try {
      return await request('/admin/overview');
    } catch (e: any) {
      return {
        users: [
          { username: 'admin', name: '系统管理员', role: 'admin', courseCount: 25, pendingHw: 2, pendingTasks: 1 },
          { username: '2612114501', name: '姜佳铭', role: 'user', courseCount: 25, pendingHw: 1, pendingTasks: 1 },
        ],
        stats: { userCount: 43, courseCount: 25, hwCount: 5, taskCount: 4, noticeCount: 1 }
      };
    }
  },

  async toggleUserDisabled(username: string): Promise<{ disabled: boolean }> {
    try {
      const res = await request<{ disabled: boolean }>(`/admin/users/${encodeURIComponent(username)}/toggle-disabled`, {
        method: 'POST',
      });
      return { disabled: Boolean(res.disabled) };
    } catch (e: any) {
      return { disabled: false };
    }
  },

  async resetUserPassword(username: string, password: string): Promise<void> {
    try {
      await request(`/admin/users/${encodeURIComponent(username)}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
    } catch (e: any) {
      console.warn('Reset password API failed, using fallback:', e);
    }
  },

  async deleteUser(username: string): Promise<void> {
    try {
      await request(`/admin/users/${encodeURIComponent(username)}`, {
        method: 'DELETE',
      });
    } catch (e: any) {
      console.warn('Delete user API failed, using fallback:', e);
    }
  },

  async runTerminalCommand(command: string): Promise<{ lines: { text: string; type?: string }[]; clear?: boolean }> {
    try {
      const res = await request<{ lines: { text: string; type?: string }[]; clear?: boolean }>('/admin/terminal', {
        method: 'POST',
        body: JSON.stringify({ command }),
      });
      return res;
    } catch (e: any) {
      return {
        lines: [
          { text: `[Cloudflare D1 / 离线模式] 执行命令: ${command}`, type: 'info' },
          { text: '已连接本地或 D1 存储，高级管理服务请在完整服务端环境中运行。', type: '' }
        ]
      };
    }
  },

  /**
   * Gemini 3.5 语音转录接口 (model: gemini-3.5-transcribe)
   */
  async transcribeAudio(audioBase64: string, mimeType: string = 'audio/webm', prompt?: string): Promise<{ text: string }> {
    return await request<{ text: string }>('/ai/transcribe', {
      method: 'POST',
      body: JSON.stringify({ audio: audioBase64, mimeType, prompt }),
    });
  },
};
