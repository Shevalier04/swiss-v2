/**
 * Cloudflare Pages Functions - Assignments API (独立用户隔离版)
 * Path: /api/assignments
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

interface DbAssignmentRow {
  id: number;
  username?: string;
  course_name: string;
  title: string;
  deadline: string | null;
  completed: number | boolean;
  created_at: string;
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
 * 提取当前请求用户标识
 */
function getUsername(request: Request, body?: any): string {
  // 1. Authorization: Bearer <token>
  const auth = request.headers.get('Authorization') || request.headers.get('authorization');
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }

  // 2. X-User / X-Username
  const xUser = request.headers.get('X-User') || request.headers.get('X-Username');
  if (xUser && xUser.trim()) return xUser.trim();

  // 3. URL Query
  try {
    const url = new URL(request.url);
    const qUser = url.searchParams.get('username') || url.searchParams.get('user');
    if (qUser && qUser.trim()) return qUser.trim();
  } catch (e) {}

  // 4. Request Body
  if (body?.username && typeof body.username === 'string' && body.username.trim()) {
    return body.username.trim();
  }

  return 'default';
}

/**
 * 平滑确保 assignments 具备 username 字段与索引
 */
async function ensureAssignmentsSchema(db: D1Database): Promise<void> {
  try {
    await db.prepare(
      `CREATE TABLE IF NOT EXISTS assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL DEFAULT 'default',
        course_name TEXT NOT NULL,
        title TEXT NOT NULL,
        deadline TEXT,
        completed INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ).run();
    await db.prepare("ALTER TABLE assignments ADD COLUMN username TEXT NOT NULL DEFAULT 'default'").run().catch(() => {});
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_assignments_user ON assignments(username, created_at DESC)').run().catch(() => {});
  } catch (e) {}
}

function mapRowToAssignment(row: DbAssignmentRow) {
  const isDone = Boolean(row.completed);
  return {
    id: Number(row.id),
    course_name: row.course_name,
    course: row.course_name,
    title: row.title,
    deadline: row.deadline || '',
    due: row.deadline || '',
    completed: isDone,
    done: isDone,
    created_at: row.created_at,
  };
}

/**
 * Handle OPTIONS preflight requests
 */
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};

/**
 * GET /api/assignments
 * 获取当前登录用户的独立作业列表
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!checkDatabase(env)) {
    return errorResponse('Cloudflare D1 数据库尚未绑定为 "DB"', 500);
  }

  const username = getUsername(request);
  await ensureAssignmentsSchema(env.DB);

  try {
    const query = `
      SELECT id, course_name, title, deadline, completed, created_at
      FROM assignments
      WHERE username = ?
      ORDER BY completed ASC, id DESC
    `;
    const { results } = await env.DB.prepare(query).bind(username).all<DbAssignmentRow>();

    const assignments = (results || []).map(mapRowToAssignment);

    return jsonResponse({
      success: true,
      username,
      assignments,
      homework: assignments,
    });
  } catch (error: any) {
    return errorResponse(`获取作业列表失败: ${error?.message || '未知错误'}`, 500);
  }
};

/**
 * POST /api/assignments
 * 为当前用户添加作业 或 批量导入作业
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!checkDatabase(env)) {
    return errorResponse('Cloudflare D1 数据库未绑定，变量名为 DB', 500);
  }

  await ensureAssignmentsSchema(env.DB);

  try {
    const body = (await request.json().catch(() => ({}))) as any;
    const username = getUsername(request, body);

    // 1. 批量导入
    const batchList: any[] = Array.isArray(body)
      ? body
      : Array.isArray(body?.assignments)
      ? body.assignments
      : Array.isArray(body?.items)
      ? body.items
      : null;

    if (batchList) {
      if (batchList.length === 0 && !body?.replace) {
        return jsonResponse({
          success: true,
          username,
          message: '导入作业列表为空',
          count: 0,
          assignments: [],
        });
      }

      const statements: D1PreparedStatement[] = [];

      // 若指定了 replace = true，仅清空当前用户的作业！绝不误删他人！
      if (body?.replace === true) {
        statements.push(env.DB.prepare('DELETE FROM assignments WHERE username = ?').bind(username));
      }

      for (const item of batchList) {
        const title = (item.title || item.name || '').trim();
        if (!title) continue;

        const courseName = (item.course_name || item.course || '常规课程').trim();
        const deadline = (item.deadline || item.due || '').trim();
        const completed = (item.completed || item.done) ? 1 : 0;

        statements.push(
          env.DB.prepare(
            `INSERT INTO assignments (username, course_name, title, deadline, completed, created_at)
             VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
          ).bind(username, courseName, title, deadline, completed)
        );
      }

      if (statements.length > 0) {
        await env.DB.batch(statements);
      }

      const { results } = await env.DB.prepare(
        `SELECT id, course_name, title, deadline, completed, created_at
         FROM assignments
         WHERE username = ?
         ORDER BY completed ASC, id DESC`
      ).bind(username).all<DbAssignmentRow>();

      const assignments = (results || []).map(mapRowToAssignment);

      return jsonResponse(
        {
          success: true,
          username,
          message: `成功为账号 [${username}] ${body?.replace ? '替换并' : ''}导入 ${batchList.length} 项作业`,
          count: batchList.length,
          assignments,
          homework: assignments,
        },
        201
      );
    }

    // 2. 单个添加
    const title = (body.title || '').trim();
    if (!title) {
      return errorResponse('作业内容标题不能为空', 400);
    }

    const courseName = (body.course_name || body.course || '常规课程').trim();
    const deadline = (body.deadline || body.due || '').trim();
    const completed = (body.completed || body.done) ? 1 : 0;

    const insertStmt = env.DB.prepare(
      `INSERT INTO assignments (username, course_name, title, deadline, completed, created_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(username, courseName, title, deadline, completed);

    const result = await insertStmt.run();
    const lastId = result.meta?.last_row_id;

    let createdAssignment = {
      id: lastId || Date.now(),
      course_name: courseName,
      course: courseName,
      title,
      deadline,
      due: deadline,
      completed: Boolean(completed),
      done: Boolean(completed),
      created_at: new Date().toISOString(),
    };

    if (lastId) {
      const fetched = await env.DB.prepare(
        'SELECT id, course_name, title, deadline, completed, created_at FROM assignments WHERE id = ? AND username = ?'
      )
        .bind(lastId, username)
        .first<DbAssignmentRow>();
      if (fetched) {
        createdAssignment = mapRowToAssignment(fetched);
      }
    }

    return jsonResponse(
      {
        success: true,
        username,
        message: '作业添加成功',
        assignment: createdAssignment,
        homework: createdAssignment,
      },
      201
    );
  } catch (error: any) {
    return errorResponse(`添加作业失败: ${error?.message || '未知错误'}`, 500);
  }
};

/**
 * PUT /api/assignments
 * 更新作业（仅修改当前登录用户的作业）
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!checkDatabase(env)) {
    return errorResponse('Cloudflare D1 数据库未绑定，变量名为 DB', 500);
  }

  await ensureAssignmentsSchema(env.DB);

  try {
    const body = (await request.json().catch(() => ({}))) as any;
    const username = getUsername(request, body);

    if (body.id === undefined || body.id === null) {
      return errorResponse('必须提供作业 id', 400);
    }

    const id = Number(body.id);
    if (isNaN(id)) {
      return errorResponse('作业 id 无效', 400);
    }

    const existing = await env.DB.prepare(
      'SELECT id, course_name, title, deadline, completed, created_at FROM assignments WHERE id = ? AND (username = ? OR username = \'default\')'
    )
      .bind(id, username)
      .first<DbAssignmentRow>();

    if (!existing) {
      return errorResponse(`未找到归属账号 [${username}] 的作业 (id: ${id})`, 404);
    }

    let newCompleted = existing.completed ? 1 : 0;
    if (typeof body.completed === 'boolean') {
      newCompleted = body.completed ? 1 : 0;
    } else if (typeof body.done === 'boolean') {
      newCompleted = body.done ? 1 : 0;
    } else if (body.completed === undefined && body.done === undefined && !body.title && !body.deadline && !body.due) {
      newCompleted = existing.completed ? 0 : 1;
    }

    const title = body.title !== undefined ? String(body.title).trim() : existing.title;
    const courseName = body.course_name !== undefined
      ? String(body.course_name).trim()
      : (body.course !== undefined ? String(body.course).trim() : existing.course_name);
    const deadline = body.deadline !== undefined
      ? String(body.deadline).trim()
      : (body.due !== undefined ? String(body.due).trim() : (existing.deadline || ''));

    await env.DB.prepare(
      `UPDATE assignments
       SET course_name = ?, title = ?, deadline = ?, completed = ?, username = ?
       WHERE id = ?`
    )
      .bind(courseName, title, deadline, newCompleted, username, id)
      .run();

    const updated = await env.DB.prepare(
      'SELECT id, course_name, title, deadline, completed, created_at FROM assignments WHERE id = ?'
    )
      .bind(id)
      .first<DbAssignmentRow>();

    const assignment = updated ? mapRowToAssignment(updated) : {
      id,
      course_name: courseName,
      course: courseName,
      title,
      deadline,
      due: deadline,
      completed: Boolean(newCompleted),
      done: Boolean(newCompleted),
      created_at: existing.created_at,
    };

    return jsonResponse({
      success: true,
      message: '作业更新成功',
      assignment,
      homework: assignment,
    });
  } catch (error: any) {
    return errorResponse(`更新作业失败: ${error?.message || '未知错误'}`, 500);
  }
};

/**
 * DELETE /api/assignments
 * 删除作业 或 仅清空当前用户的全部作业
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!checkDatabase(env)) {
    return errorResponse('Cloudflare D1 数据库未绑定，变量名为 DB', 500);
  }

  await ensureAssignmentsSchema(env.DB);

  try {
    const url = new URL(request.url);
    const queryId = url.searchParams.get('id');
    const isAll = url.searchParams.get('all') === 'true' || url.searchParams.get('clearAll') === 'true';

    const body = (await request.json().catch(() => ({}))) as any;
    const username = getUsername(request, body);

    if (isAll || body?.clearAll) {
      await env.DB.prepare('DELETE FROM assignments WHERE username = ?').bind(username).run();
      return jsonResponse({
        success: true,
        message: `已清空账号 [${username}] 的全部作业`,
      });
    }

    let targetId: number | null = null;
    if (queryId) {
      targetId = Number(queryId);
    } else if (body.id !== undefined && body.id !== null) {
      targetId = Number(body.id);
    }

    if (!targetId || isNaN(targetId)) {
      return errorResponse('请在 URL 参数 (?id=...) 或请求体中提供有效的作业 id，或通过 ?all=true 清空当前账号全部作业', 400);
    }

    await env.DB.prepare('DELETE FROM assignments WHERE id = ? AND (username = ? OR username = \'default\')')
      .bind(targetId, username)
      .run();

    return jsonResponse({
      success: true,
      message: '作业删除成功',
      id: targetId,
    });
  } catch (error: any) {
    return errorResponse(`删除作业失败: ${error?.message || '未知错误'}`, 500);
  }
};
