/**
 * Cloudflare Pages Functions - Tasks API
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
  title: string;
  completed: number | boolean;
  created_at: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
 * 获取任务列表
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  if (!checkDatabase(env)) {
    return errorResponse(
      'Cloudflare D1 数据库尚未绑定！请前往 Cloudflare Pages 控制台 -> Settings -> Functions -> D1 Database Bindings，将变量名设置为 "DB" 并绑定相应 D1 数据库。',
      500
    );
  }

  try {
    const query = 'SELECT id, title, completed, created_at FROM tasks ORDER BY id DESC';
    const { results } = await env.DB.prepare(query).all<DbTaskRow>();

    const tasks = (results || []).map((row) => ({
      id: Number(row.id),
      title: row.title,
      completed: Boolean(row.completed),
      done: Boolean(row.completed),
      created_at: row.created_at,
    }));

    return jsonResponse({
      success: true,
      tasks,
    });
  } catch (error: any) {
    return errorResponse(`获取任务失败: ${error?.message || '未知错误'}`, 500);
  }
};

/**
 * POST /api/tasks
 * 添加新任务
 * Request Body: { title: string }
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!checkDatabase(env)) {
    return errorResponse('Cloudflare D1 数据库未绑定，变量名为 DB', 500);
  }

  try {
    const body = await request.json().catch(() => ({})) as { title?: string };
    const rawTitle = body?.title;

    if (!rawTitle || typeof rawTitle !== 'string' || !rawTitle.trim()) {
      return errorResponse('任务标题不能为空', 400);
    }

    const title = rawTitle.trim();
    const insertStmt = env.DB.prepare(
      'INSERT INTO tasks (title, completed, created_at) VALUES (?, 0, CURRENT_TIMESTAMP)'
    ).bind(title);

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
      const fetched = await env.DB.prepare('SELECT id, title, completed, created_at FROM tasks WHERE id = ?')
        .bind(lastId)
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
 * 更新任务状态或标题
 * Request Body: { id: number, completed?: boolean, done?: boolean, title?: string }
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!checkDatabase(env)) {
    return errorResponse('Cloudflare D1 数据库未绑定，变量名为 DB', 500);
  }

  try {
    const body = await request.json().catch(() => ({})) as {
      id?: number | string;
      completed?: boolean | number;
      done?: boolean | number;
      title?: string;
    };

    if (body.id === undefined || body.id === null) {
      return errorResponse('必须提供任务 id', 400);
    }

    const id = Number(body.id);
    if (isNaN(id)) {
      return errorResponse('任务 id 无效', 400);
    }

    // Check existing
    const existing = await env.DB.prepare('SELECT id, title, completed, created_at FROM tasks WHERE id = ?')
      .bind(id)
      .first<DbTaskRow>();

    if (!existing) {
      return errorResponse(`未找到 id 为 ${id} 的任务`, 404);
    }

    let newCompleted = existing.completed ? 1 : 0;
    if (typeof body.completed === 'boolean') {
      newCompleted = body.completed ? 1 : 0;
    } else if (typeof body.done === 'boolean') {
      newCompleted = body.done ? 1 : 0;
    } else if (body.completed === undefined && body.done === undefined && body.title === undefined) {
      // Toggle if no specific completed/title given
      newCompleted = existing.completed ? 0 : 1;
    }

    const newTitle = (body.title && typeof body.title === 'string' && body.title.trim())
      ? body.title.trim()
      : existing.title;

    await env.DB.prepare('UPDATE tasks SET title = ?, completed = ? WHERE id = ?')
      .bind(newTitle, newCompleted, id)
      .run();

    const updated = await env.DB.prepare('SELECT id, title, completed, created_at FROM tasks WHERE id = ?')
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
 * 删除任务
 * Query params: ?id=123 或 Body: { id: 123 }
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!checkDatabase(env)) {
    return errorResponse('Cloudflare D1 数据库未绑定，变量名为 DB', 500);
  }

  try {
    const url = new URL(request.url);
    const queryId = url.searchParams.get('id');

    let targetId: number | null = null;
    if (queryId) {
      targetId = Number(queryId);
    } else {
      const body = await request.json().catch(() => ({})) as { id?: number | string };
      if (body.id !== undefined && body.id !== null) {
        targetId = Number(body.id);
      }
    }

    if (!targetId || isNaN(targetId)) {
      return errorResponse('请在 URL 参数 (?id=...) 或请求体中提供有效的任务 id', 400);
    }

    await env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(targetId).run();

    return jsonResponse({
      success: true,
      message: '任务删除成功',
      id: targetId,
    });
  } catch (error: any) {
    return errorResponse(`删除任务失败: ${error?.message || '未知错误'}`, 500);
  }
};
