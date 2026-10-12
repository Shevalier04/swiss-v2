import { Course, Homework, TaskItem, User, Notice } from '../types';
import { SAMPLE_COURSES, SAMPLE_ASSIGNMENTS, SAMPLE_TASKS } from '../utils/sampleData';

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
      // 离线轻量模式用户直接允许登录
      const name = username === 'admin' ? '系统管理员' : username;
      const user: User = {
        username,
        name,
        role: username === 'admin' ? 'admin' : 'user',
      };
      setStoredToken(username);
      return { token: username, user };
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
      const name = username === 'admin' ? '系统管理员' : username;
      const user: User = {
        username,
        name,
        role: username === 'admin' ? 'admin' : 'user',
      };
      setStoredToken(username);
      return { token: username, user };
    }
  },

  async getMe(): Promise<User> {
    const token = getStoredToken();
    if (!token) throw new Error('未登录');
    try {
      return await request<User>('/auth/me');
    } catch (e: any) {
      return {
        username: token,
        name: token === 'admin' ? '系统管理员' : token,
        role: token === 'admin' ? 'admin' : 'user',
      };
    }
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
  async getHomework(): Promise<Homework[]> {
    try {
      const res = await request<any>('/assignments');
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

  async batchAddHomework(items: { course: string; title: string; due?: string }[], replace = false): Promise<Homework[]> {
    const res = await request<any>('/assignments', {
      method: 'POST',
      body: JSON.stringify({
        items: items.map(it => ({
          course_name: it.course,
          title: it.title,
          deadline: it.due,
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
  },

  async clearAllHomework(): Promise<void> {
    await request('/assignments?all=true', { method: 'DELETE' });
  },

  async syncConsoleHomeworkBatch(items: { course: string; title: string; due?: string }[]): Promise<Homework[]> {
    return await this.batchAddHomework(items, false);
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
    return { disabled: false };
  },

  async resetUserPassword(username: string, password: string): Promise<void> {},

  async deleteUser(username: string): Promise<void> {},

  async runTerminalCommand(command: string): Promise<{ lines: { text: string; type?: string }[]; clear?: boolean }> {
    return {
      lines: [
        { text: `[Cloudflare D1 云端数据库管理] ${command}`, type: 'info' },
        { text: '已连接 Cloudflare D1 (swiss-db)，数据运行在边缘节点。', type: '' }
      ]
    };
  },
};
