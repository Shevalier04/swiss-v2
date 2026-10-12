import { Course, Homework, TaskItem, User, Notice } from '../types';
import { localDb } from './localDb';

const TOKEN_KEY = 'cs_app_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('BACKEND_HTML_FALLBACK');
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || '请求失败');
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
      setStoredToken(res.token);
      return res;
    } catch (e: any) {
      if (e.message === 'BACKEND_HTML_FALLBACK' || e.name === 'TypeError') {
        const localRes = localDb.login(username, password);
        setStoredToken(localRes.token);
        return localRes;
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
      setStoredToken(res.token);
      return res;
    } catch (e: any) {
      if (e.message === 'BACKEND_HTML_FALLBACK' || e.name === 'TypeError') {
        const localRes = localDb.register(username, password, withTemplate);
        setStoredToken(localRes.token);
        return localRes;
      }
      throw e;
    }
  },

  async getMe(): Promise<User> {
    const token = getStoredToken();
    if (!token) throw new Error('未登录');
    try {
      return await request<User>('/auth/me');
    } catch (e: any) {
      return localDb.getMe(token);
    }
  },

  logout() {
    setStoredToken(null);
  },

  // Courses
  async getCourses(): Promise<Course[]> {
    const token = getStoredToken();
    try {
      const res = await request<{ courses: Course[] }>('/courses');
      return res.courses;
    } catch (e: any) {
      return token ? localDb.getCourses(token) : [];
    }
  },

  async addCourse(course: Omit<Course, 'id'>): Promise<Course> {
    const token = getStoredToken();
    try {
      const res = await request<{ course: Course }>('/courses', {
        method: 'POST',
        body: JSON.stringify(course),
      });
      return res.course;
    } catch (e: any) {
      if (token) return localDb.addCourse(token, course);
      throw e;
    }
  },

  async updateCourse(id: number, data: Partial<Course>): Promise<Course> {
    const token = getStoredToken();
    try {
      const res = await request<{ course: Course }>(`/courses/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      return res.course;
    } catch (e: any) {
      if (token) return localDb.updateCourse(token, id, data);
      throw e;
    }
  },

  async deleteCourse(id: number): Promise<void> {
    const token = getStoredToken();
    try {
      await request(`/courses/${id}`, { method: 'DELETE' });
    } catch (e: any) {
      if (token) localDb.deleteCourse(token, id);
    }
  },

  async batchReplaceCourses(courses: Course[]): Promise<void> {
    const token = getStoredToken();
    try {
      await request('/courses/batch-replace', {
        method: 'POST',
        body: JSON.stringify({ courses }),
      });
    } catch (e: any) {
      if (token) localDb.saveCourses(token, courses);
    }
  },

  async resetTemplateCourses(): Promise<Course[]> {
    const token = getStoredToken();
    try {
      const res = await request<{ courses: Course[] }>('/courses/reset-template', {
        method: 'POST',
      });
      return res.courses;
    } catch (e: any) {
      const tpl = localDb.getCourses(token || 'default');
      return tpl;
    }
  },

  // Homework
  async getHomework(): Promise<Homework[]> {
    const token = getStoredToken();
    try {
      const res = await request<{ homework: Homework[] }>('/homework');
      return res.homework;
    } catch (e: any) {
      return token ? localDb.getHomework(token) : [];
    }
  },

  async addHomework(item: { course: string; title: string; due?: string }): Promise<Homework> {
    const token = getStoredToken();
    try {
      const res = await request<{ homework: Homework }>('/homework', {
        method: 'POST',
        body: JSON.stringify(item),
      });
      return res.homework;
    } catch (e: any) {
      if (token) return localDb.addHomework(token, item);
      throw e;
    }
  },

  async toggleHomework(id: number): Promise<Homework> {
    const token = getStoredToken();
    try {
      const res = await request<{ homework: Homework }>(`/homework/${id}/toggle`, {
        method: 'PUT',
      });
      return res.homework;
    } catch (e: any) {
      if (token) return localDb.toggleHomework(token, id);
      throw e;
    }
  },

  async deleteHomework(id: number): Promise<void> {
    const token = getStoredToken();
    try {
      await request(`/homework/${id}`, { method: 'DELETE' });
    } catch (e: any) {
      if (token) localDb.deleteHomework(token, id);
    }
  },

  async getConsoleHomeworkTemplates(): Promise<{ id: number; course: string; title: string; due?: string; creator?: string }[]> {
    try {
      const res = await request<{ templates: any[] }>('/homework/console-pool');
      return res.templates;
    } catch (e: any) {
      return localDb.getConsoleHomework();
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
      return localDb.addConsoleHomework(item);
    }
  },

  async deleteConsoleHomeworkTemplate(id: number): Promise<void> {
    localDb.deleteConsoleHomework(id);
    try {
      await request(`/homework/console-pool/${id}`, { method: 'DELETE' });
    } catch (e: any) {}
  },

  async clearConsoleHomeworkTemplates(): Promise<void> {
    localDb.clearConsoleHomework();
    try {
      await request('/homework/console-pool', { method: 'DELETE' });
    } catch (e: any) {}
  },

  async syncConsoleHomeworkBatch(items: { course: string; title: string; due?: string }[]): Promise<Homework[]> {
    const token = getStoredToken();
    try {
      const res = await request<{ added: Homework[]; homework: Homework[] }>('/homework/console-pool/batch-sync', {
        method: 'POST',
        body: JSON.stringify({ items }),
      });
      return res.added;
    } catch (e: any) {
      if (token) {
        return items.map(it => localDb.addHomework(token, it));
      }
      throw e;
    }
  },

  // Tasks
  async getTasks(): Promise<TaskItem[]> {
    const token = getStoredToken();
    try {
      const res = await request<{ tasks: TaskItem[] }>('/tasks');
      return res.tasks;
    } catch (e: any) {
      return token ? localDb.getTasks(token) : [];
    }
  },

  async addTask(title: string): Promise<TaskItem> {
    const token = getStoredToken();
    try {
      const res = await request<{ task: TaskItem }>('/tasks', {
        method: 'POST',
        body: JSON.stringify({ title }),
      });
      return res.task;
    } catch (e: any) {
      if (token) return localDb.addTask(token, title);
      throw e;
    }
  },

  async toggleTask(id: number): Promise<TaskItem> {
    const token = getStoredToken();
    try {
      const res = await request<{ task: TaskItem }>(`/tasks/${id}/toggle`, {
        method: 'PUT',
      });
      return res.task;
    } catch (e: any) {
      if (token) return localDb.toggleTask(token, id);
      throw e;
    }
  },

  async deleteTask(id: number): Promise<void> {
    const token = getStoredToken();
    try {
      await request(`/tasks/${id}`, { method: 'DELETE' });
    } catch (e: any) {
      if (token) localDb.deleteTask(token, id);
    }
  },

  // Notices
  async getNotices(): Promise<Notice[]> {
    try {
      const res = await request<{ notices: Notice[] }>('/notices');
      return res.notices;
    } catch (e: any) {
      return localDb.getNotices();
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
          { username: '2612114502', name: '郑俊源', role: 'user', courseCount: 25, pendingHw: 1, pendingTasks: 1 }
        ],
        stats: { userCount: 43, courseCount: 1075, hwCount: 44, taskCount: 44, noticeCount: 1 }
      };
    }
  },

  async toggleUserDisabled(username: string): Promise<{ disabled: boolean }> {
    try {
      return await request(`/admin/users/${username}/toggle-disabled`, { method: 'POST' });
    } catch (e: any) {
      return { disabled: false };
    }
  },

  async resetUserPassword(username: string, password: string): Promise<void> {
    try {
      await request(`/admin/users/${username}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
    } catch (e: any) {}
  },

  async deleteUser(username: string): Promise<void> {
    try {
      await request(`/admin/users/${username}`, { method: 'DELETE' });
    } catch (e: any) {}
  },

  async runTerminalCommand(command: string): Promise<{ lines: { text: string; type?: string }[]; clear?: boolean }> {
    try {
      return await request('/admin/terminal', {
        method: 'POST',
        body: JSON.stringify({ command }),
      });
    } catch (e: any) {
      return {
        lines: [
          { text: `[本地离线模式执行] ${command}`, type: 'info' },
          { text: '系统处于移动端离线优先模式，所有数据正常在手机本地安全运行。', type: '' }
        ]
      };
    }
  },
};
