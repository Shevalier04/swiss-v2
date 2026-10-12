import { Course, Homework, TaskItem, User, Notice } from '../types';
import { PALETTE } from '../utils/time';

const STUDENT_NAMES: Record<string, string> = {
  "2612114501": "姜佳铭", "2612114502": "郑俊源", "2612114503": "林枫", "2612114504": "苏晓铭",
  "2612114505": "傅兴胜", "2612114506": "陈伟杰", "2612114507": "林元和", "2612114508": "谢炟荣",
  "2612114509": "黄圣涛", "2612114510": "滕开键", "2612114511": "张佳芝", "2612114512": "郑鋆",
  "2612114513": "丁艳杰", "2612114514": "陈均涵", "2612114515": "经森豪", "2612114516": "叶长钧",
  "2612114517": "李子烨", "2612114518": "何婉静", "2612114519": "蔡毅阳", "2612114520": "阮泽冰",
  "2612114521": "黄宇康", "2612114522": "白佳乐", "2612114523": "方晓敏", "2612114524": "刘书钰",
  "2612114525": "章志强", "2612114526": "吴煜灿", "2612114527": "陈哲铭", "2612114528": "李奎佑",
  "2612114529": "陈晶",   "2612114530": "郑佳豪", "2612114531": "吴辰炀", "2612114532": "杨榕煌",
  "2612114533": "林琪竣", "2612114534": "林佳德", "2612114535": "刘抒凡", "2612114536": "王为焓",
  "2612114537": "黄义政", "2612114538": "张雅婷", "2612114539": "鲁传伟", "2612114540": "翁晗冰",
  "2612114541": "余哲涛", "2512114511": "林东林", "admin": "系统管理员"
};

export function getDefaultTemplateCourses(): Course[] {
  const T: [string, string, string, number, number, number, string][] = [
    ["Web编程技术", "葛江玲", "博学1-101-102-专业机房1", 0, 1, 2, "2-14周,16-17周"],
    ["专业见习", "刘斌", "逸夫1-409", 0, 1, 4, "15周"],
    ["工程训练III", "易吉祥", "逸夫2-306-3D打印工训室", 0, 1, 8, "18周"],
    ["Java开发技术", "朱薇", "明理9-310", 0, 3, 4, "2-14周,16-17周"],
    ["形势与政策1", "张庭珲", "明理8-607", 0, 7, 8, "13-14周"],
    ["Web编程技术", "葛江玲", "明理9-310", 1, 1, 2, "2-14周,16-17周"],
    ["专业见习", "刘斌", "逸夫1-409", 1, 1, 4, "15周"],
    ["工程训练III", "易吉祥", "逸夫2-306-3D打印工训室", 1, 1, 8, "18周"],
    ["计算机网络", "郑晓东", "明理9-310", 1, 3, 4, "2-14周,16-17周"],
    ["计算机网络", "郑晓东", "博学1-104-专业机房2", 1, 5, 6, "2-14周,16-17周"],
    ["形势与政策1", "张庭珲", "高校邦平台xmut.gaoxiaobang.com", 1, 11, 11, "17-18周"],
    ["Java开发技术", "朱薇", "博学1-104-专业机房2", 2, 1, 2, "2-3周,5-14周,16-17周"],
    ["专业见习", "刘斌", "逸夫1-409", 2, 1, 4, "15周"],
    ["数据库概论", "陈晓艳", "明理9-310", 2, 3, 4, "2-14周,16-17周"],
    ["数据库概论", "陈晓艳", "博学1-104-专业机房2", 3, 1, 2, "2-14周,16-17周"],
    ["专业见习", "刘斌", "逸夫1-409", 3, 1, 4, "15周"],
    ["工程训练III", "易吉祥", "逸夫2-306-3D打印工训室", 3, 1, 8, "18周"],
    ["软件工程导论", "张素娟", "博学1-101-102-专业机房1", 3, 3, 4, "2-14周,16-17周"],
    ["界面设计", "郑莉", "博学1-212A-专业机房3", 3, 5, 6, "2-14周,16-17周"],
    ["界面设计", "郑莉", "博学1-212A-专业机房3", 3, 7, 8, "2-14周,16-17周"],
    ["大学生心理健康", "何贻婷", "高校邦平台xmut.gaoxiaobang.com", 3, 11, 11, "3-18周"],
    ["专业见习", "刘斌", "逸夫1-409", 4, 1, 4, "15周"],
    ["工程训练III", "易吉祥", "逸夫2-306-3D打印工训室", 4, 3, 8, "18周"],
    ["软件工程导论", "张素娟", "明理1-405A-翻转教室", 4, 5, 6, "2-14周,16-17周"],
    ["专业见习", "刘斌", "校外实践基地", 5, 1, 4, "15周"]
  ];
  const NC: Record<string, number> = {
    "Web编程技术": 0, "Java开发技术": 1, "数据库概论": 2, "计算机网络": 3,
    "软件工程导论": 4, "界面设计": 5, "工程训练III": 7, "专业见习": 6,
    "形势与政策1": 0, "大学生心理健康": 0
  };

  return T.map((t, i) => ({
    id: 2000 + i,
    name: t[0],
    teacher: t[1],
    room: t[2],
    day: t[3],
    s: t[4],
    e: t[5],
    weeks: t[6],
    color: PALETTE[NC[t[0]] ?? 6]
  }));
}

function getLocal<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

function setLocal<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
}

export const localDb = {
  login(username: string, password: string): { token: string; user: User } {
    if (username === 'admin') {
      if (password !== 'admin123') throw new Error('密码错误');
      return {
        token: 'admin',
        user: { username: 'admin', name: '系统管理员', role: 'admin' }
      };
    }
    const name = STUDENT_NAMES[username] || username;
    if (password !== '123456') {
      const customUsers = getLocal<Record<string, string>>('cs_local_users', {});
      if (customUsers[username] && customUsers[username] === password) {
        return {
          token: username,
          user: { username, name, role: 'user' }
        };
      }
      throw new Error('密码错误（初始密码为 123456）');
    }
    return {
      token: username,
      user: { username, name, role: 'user' }
    };
  },

  register(username: string, password: string, withTemplate = true): { token: string; user: User } {
    const customUsers = getLocal<Record<string, string>>('cs_local_users', {});
    customUsers[username] = password;
    setLocal('cs_local_users', customUsers);

    if (withTemplate) {
      setLocal(`cs_u_${username}_courses`, getDefaultTemplateCourses());
    }

    const name = STUDENT_NAMES[username] || username;
    return {
      token: username,
      user: { username, name, role: 'user' }
    };
  },

  getMe(token: string): User {
    const name = STUDENT_NAMES[token] || token;
    return {
      username: token,
      name,
      role: token === 'admin' ? 'admin' : 'user'
    };
  },

  getCourses(username: string): Course[] {
    return getLocal(`cs_u_${username}_courses`, getDefaultTemplateCourses());
  },

  saveCourses(username: string, courses: Course[]) {
    setLocal(`cs_u_${username}_courses`, courses);
  },

  addCourse(username: string, course: Omit<Course, 'id'>): Course {
    const list = this.getCourses(username);
    const newCourse = { ...course, id: Date.now() + Math.floor(Math.random() * 1000) };
    list.push(newCourse);
    this.saveCourses(username, list);
    return newCourse;
  },

  updateCourse(username: string, id: number, data: Partial<Course>): Course {
    const list = this.getCourses(username);
    const idx = list.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('课程未找到');
    list[idx] = { ...list[idx], ...data };
    this.saveCourses(username, list);
    return list[idx];
  },

  deleteCourse(username: string, id: number) {
    const list = this.getCourses(username).filter(c => c.id !== id);
    this.saveCourses(username, list);
  },

  getHomework(username: string): Homework[] {
    return getLocal(`cs_u_${username}_hw`, [
      { id: 1, course: 'Web编程技术', title: '完成前端响应式界面制作', due: '2026-10-15', done: false },
      { id: 2, course: '数据库概论', title: 'ER 图设计报告', due: '2026-10-12', done: false }
    ]);
  },

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
    setLocal(`cs_u_${username}_hw`, list);
    return newHw;
  },

  toggleHomework(username: string, id: number): Homework {
    const list = this.getHomework(username);
    const target = list.find(h => h.id === id);
    if (!target) throw new Error('未找到');
    target.done = !target.done;
    setLocal(`cs_u_${username}_hw`, list);
    return target;
  },

  deleteHomework(username: string, id: number) {
    const list = this.getHomework(username).filter(h => h.id !== id);
    setLocal(`cs_u_${username}_hw`, list);
  },

  getConsoleHomework(): { id: number; course: string; title: string; due?: string; creator?: string }[] {
    return getLocal('cs_console_hw_pool', [
      { id: 101, course: 'Web编程技术', title: '完成前端响应式界面制作与CSS3动画', due: '2026-10-18', creator: '系统管理员' },
      { id: 102, course: '数据库概论', title: '第三章 ER 图设计报告与SQL多表查询', due: '2026-10-21', creator: '系统管理员' },
      { id: 103, course: 'Java开发技术', title: '完成第四章对象与面向对象编程实验报告', due: '2026-10-23', creator: '系统管理员' },
      { id: 104, course: '计算机网络', title: 'Wireshark 抓包分析 TCP 三次握手', due: '2026-10-26', creator: '系统管理员' },
      { id: 105, course: '软件工程导论', title: '可行性研究与系统需求规格说明书', due: '2026-10-30', creator: '系统管理员' },
    ]);
  },

  addConsoleHomework(item: { course: string; title: string; due?: string; creator?: string }) {
    const pool = this.getConsoleHomework();
    const newHw = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      course: item.course,
      title: item.title,
      due: item.due,
      creator: item.creator || '系统管理员',
    };
    pool.unshift(newHw);
    setLocal('cs_console_hw_pool', pool);
    return newHw;
  },

  saveConsoleHomework(items: { id: number; course: string; title: string; due?: string; creator?: string }[]) {
    setLocal('cs_console_hw_pool', items);
  },

  deleteConsoleHomework(id: number) {
    const pool = this.getConsoleHomework().filter(h => Number(h.id) !== Number(id));
    setLocal('cs_console_hw_pool', pool);
    return pool;
  },

  clearConsoleHomework() {
    setLocal('cs_console_hw_pool', []);
  },

  getTasks(username: string): TaskItem[] {
    return getLocal(`cs_u_${username}_tasks`, [
      { id: 1, title: '图书馆借阅《现代编译原理》', done: false },
      { id: 2, title: '操场慢跑 3 公里', done: true }
    ]);
  },

  addTask(username: string, title: string): TaskItem {
    const list = this.getTasks(username);
    const newTask: TaskItem = { id: Date.now() + Math.floor(Math.random() * 1000), title, done: false };
    list.unshift(newTask);
    setLocal(`cs_u_${username}_tasks`, list);
    return newTask;
  },

  toggleTask(username: string, id: number): TaskItem {
    const list = this.getTasks(username);
    const target = list.find(t => t.id === id);
    if (!target) throw new Error('未找到');
    target.done = !target.done;
    setLocal(`cs_u_${username}_tasks`, list);
    return target;
  },

  deleteTask(username: string, id: number) {
    const list = this.getTasks(username).filter(t => t.id !== id);
    setLocal(`cs_u_${username}_tasks`, list);
  },

  getNotices(): Notice[] {
    return [
      {
        id: 1,
        text: '本周五下午全校停电演练，逸夫楼实训课调至周六上午进行，请互相转告！',
        by: 'admin',
        time: Date.now() - 3600000 * 2
      }
    ];
  }
};
