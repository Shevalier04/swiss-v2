/**
 * Cloudflare Pages Functions - Tasks API (独立用户隔离版)
 * Path: /api/tasks
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

interface DbTaskRow {
  id: number;
  username?: string;
  title: string;
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
 * 提取当前请求用户标识 (学号/用户名)
 */
function getUsername(request: Request, body?: any): string {
  // 1. Authorization: Bearer <token>
  const auth = request.headers.get('Authorization') || request.headers.get('authorization');
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }

  // 2. X-User / X-Username 请求头
  const xUser = request.headers.get('X-User') || request.headers.get('X-Username');
  if (xUser && xUser.trim()) return xUser.trim();

  // 3. URL Query: ?username=...
  try {
    const url = new URL(request.url);
    const qUser = url.searchParams.get('username') || url.searchParams.get('user');
    if (qUser && qUser.trim()) return qUser.trim();
  } catch (e) {}

  // 4. Request Body: { username: ... }
  if (body?.username && typeof body.username === 'string' && body.username.trim()) {
    return body.username.trim();
  }

  return 'default';
}

/**
 * 自动平滑升级旧数据表（补充 username 字段与索引）
 */
async function ensureTasksSchema(db: D1Database): Promise<void> {
  try {
    await db.prepare(
      'CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL DEFAULT \'default\', title TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)'
    ).run();
    await db.prepare("ALTER TABLE tasks ADD COLUMN username TEXT NOT NULL DEFAULT 'default'").run().catch(() => {});
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(username, created_at DESC)').run().catch(() => {});
  } catch (e) {}
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
 * GET /api/tasks
 * 获取当前登录用户的独立任务列表
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!checkDatabase(env)) {
    return errorResponse('Cloudflare D1 数据库尚未绑定为 "DB"', 500);
  }

  const username = getUsername(request);
  await ensureTasksSchema(env.DB);

  try {
    const query = 'SELECT id, title, completed, created_at FROM tasks WHERE username = ? ORDER BY id DESC';
    let { results } = await env.DB.prepare(query).bind(username).all<DbTaskRow>();

    const tasks = (results || []).map((row) => ({
      id: Number(row.id),
      title: row.title,
      completed: Boolean(row.completed),
      done: Boolean(row.completed),
      created_at: row.created_at,
    }));

    return jsonResponse({
      success: true,
      username,
      tasks,
    });
  } catch (error: any) {
    return errorResponse(`获取任务失败: ${error?.message || '未知错误'}`, 500);
  }
};

/**
 * POST /api/tasks
 * 为当前用户添加新任务或批量导入新任务
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!checkDatabase(env)) {
    return errorResponse('Cloudflare D1 数据库未绑定，变量名为 DB', 500);
  }

  await ensureTasksSchema(env.DB);

  try {
    const body = (await request.json().catch(() => ({}))) as any;
    const username = getUsername(request, body);

    // 1. 批量导入逻辑
    const batchList: any[] = Array.isArray(body)
      ? body
      : Array.isArray(body?.tasks)
      ? body.tasks
      : Array.isArray(body?.items)
      ? body.items
      : null;

    if (batchList) {
      if (batchList.length === 0) {
        return jsonResponse({
          success: true,
          message: '导入列表为空，无任务添加',
          count: 0,
        });
      }

      const statements: D1PreparedStatement[] = [];
      for (const item of batchList) {
        const titleStr = typeof item === 'string' ? item : (item?.title || item?.name);
        if (titleStr && typeof titleStr === 'string' && titleStr.trim()) {
          const completedVal = (item?.completed || item?.done) ? 1 : 0;
          statements.push(
            env.DB.prepare(
              'INSERT INTO tasks (username, title, completed, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
            ).bind(username, titleStr.trim(), completedVal)
          );
        }
      }

      if (statements.length === 0) {
        return errorResponse('有效任务项为空，请提供包含有效 title 的任务列表', 400);
      }

      await env.DB.batch(statements);

      const { results } = await env.DB.prepare(
        'SELECT id, title, completed, created_at FROM tasks WHERE username = ? ORDER BY id DESC'
      )
        .bind(username)
        .all<DbTaskRow>();

      const tasks = (results || []).map((row) => ({
        id: Number(row.id),
        title: row.title,
        completed: Boolean(row.completed),
        done: Boolean(row.completed),
        created_at: row.created_at,
      }));

      return jsonResponse(
        {
          success: true,
          username,
          message: `成功为账号 [${username}] 批量导入 ${statements.length} 个任务`,
          count: statements.length,
          tasks,
        },
        201
      );
    }

    // 2. 单个添加逻辑
    const rawTitle = body?.title;
    if (!rawTitle || typeof rawTitle !== 'string' || !rawTitle.trim()) {
      return errorResponse('任务标题不能为空', 400);
    }

    const title = rawTitle.trim();
    const insertStmt = env.DB.prepare(
      'INSERT INTO tasks (username, title, completed, created_at) VALUES (?, ?, 0, CURRENT_TIMESTAMP)'
    ).bind(username, title);

    const result = await insertStmt.run();
    const lastId = result.meta?.last_row_id;

    let createdTask: any = {
      id: lastId || Date.now(),
      title,
      completed: false,
      done: false,
      created_at: new Date().toISOString(),
    };

    if (lastId) {
      const fetched = await env.DB.prepare(
        'SELECT id, title, completed, created_at FROM tasks WHERE id = ? AND username = ?'
      )
        .bind(lastId, username)
        .first<DbTaskRow>();
      if (fetched) {
        createdTask = {
          id: Number(fetched.id),
          title: fetched.title,
          completed: Boolean(fetched.completed),
          done: Boolean(fetched.completed),
          created_at: fetched.created_at,
        };
      }
    }

    return jsonResponse(
      {
        success: true,
        username,
        message: '任务创建成功',
        task: createdTask,
      },
      201
    );
  } catch (error: any) {
    return errorResponse(`创建任务失败: ${error?.message || '未知错误'}`, 500);
  }
};

/**
 * PUT /api/tasks
 * 更新任务状态（仅操作当前登录用户的任务）
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!checkDatabase(env)) {
    return errorResponse('Cloudflare D1 数据库未绑定，变量名为 DB', 500);
  }

  await ensureTasksSchema(env.DB);

  try {
    const body = (await request.json().catch(() => ({}))) as {
      id?: number | string;
      completed?: boolean | number;
      done?: boolean | number;
      title?: string;
    };

    const username = getUsername(request, body);

    if (body.id === undefined || body.id === null) {
      return errorResponse('必须提供任务 id', 400);
    }

    const id = Number(body.id);
    if (isNaN(id)) {
      return errorResponse('任务 id 无效', 400);
    }

    const existing = await env.DB.prepare(
      'SELECT id, title, completed, created_at FROM tasks WHERE id = ? AND (username = ? OR username = \'default\')'
    )
      .bind(id, username)
      .first<DbTaskRow>();

    if (!existing) {
      return errorResponse(`未找到属于账号 [${username}] 的任务 (id: ${id})`, 404);
    }

    let newCompleted = existing.completed ? 1 : 0;
    if (typeof body.completed === 'boolean') {
      newCompleted = body.completed ? 1 : 0;
    } else if (typeof body.done === 'boolean') {
      newCompleted = body.done ? 1 : 0;
    } else if (body.completed === undefined && body.done === undefined && body.title === undefined) {
      newCompleted = existing.completed ? 0 : 1;
    }

    const newTitle =
      body.title && typeof body.title === 'string' && body.title.trim()
        ? body.title.trim()
        : existing.title;

    await env.DB.prepare('UPDATE tasks SET title = ?, completed = ?, username = ? WHERE id = ?')
      .bind(newTitle, newCompleted, username, id)
      .run();

    const updated = await env.DB.prepare(
      'SELECT id, title, completed, created_at FROM tasks WHERE id = ?'
    )
      .bind(id)
      .first<DbTaskRow>();

    return jsonResponse({
      success: true,
      message: '任务更新成功',
      task: {
        id: Number(updated?.id ?? id),
        title: updated?.title ?? newTitle,
        completed: Boolean(updated?.completed ?? newCompleted),
        done: Boolean(updated?.completed ?? newCompleted),
        created_at: updated?.created_at ?? existing.created_at,
      },
    });
  } catch (error: any) {
    return errorResponse(`更新任务失败: ${error?.message || '未知错误'}`, 500);
  }
};

/**
 * DELETE /api/tasks
 * 删除任务 或 仅清空当前用户的全部任务
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!checkDatabase(env)) {
    return errorResponse('Cloudflare D1 数据库未绑定，变量名为 DB', 500);
  }

  await ensureTasksSchema(env.DB);

  try {
    const url = new URL(request.url);
    const queryId = url.searchParams.get('id');
    const isAll = url.searchParams.get('all') === 'true' || url.searchParams.get('clearAll') === 'true';

    const body = (await request.json().catch(() => ({}))) as any;
    const username = getUsername(request, body);

    if (isAll || body?.clearAll) {
      // 仅清空当前账号的任务，绝不误删其他同学的任务！
      await env.DB.prepare('DELETE FROM tasks WHERE username = ?').bind(username).run();
      return jsonResponse({
        success: true,
        message: `已清空账号 [${username}] 的全部任务`,
      });
    }

    let targetId: number | null = null;
    if (queryId) {
      targetId = Number(queryId);
    } else if (body.id !== undefined && body.id !== null) {
      targetId = Number(body.id);
    }

    if (!targetId || isNaN(targetId)) {
      return errorResponse('请提供有效的任务 id，或通过 ?all=true 清空当前账号全部任务', 400);
    }

    // 仅删除归属当前用户的该条任务
    await env.DB.prepare('DELETE FROM tasks WHERE id = ? AND (username = ? OR username = \'default\')')
      .bind(targetId, username)
      .run();

    return jsonResponse({
      success: true,
      message: '任务删除成功',
      id: targetId,
    });
  } catch (error: any) {
    return errorResponse(`删除任务失败: ${error?.message || '未知错误'}`, 500);
  }
};
