import { Course, Homework, TaskItem } from '../types';
import { PALETTE } from './time';

export const SAMPLE_COURSES: Omit<Course, 'id'>[] = [
  { name: "Web编程技术", teacher: "葛江玲", room: "博学1-101-102-专业机房1", day: 0, s: 1, e: 2, weeks: "2-14周,16-17周", color: PALETTE[0] },
  { name: "专业见习", teacher: "刘斌", room: "逸夫1-409", day: 0, s: 1, e: 4, weeks: "15周", color: PALETTE[6] },
  { name: "工程训练III", teacher: "易吉祥", room: "逸夫2-306-3D打印工训室", day: 0, s: 1, e: 8, weeks: "18周", color: PALETTE[7] },
  { name: "Java开发技术", teacher: "朱薇", room: "明理9-310", day: 0, s: 3, e: 4, weeks: "2-14周,16-17周", color: PALETTE[1] },
  { name: "形势与政策1", teacher: "张庭珲", room: "明理8-607", day: 0, s: 7, e: 8, weeks: "13-14周", color: PALETTE[0] },
  { name: "Web编程技术", teacher: "葛江玲", room: "明理9-310", day: 1, s: 1, e: 2, weeks: "2-14周,16-17周", color: PALETTE[0] },
  { name: "专业见习", teacher: "刘斌", room: "逸夫1-409", day: 1, s: 1, e: 4, weeks: "15周", color: PALETTE[6] },
  { name: "工程训练III", teacher: "易吉祥", room: "逸夫2-306-3D打印工训室", day: 1, s: 1, e: 8, weeks: "18周", color: PALETTE[7] },
  { name: "计算机网络", teacher: "郑晓东", room: "明理9-310", day: 1, s: 3, e: 4, weeks: "2-14周,16-17周", color: PALETTE[3] },
  { name: "计算机网络", teacher: "郑晓东", room: "博学1-104-专业机房2", day: 1, s: 5, e: 6, weeks: "2-14周,16-17周", color: PALETTE[3] },
  { name: "形势与政策1", teacher: "张庭珲", room: "高校邦网络平台", day: 1, s: 11, e: 11, weeks: "17-18周", color: PALETTE[0] },
  { name: "Java开发技术", teacher: "朱薇", room: "博学1-104-专业机房2", day: 2, s: 1, e: 2, weeks: "2-3周,5-14周,16-17周", color: PALETTE[1] },
  { name: "专业见习", teacher: "刘斌", room: "逸夫1-409", day: 2, s: 1, e: 4, weeks: "15周", color: PALETTE[6] },
  { name: "数据库概论", teacher: "陈晓艳", room: "明理9-310", day: 2, s: 3, e: 4, weeks: "2-14周,16-17周", color: PALETTE[2] },
  { name: "数据库概论", teacher: "陈晓艳", room: "博学1-104-专业机房2", day: 3, s: 1, e: 2, weeks: "2-14周,16-17周", color: PALETTE[2] },
  { name: "专业见习", teacher: "刘斌", room: "逸夫1-409", day: 3, s: 1, e: 4, weeks: "15周", color: PALETTE[6] },
  { name: "工程训练III", teacher: "易吉祥", room: "逸夫2-306-3D打印工训室", day: 3, s: 1, e: 8, weeks: "18周", color: PALETTE[7] },
  { name: "软件工程导论", teacher: "张素娟", room: "博学1-101-102-专业机房1", day: 3, s: 3, e: 4, weeks: "2-14周,16-17周", color: PALETTE[4] },
  { name: "界面设计", teacher: "郑莉", room: "博学1-212A-专业机房3", day: 3, s: 5, e: 6, weeks: "2-14周,16-17周", color: PALETTE[5] },
  { name: "界面设计", teacher: "郑莉", room: "博学1-212A-专业机房3", day: 3, s: 7, e: 8, weeks: "2-14周,16-17周", color: PALETTE[5] },
  { name: "大学生心理健康", teacher: "何贻婷", room: "高校邦网络平台", day: 3, s: 11, e: 11, weeks: "3-18周", color: PALETTE[0] },
  { name: "专业见习", teacher: "刘斌", room: "逸夫1-409", day: 4, s: 1, e: 4, weeks: "15周", color: PALETTE[6] },
  { name: "工程训练III", teacher: "易吉祥", room: "逸夫2-306-3D打印工训室", day: 4, s: 3, e: 8, weeks: "18周", color: PALETTE[7] },
  { name: "软件工程导论", teacher: "张素娟", room: "明理1-405A-翻转教室", day: 4, s: 5, e: 6, weeks: "2-14周,16-17周", color: PALETTE[4] },
  { name: "专业见习", teacher: "刘斌", room: "校外实践基地", day: 5, s: 1, e: 4, weeks: "15周", color: PALETTE[6] },
];

// 官方作业已全部通过 Cloudflare D1 homework_pool 动态管理，不再硬编码任何示范作业
export const SAMPLE_ASSIGNMENTS: { course: string; title: string; due?: string }[] = [];

export const SAMPLE_TASKS: { title: string }[] = [
  { title: "准备计算机网络期中复习笔记（物理层至网络层）" },
  { title: "背诵英语六级核心词汇 50 词" },
  { title: "练习 LeetCode 经典双指针与动态规划题 3 道" },
  { title: "借阅图书馆《深入理解计算机系统》（CSAPP）" },
];
