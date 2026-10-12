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

interface DatabaseSchema {
  users: Record<string, UserAccount>;
  courses: Record<string, Course[]>;
  homework: Record<string, Homework[]>;
  tasks: Record<string, TaskItem[]>;
  notices: Notice[];
  consoleHomework?: { id: number; course: string; title: string; due?: string; creator?: string; createdAt?: number }[];
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
        { id: 1, course: 'Web编程技术', title: '完成前端响应式界面制作', due: '2026-10-15', done: false },
        { id: 2, course: '数据库概论', title: 'ER 图设计报告', due: '2026-10-12', done: false }
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
      initialHomework[id] = [
        { id: 101, course: 'Web编程技术', title: '完成第4章在线实验报告', due: '2026-10-14', done: false }
      ];
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
    return this.db.homework[username] || [];
  }

  saveHomework(username: string, items: Homework[]) {
    this.db.homework[username] = items;
    this.persist();
  }

  addHomework(username: string, item: { course: string; title: string; due?: string }): Homework {
    const list = this.getHomework(username);
    const newHw: Homework = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      course: item.course,
      title: item.title,
      due: item.due,
      done: false
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

  deleteHomework(username: string, id: number) {
    const list = this.getHomework(username);
    this.db.homework[username] = list.filter(h => h.id !== id);
    this.persist();
  }

  // Console Homework Pool
  getConsoleHomework(): { id: number; course: string; title: string; due?: string; creator?: string; createdAt?: number }[] {
    if (!this.db.consoleHomework) {
      this.db.consoleHomework = [
        { id: 101, course: 'Web编程技术', title: '完成前端响应式界面制作与CSS3动画', due: '2026-10-18', creator: '系统管理员' },
        { id: 102, course: '数据库概论', title: '第三章 ER 图设计报告与SQL多表查询', due: '2026-10-21', creator: '系统管理员' },
        { id: 103, course: 'Java开发技术', title: '完成第四章对象与面向对象编程实验报告', due: '2026-10-23', creator: '系统管理员' },
        { id: 104, course: '计算机网络', title: 'Wireshark 抓包分析 TCP 三次握手', due: '2026-10-26', creator: '系统管理员' },
        { id: 105, course: '软件工程导论', title: '可行性研究与系统需求规格说明书', due: '2026-10-30', creator: '系统管理员' },
      ];
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
}

export const dbStore = new Store();
