export interface Course {
  id: number;
  name: string;
  teacher?: string;
  room?: string;
  day: number; // 0=Mon ... 6=Sun
  s: number;   // 1..11
  e: number;   // 1..11
  weeks?: string;
  color: string;
}

export interface Homework {
  id: number;
  course: string;
  title: string;
  due?: string;
  done: boolean;
  source?: string;
  type?: '作业' | '考试';
  submitStatus?: '未交' | '待做' | '待批阅' | '已完成' | '已互评' | '已及格';
  score?: string;
  remainingTime?: string;
  detailPath?: string;
}

export interface TaskItem {
  id: number;
  title: string;
  done: boolean;
}

export interface User {
  username: string;
  name: string;
  role: 'admin' | 'user';
  disabled?: boolean;
}

export interface Notice {
  id: number;
  text: string;
  by: string;
  time: number;
}

export interface RemindSettings {
  enabled: boolean;
  lead: number; // minutes: 5, 10, 15, 20
  inapp: boolean;
  sys: boolean;
  sound: boolean;
  sundayEveEnabled: boolean; // 周日晚提醒明日周一有课
  sundayEveHour: number; // 提醒时间点，如 20 (20:00)
  sundayAutoAdvance: boolean; // 周日晚间 (>=18:00) 课表与小组件自动提前更新至下周
  everyEvePreview: boolean; // 每日晚间 (>=20:00) 提前预告明日早课
}
