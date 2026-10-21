/**
 * Cloudflare Pages Functions - Admin Overview API
 * Path: /api/admin/overview
 * D1 Database Binding: DB
 */

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
}

interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  all<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface Env {
  DB: D1Database;
}

export interface EventContext<Env, P extends string, Data> {
  request: Request;
  functionPath: string;
  env: Env;
  params: Record<P, string | string[]>;
  data: Data;
}

export type PagesFunction<
  Env = unknown,
  Params extends string = any,
  Data extends Record<string, unknown> = Record<string, unknown>
> = (context: EventContext<Env, Params, Data>) => Response | Promise<Response>;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User, X-Username',
};

const STANDARD_STUDENTS: { username: string; name: string }[] = [
  { username: '2612114501', name: '姜佳铭' },
  { username: '2612114502', name: '郑俊源' },
  { username: '2612114503', name: '林枫' },
  { username: '2612114504', name: '苏晓铭' },
  { username: '2612114505', name: '傅兴胜' },
  { username: '2612114506', name: '陈伟杰' },
  { username: '2612114507', name: '林元和' },
  { username: '2612114508', name: '谢炟荣' },
  { username: '2612114509', name: '黄圣涛' },
  { username: '2612114510', name: '滕开键' },
  { username: '2612114511', name: '张佳芝' },
  { username: '2612114512', name: '郑鋆' },
  { username: '2612114513', name: '丁艳杰' },
  { username: '2612114514', name: '陈均涵' },
  { username: '2612114515', name: '经森豪' },
  { username: '2612114516', name: '叶长钧' },
  { username: '2612114517', name: '李子烨' },
  { username: '2612114518', name: '何婉静' },
  { username: '2612114519', name: '蔡毅阳' },
  { username: '2612114520', name: '阮泽冰' },
  { username: '2612114521', name: '黄宇康' },
  { username: '2612114522', name: '白佳乐' },
  { username: '2612114523', name: '方晓敏' },
  { username: '2612114524', name: '刘书钰' },
  { username: '2612114525', name: '章志强' },
  { username: '2612114526', name: '吴煜灿' },
  { username: '2612114527', name: '陈哲铭' },
  { username: '2612114528', name: '李奎佑' },
  { username: '2612114529', name: '陈晶' },
  { username: '2612114530', name: '郑佳豪' },
  { username: '2612114531', name: '吴辰炀' },
  { username: '2612114532', name: '杨榕煌' },
  { username: '2612114533', name: '林琪竣' },
  { username: '2612114534', name: '林佳德' },
  { username: '2612114535', name: '刘抒凡' },
  { username: '2612114536', name: '王为焓' },
  { username: '2612114537', name: '黄义政' },
  { username: '2612114538', name: '张雅婷' },
  { username: '2612114539', name: '鲁传伟' },
  { username: '2612114540', name: '翁晗冰' },
  { username: '2612114541', name: '余哲涛' },
  { username: '2512114511', name: '林东林' },
];

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: corsHeaders });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  const users: any[] = [
    {
      username: 'admin',
      name: '系统管理员',
      role: 'admin',
      disabled: false,
      created: Date.now() - 86400000 * 30,
      courseCount: 25,
      pendingHw: 2,
      pendingTasks: 1,
    },
  ];

  let d1Counts: Record<string, number> = {};

  if (env && env.DB && typeof env.DB.prepare === 'function') {
    try {
      const res = await env.DB.prepare(
        `SELECT username, COUNT(*) as cnt 
         FROM assignments 
         WHERE completed = 0 
         GROUP BY username`
      ).all<{ username: string; cnt: number }>();
      (res.results || []).forEach(r => {
        if (r.username) {
          d1Counts[r.username] = Number(r.cnt) || 0;
        }
      });
    } catch (e) {}
  }

  STANDARD_STUDENTS.forEach(stu => {
    users.push({
      username: stu.username,
      name: stu.name,
      role: 'user',
      disabled: false,
      created: Date.now() - 86400000 * 15,
      courseCount: 25,
      pendingHw: d1Counts[stu.username] !== undefined ? d1Counts[stu.username] : 1,
      pendingTasks: 1,
    });
  });

  return new Response(
    JSON.stringify({
      users,
      stats: {
        userCount: users.length,
        courseCount: 25,
        hwCount: Object.values(d1Counts).reduce((a, b) => a + b, 14),
        taskCount: 12,
        noticeCount: 1,
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...corsHeaders,
      },
    }
  );
};
