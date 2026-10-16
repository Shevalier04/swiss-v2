/**
 * Cloudflare Pages Functions - Homework Console Pool API
 * Path: /api/homework/console-pool
 * D1 Database Binding: DB
 */

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta?: {
    changes?: number;
    last_row_id?: number;
    rows_read?: number;
    rows_written?: number;
  };
}

interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec<T = unknown>(query: string): Promise<D1Result<T>>;
}

export interface Env {
  DB: D1Database;
}

export interface EventContext<Env, P extends string, Data> {
  request: Request;
  functionPath: string;
  waitUntil: (promise: Promise<any>) => void;
  passThroughOnException: () => void;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  env: Env;
  params: Record<P, string | string[]>;
  data: Data;
}

export type PagesFunction<
  Env = unknown,
  Params extends string = any,
  Data extends Record<string, unknown> = Record<string, unknown>
> = (context: EventContext<Env, Params, Data>) => Response | Promise<Response>;

interface DbPoolRow {
  id: number;
  course: string;
  title: string;
  due?: string | null;
  creator?: string | null;
  created_at?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User, X-Username',
};

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders,
    },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ success: false, error: message }, status);
}

function checkDatabase(env: Env): boolean {
  return !!(env && env.DB && typeof env.DB.prepare === 'function');
}

/**
 * 确保 D1 中存在官方作业池表结构
 */
async function ensureHomeworkPoolSchema(db: D1Database): Promise<void> {
  try {
    await db.prepare(
      `CREATE TABLE IF NOT EXISTS homework_pool (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course TEXT NOT NULL,
        title TEXT NOT NULL,
        due TEXT,
        creator TEXT DEFAULT '管理员',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ).run();
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_hw_pool_course ON homework_pool(course, created_at DESC)').run().catch(() => {});
  } catch (e) {}
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};

/**
 * GET /api/homework/console-pool
 * 获取全局官方作业池列表
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  if (!checkDatabase(env)) {
    return errorResponse('Cloudflare D1 数据库尚未绑定为 "DB"', 500);
  }

  await ensureHomeworkPoolSchema(env.DB);

  try {
    const { results } = await env.DB.prepare(
      `SELECT id, course, title, due, creator, created_at
       FROM homework_pool
       ORDER BY id DESC`
    ).all<DbPoolRow>();

    let list = results || [];

    // 若作业池目前为空，尝试自动将 admin 的真实作业作为初始作业池填充
    if (list.length === 0) {
      try {
        const adminAssignments = await env.DB.prepare(
          `SELECT course_name, title, deadline
           FROM assignments
           WHERE username = 'admin'
           ORDER BY id ASC`
        ).all<{ course_name: string; title: string; deadline?: string }>();

        if (adminAssignments.results && adminAssignments.results.length > 0) {
          const insertStatements: D1PreparedStatement[] = [];
          for (const item of adminAssignments.results) {
            if (!item.title?.trim()) continue;
            insertStatements.push(
              env.DB.prepare(
                `INSERT INTO homework_pool (course, title, due, creator)
                 VALUES (?, ?, ?, 'admin')`
              ).bind(item.course_name || '常规课程', item.title.trim(), item.deadline || '')
            );
          }
          if (insertStatements.length > 0) {
            await env.DB.batch(insertStatements);
            const refetched = await env.DB.prepare(
              `SELECT id, course, title, due, creator, created_at
               FROM homework_pool
               ORDER BY id DESC`
            ).all<DbPoolRow>();
            list = refetched.results || [];
          }
        }
      } catch (e) {}
    }

    return jsonResponse({
      success: true,
      templates: list.map(row => ({
        id: Number(row.id),
        course: row.course,
        title: row.title,
        due: row.due || '',
        creator: row.creator || '系统',
        created_at: row.created_at,
      })),
    });
  } catch (error: any) {
    return errorResponse(`获取作业池失败: ${error?.message || '未知错误'}`, 500);
  }
};

/**
 * POST /api/homework/console-pool
 * 管理作业池：
 * 1. action: 'push' => 全员广播下发
 * 2. action: 'sync_user' => 将指定学号的作业转存入官方作业池
 * 3. 正常创建单个官方作业条目
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!checkDatabase(env)) {
    return errorResponse('Cloudflare D1 数据库未绑定，变量名为 DB', 500);
  }

  await ensureHomeworkPoolSchema(env.DB);

  try {
    const body = (await request.json().catch(() => ({}))) as any;

    // 1. 全员广播推送
    if (body.action === 'push' || body.pushToAll === true) {
      // 提取待推送项目：可以是 body.item，也可以是整个官方池
      let pushItems: { course: string; title: string; due?: string }[] = [];
      if (body.item && body.item.title) {
        pushItems = [{
          course: body.item.course || '常规课程',
          title: body.item.title,
          due: body.item.due || '',
        }];
      } else {
        const { results } = await env.DB.prepare('SELECT course, title, due FROM homework_pool').all<DbPoolRow>();
        pushItems = (results || []).map(r => ({
          course: r.course,
          title: r.title,
          due: r.due || '',
        }));
      }

      if (pushItems.length === 0) {
        return errorResponse('官方作业池为空，没有待推送的作业条目', 400);
      }

      // 查找 D1 中所有不同的学号/用户
      const userRes = await env.DB.prepare('SELECT DISTINCT username FROM assignments').all<{ username: string }>();
      let users = (userRes.results || []).map(u => u.username).filter(Boolean);
      if (!users.includes('admin')) {
        users.push('admin');
      }

      const statements: D1PreparedStatement[] = [];
      for (const u of users) {
        for (const item of pushItems) {
          statements.push(
            env.DB.prepare(
              `INSERT INTO assignments (username, course_name, title, deadline, completed, created_at)
               SELECT ?, ?, ?, ?, 0, CURRENT_TIMESTAMP
               WHERE NOT EXISTS (
                 SELECT 1 FROM assignments
                 WHERE username = ?
                   AND LOWER(TRIM(course_name)) = LOWER(TRIM(?))
                   AND LOWER(TRIM(title)) = LOWER(TRIM(?))
               )`
            ).bind(u, item.course, item.title, item.due || '', u, item.course, item.title)
          );
        }
      }

      if (statements.length > 0) {
        // D1 batch 有每次上限限制，分批次提交
        const chunkSize = 50;
        for (let i = 0; i < statements.length; i += chunkSize) {
          await env.DB.batch(statements.slice(i, i + chunkSize));
        }
      }

      return jsonResponse({
        success: true,
        message: `成功为 ${users.length} 名学生全员推送 ${pushItems.length} 项作业`,
        usersCount: users.length,
        itemsCount: pushItems.length,
      });
    }

    // 2. 将指定管理员账号（如 admin）现有作业同步至官方池
    if (body.action === 'sync_user') {
      const sourceUser = body.username || 'admin';
      const userAssignments = await env.DB.prepare(
        `SELECT course_name, title, deadline
         FROM assignments
         WHERE username = ?`
      ).bind(sourceUser).all<{ course_name: string; title: string; deadline?: string }>();

      const items = userAssignments.results || [];
      if (items.length === 0) {
        return errorResponse(`学号 [${sourceUser}] 当前暂无任何作业记录`, 404);
      }

      const insertStmts: D1PreparedStatement[] = [];
      for (const it of items) {
        if (!it.title?.trim()) continue;
        insertStmts.push(
          env.DB.prepare(
            `INSERT INTO homework_pool (course, title, due, creator)
             SELECT ?, ?, ?, ?
             WHERE NOT EXISTS (
               SELECT 1 FROM homework_pool
               WHERE LOWER(TRIM(course)) = LOWER(TRIM(?))
                 AND LOWER(TRIM(title)) = LOWER(TRIM(?))
             )`
          ).bind(it.course_name || '常规课程', it.title.trim(), it.deadline || '', sourceUser, it.course_name || '常规课程', it.title.trim())
        );
      }

      if (insertStmts.length > 0) {
        await env.DB.batch(insertStmts);
      }

      const refetched = await env.DB.prepare('SELECT id, course, title, due, creator, created_at FROM homework_pool ORDER BY id DESC').all<DbPoolRow>();

      return jsonResponse({
        success: true,
        message: `已将学号 [${sourceUser}] 的 ${items.length} 项作业去重转存至官方作业池`,
        templates: refetched.results || [],
      });
    }

    // 3. 单个录入
    const title = (body.title || '').trim();
    if (!title) {
      return errorResponse('作业内容标题不能为空', 400);
    }

    const course = (body.course || '常规课程').trim();
    const due = (body.due || '').trim();
    const creator = (body.creator || '管理员').trim();

    const insertResult = await env.DB.prepare(
      `INSERT INTO homework_pool (course, title, due, creator, created_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(course, title, due, creator).run();

    const newId = insertResult.meta?.last_row_id || Date.now();

    return jsonResponse(
      {
        success: true,
        message: '已添加至官方作业池',
        template: {
          id: newId,
          course,
          title,
          due,
          creator,
        },
      },
      201
    );
  } catch (error: any) {
    return errorResponse(`操作失败: ${error?.message || '未知错误'}`, 500);
  }
};

/**
 * DELETE /api/homework/console-pool
 * 清空作业池 或 删除指定条目
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!checkDatabase(env)) {
    return errorResponse('Cloudflare D1 数据库未绑定，变量名为 DB', 500);
  }

  await ensureHomeworkPoolSchema(env.DB);

  try {
    const url = new URL(request.url);
    const queryId = url.searchParams.get('id');
    const isAll = url.searchParams.get('all') === 'true' || url.searchParams.get('clearAll') === 'true';

    const body = (await request.json().catch(() => ({}))) as any;

    if (isAll || body?.clearAll) {
      await env.DB.prepare('DELETE FROM homework_pool').run();
      return jsonResponse({
        success: true,
        message: '已清空官方作业池',
        templates: [],
      });
    }

    let targetId: number | null = null;
    if (queryId) {
      targetId = Number(queryId);
    } else if (body.id !== undefined && body.id !== null) {
      targetId = Number(body.id);
    }

    if (!targetId || isNaN(targetId)) {
      return errorResponse('请提供待删除的作业池条目 id，或通过 ?all=true 清空全部', 400);
    }

    await env.DB.prepare('DELETE FROM homework_pool WHERE id = ?').bind(targetId).run();

    const refetched = await env.DB.prepare('SELECT id, course, title, due, creator, created_at FROM homework_pool ORDER BY id DESC').all<DbPoolRow>();

    return jsonResponse({
      success: true,
      message: '作业池条目已删除',
      deletedId: targetId,
      templates: refetched.results || [],
    });
  } catch (error: any) {
    return errorResponse(`删除失败: ${error?.message || '未知错误'}`, 500);
  }
};
