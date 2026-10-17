import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  Course,
  Homework,
  TaskItem,
  UserAccount,
  Notice,
  STUDENT_ROSTER,
  getDefaultTemplateCourses
} from './data';

export interface PushSubscriptionData {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface StoredPushSubscription {
  id: string;
  username: string;
  subscription: PushSubscriptionData;
  userAgent?: string;
  createdAt: number;
  lastUsedAt?: number;
}

interface DatabaseSchema {
  users: Record<string, UserAccount>;
  courses: Record<string, Course[]>;
  homework: Record<string, Homework[]>;
  tasks: Record<string, TaskItem[]>;
  notices: Notice[];
  consoleHomework?: { id: number; course: string; title: string; due?: string; creator?: string; createdAt?: number }[];
  pushSubscriptions?: Record<string, StoredPushSubscription[]>;
}

const DB_FILE = path.resolve('data/timetable_db.json');

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

class Store {
  private db: DatabaseSchema;

  constructor() {
    this.db = this.loadOrInit();
  }

  private loadOrInit(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Failed to load existing db, re-initializing', e);
    }

    // Initialize fresh DB
    const initialUsers: Record<string, UserAccount> = {
      admin: {
        username: 'admin',
        name: '系统管理员',
        pwHash: hashPassword('admin123'),
        role: 'admin',
        created: Date.now(),
        disabled: false
      }
    };

    const initialCourses: Record<string, Course[]> = {
      admin: getDefaultTemplateCourses()
    };
    const initialHomework: Record<string, Homework[]> = {
      admin: [
        { id: 1, course: 'Web编程技术', title: '完成前端响应式界面制作', due: '2026-10-15 20:00', done: false },
        { id: 2, course: '数据库概论', title: 'ER 图设计报告', due: '2026-10-12 18:00', done: false }
      ]
    };
    const initialTasks: Record<string, TaskItem[]> = {
      admin: [
        { id: 1, title: '图书馆借阅《现代编译原理》', done: false },
        { id: 2, title: '操场慢跑 3 公里', done: true }
      ]
    };

    for (const [id, name] of STUDENT_ROSTER) {
      initialUsers[id] = {
        username: id,
        name,
        pwHash: hashPassword('123456'),
        role: 'user',
        created: Date.now(),
        disabled: false
      };
      initialCourses[id] = getDefaultTemplateCourses();
      initialHomework[id] = [];
      initialTasks[id] = [
        { id: 201, title: '准备下周工程训练预习报告', done: false }
      ];
    }

    const initialNotices: Notice[] = [
      {
        id: 1,
        text: '本周五下午全校停电演练，逸夫楼实训课调至周六上午进行，请互相转告！',
        by: 'admin',
        time: Date.now() - 3600000 * 2
      }
    ];

    const data: DatabaseSchema = {
      users: initialUsers,
      courses: initialCourses,
      homework: initialHomework,
      tasks: initialTasks,
      notices: initialNotices
    };

    this.persist(data);
    return data;
  }

  private persist(data?: DatabaseSchema) {
    const toSave = data || this.db;
    try {
      const dir = path.dirname(DB_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(toSave, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save db file', e);
    }
  }

  // Users
  getUser(username: string): UserAccount | undefined {
    return this.db.users[username];
  }

  getAllUsers(): UserAccount[] {
    return Object.values(this.db.users);
  }

  validatePassword(username: string, rawPass: string): boolean {
    const user = this.getUser(username);
    if (!user) return false;
    return user.pwHash === hashPassword(rawPass);
  }

  registerUser(username: string, rawPass: string, withTemplate = true): UserAccount {
    if (this.db.users[username]) {
      throw new Error('用户名已被注册');
    }
    const studentEntry = STUDENT_ROSTER.find(([id]) => id === username);
    const displayName = studentEntry ? studentEntry[1] : username;

    const newUser: UserAccount = {
      username,
      name: displayName,
      pwHash: hashPassword(rawPass),
      role: 'user',
      created: Date.now(),
      disabled: false
    };

    this.db.users[username] = newUser;
    this.db.courses[username] = withTemplate ? getDefaultTemplateCourses() : [];
    this.db.homework[username] = [];
    this.db.tasks[username] = [];
    this.persist();
    return newUser;
  }

  setUserDisabled(username: string, disabled: boolean) {
    if (username === 'admin') throw new Error('不能禁用超级管理员');
    if (!this.db.users[username]) throw new Error('用户不存在');
    this.db.users[username].disabled = disabled;
    this.persist();
  }

  resetUserPassword(username: string, newPass: string) {
    if (!this.db.users[username]) throw new Error('用户不存在');
    this.db.users[username].pwHash = hashPassword(newPass);
    this.persist();
  }

  updateUserName(username: string, newName: string) {
    if (!this.db.users[username]) throw new Error('用户不存在');
    this.db.users[username].name = newName.trim();
    this.persist();
  }

  deleteUser(username: string) {
    if (username === 'admin') throw new Error('不能删除超级管理员');
    if (!this.db.users[username]) throw new Error('用户不存在');
    delete this.db.users[username];
    delete this.db.courses[username];
    delete this.db.homework[username];
    delete this.db.tasks[username];
    this.persist();
  }

  // Courses
  getCourses(username: string): Course[] {
    if (!this.db.courses[username] || this.db.courses[username].length === 0) {
      this.db.courses[username] = getDefaultTemplateCourses();
      this.persist();
    }
    return this.db.courses[username] || [];
  }

  saveCourses(username: string, courses: Course[]) {
    this.db.courses[username] = courses;
    this.persist();
  }

  addCourse(username: string, course: Omit<Course, 'id'>): Course {
    const courses = this.getCourses(username);
    const newCourse: Course = {
      ...course,
      id: Date.now() + Math.floor(Math.random() * 1000)
    };
    courses.push(newCourse);
    this.saveCourses(username, courses);
    return newCourse;
  }

  updateCourse(username: string, courseId: number, data: Partial<Course>): Course {
    const courses = this.getCourses(username);
    const idx = courses.findIndex(c => c.id === courseId);
    if (idx === -1) throw new Error('课程未找到');
    courses[idx] = { ...courses[idx], ...data };
    this.saveCourses(username, courses);
    return courses[idx];
  }

  deleteCourse(username: string, courseId: number) {
    const courses = this.getCourses(username);
    this.db.courses[username] = courses.filter(c => c.id !== courseId);
    this.persist();
  }

  // Homework
  getHomework(username: string): Homework[] {
    if (!this.db.homework[username]) {
      if (username === 'admin') {
        this.db.homework[username] = [
          { id: 1, course: 'Web编程技术', title: '完成前端响应式界面制作', due: '2026-10-15 20:00', done: false },
          { id: 2, course: '数据库概论', title: 'ER 图设计报告', due: '2026-10-12 18:00', done: false }
        ];
        this.persist();
      } else {
        this.db.homework[username] = [];
      }
    }
    return this.db.homework[username] || [];
  }

  saveHomework(username: string, items: Homework[]) {
    this.db.homework[username] = items;
    this.persist();
  }

  addHomework(username: string, item: { course: string; title: string; due?: string; done?: boolean }): Homework {
    const list = this.getHomework(username);
    const cName = (item.course || '').trim().toLowerCase();
    const tName = (item.title || '').trim().toLowerCase();

    const existingIdx = list.findIndex(h =>
      (h.course || '').trim().toLowerCase() === cName &&
      (h.title || '').trim().toLowerCase() === tName
    );

    if (existingIdx !== -1) {
      // Upsert: update due date and preserve existing done state (or use explicit item.done)
      list[existingIdx] = {
        ...list[existingIdx],
        due: item.due,
        done: item.done !== undefined ? item.done : list[existingIdx].done,
      };
      this.saveHomework(username, list);
      return list[existingIdx];
    }

    const newHw: Homework = {
      id: Date.now() * 100000 + Math.floor(Math.random() * 10000000),
      course: item.course,
      title: item.title,
      due: item.due,
      done: item.done !== undefined ? item.done : false,
    };
    list.unshift(newHw);
    this.saveHomework(username, list);
    return newHw;
  }

  toggleHomework(username: string, id: number): Homework {
    const list = this.getHomework(username);
    const target = list.find(h => h.id === id);
    if (!target) throw new Error('作业未找到');
    target.done = !target.done;
    this.saveHomework(username, list);
    return target;
  }

  updateHomework(username: string, id: number, updates: { course?: string; title?: string; due?: string; done?: boolean }): Homework {
    const list = this.getHomework(username);
    const target = list.find(h => h.id === id);
    if (!target) throw new Error('作业未找到');
    if (updates.course !== undefined) target.course = updates.course;
    if (updates.title !== undefined) target.title = updates.title;
    if (updates.due !== undefined) target.due = updates.due;
    if (updates.done !== undefined) target.done = updates.done;
    this.saveHomework(username, list);
    return target;
  }

  deleteHomework(username: string, id: number) {
    const list = this.getHomework(username);
    this.db.homework[username] = list.filter(h => h.id !== id);
    this.persist();
  }

  // Console Homework Pool (无硬编码示范作业，空数据时保持为空)
  getConsoleHomework(): { id: number; course: string; title: string; due?: string; creator?: string; createdAt?: number }[] {
    if (!this.db.consoleHomework) {
      const adminHw = this.getHomework('admin');
      if (adminHw && adminHw.length > 0) {
        this.db.consoleHomework = adminHw.map(h => ({
          id: h.id || Date.now(),
          course: h.course,
          title: h.title,
          due: h.due,
          creator: 'admin',
          createdAt: Date.now()
        }));
      } else {
        this.db.consoleHomework = [];
      }
      this.persist();
    }
    return this.db.consoleHomework;
  }

  saveConsoleHomework(items: { id: number; course: string; title: string; due?: string; creator?: string; createdAt?: number }[]) {
    this.db.consoleHomework = items;
    this.persist();
  }

  addConsoleHomework(item: { course: string; title: string; due?: string; creator?: string }) {
    const list = this.getConsoleHomework();
    const cName = (item.course || '').trim().toLowerCase();
    const tName = (item.title || '').trim().toLowerCase();

    const existingIdx = list.findIndex(h =>
      (h.course || '').trim().toLowerCase() === cName &&
      (h.title || '').trim().toLowerCase() === tName
    );

    if (existingIdx !== -1) {
      // Upsert: update due and creator
      list[existingIdx] = {
        ...list[existingIdx],
        due: item.due,
        creator: item.creator || list[existingIdx].creator,
        createdAt: Date.now(),
      };
      this.saveConsoleHomework(list);
      return list[existingIdx];
    }

    const newHw = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      course: item.course,
      title: item.title,
      due: item.due,
      creator: item.creator || 'admin',
      createdAt: Date.now(),
    };
    list.unshift(newHw);
    this.saveConsoleHomework(list);
    return newHw;
  }

  deleteConsoleHomework(id: number) {
    const list = this.getConsoleHomework().filter(h => Number(h.id) !== Number(id));
    this.saveConsoleHomework(list);
  }

  clearConsoleHomework() {
    this.saveConsoleHomework([]);
  }

  // Tasks
  getTasks(username: string): TaskItem[] {
    return this.db.tasks[username] || [];
  }

  saveTasks(username: string, items: TaskItem[]) {
    this.db.tasks[username] = items;
    this.persist();
  }

  addTask(username: string, title: string): TaskItem {
    const list = this.getTasks(username);
    const newTask: TaskItem = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      title,
      done: false
    };
    list.unshift(newTask);
    this.saveTasks(username, list);
    return newTask;
  }

  toggleTask(username: string, id: number): TaskItem {
    const list = this.getTasks(username);
    const target = list.find(t => t.id === id);
    if (!target) throw new Error('任务未找到');
    target.done = !target.done;
    this.saveTasks(username, list);
    return target;
  }

  deleteTask(username: string, id: number) {
    const list = this.getTasks(username);
    this.db.tasks[username] = list.filter(t => t.id !== id);
    this.persist();
  }

  // Notices
  getNotices(): Notice[] {
    return this.db.notices || [];
  }

  addNotice(text: string, by: string): Notice {
    const newNotice: Notice = {
      id: Date.now(),
      text,
      by,
      time: Date.now()
    };
    this.db.notices.push(newNotice);
    this.persist();
    return newNotice;
  }

  getStats() {
    const userCount = Object.keys(this.db.users).length;
    let courseCount = 0;
    let hwCount = 0;
    let taskCount = 0;

    for (const u of Object.keys(this.db.users)) {
      courseCount += (this.db.courses[u] || []).length;
      hwCount += (this.db.homework[u] || []).length;
      taskCount += (this.db.tasks[u] || []).length;
    }

    return {
      userCount,
      courseCount,
      hwCount,
      taskCount,
      noticeCount: this.db.notices.length
    };
  }

  // Push Subscriptions
  getPushSubscriptions(username: string): StoredPushSubscription[] {
    if (!this.db.pushSubscriptions) this.db.pushSubscriptions = {};
    return this.db.pushSubscriptions[username] || [];
  }

  getAllPushSubscriptions(): StoredPushSubscription[] {
    if (!this.db.pushSubscriptions) this.db.pushSubscriptions = {};
    const all: StoredPushSubscription[] = [];
    for (const u of Object.keys(this.db.pushSubscriptions)) {
      all.push(...(this.db.pushSubscriptions[u] || []));
    }
    return all;
  }

  savePushSubscription(username: string, subscription: PushSubscriptionData, userAgent?: string): StoredPushSubscription {
    if (!this.db.pushSubscriptions) this.db.pushSubscriptions = {};
    const list = this.db.pushSubscriptions[username] || [];
    const now = Date.now();
    const existingIndex = list.findIndex(s => s.subscription.endpoint === subscription.endpoint);
    let entry: StoredPushSubscription;

    if (existingIndex >= 0) {
      entry = {
        ...list[existingIndex],
        subscription,
        userAgent: userAgent || list[existingIndex].userAgent,
        lastUsedAt: now,
      };
      list[existingIndex] = entry;
    } else {
      entry = {
        id: `sub_${now}_${Math.random().toString(36).substring(2, 8)}`,
        username,
        subscription,
        userAgent,
        createdAt: now,
        lastUsedAt: now,
      };
      list.push(entry);
    }

    this.db.pushSubscriptions[username] = list;
    this.persist();
    return entry;
  }

  removePushSubscription(username: string, endpoint: string): boolean {
    if (!this.db.pushSubscriptions || !this.db.pushSubscriptions[username]) return false;
    const initialLen = this.db.pushSubscriptions[username].length;
    this.db.pushSubscriptions[username] = this.db.pushSubscriptions[username].filter(
      s => s.subscription.endpoint !== endpoint
    );
    const removed = this.db.pushSubscriptions[username].length < initialLen;
    if (removed) this.persist();
    return removed;
  }

  cleanInvalidPushSubscription(endpoint: string) {
    if (!this.db.pushSubscriptions) return;
    let changed = false;
    for (const u of Object.keys(this.db.pushSubscriptions)) {
      const filtered = this.db.pushSubscriptions[u].filter(s => s.subscription.endpoint !== endpoint);
      if (filtered.length !== this.db.pushSubscriptions[u].length) {
        this.db.pushSubscriptions[u] = filtered;
        changed = true;
      }
    }
    if (changed) this.persist();
  }
}

export const dbStore = new Store();
