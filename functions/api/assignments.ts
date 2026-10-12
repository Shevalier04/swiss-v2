/**
 * Cloudflare Pages Functions - Assignments API
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
  course_name: string;
  title: string;
  deadline: string | null;
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
 * 获取全部作业
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  if (!checkDatabase(env)) {
    return errorResponse(
      'Cloudflare D1 数据库尚未绑定！请前往 Cloudflare Pages 控制台将 D1 绑定为 "DB"',
      500
    );
  }

  try {
    const query = `
      SELECT id, course_name, title, deadline, completed, created_at
      FROM assignments
      ORDER BY completed ASC, id DESC
    `;
    const { results } = await env.DB.prepare(query).all<DbAssignmentRow>();

    const assignments = (results || []).map(mapRowToAssignment);

    return jsonResponse({
      success: true,
      assignments,
      homework: assignments, // 兼顾前端 homework 字段
    });
  } catch (error: any) {
    return errorResponse(`获取作业列表失败: ${error?.message || '未知错误'}`, 500);
  }
};

/**
 * POST /api/assignments
 * 添加作业 或 批量导入作业
 * 单个作业: { course_name/course, title, deadline/due, completed/done }
 * 批量作业: { assignments: [...], replace?: boolean } 或 { items: [...] } 或 Array
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!checkDatabase(env)) {
    return errorResponse('Cloudflare D1 数据库未绑定，变量名为 DB', 500);
  }

  try {
    const body = (await request.json().catch(() => ({}))) as any;

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
          message: '导入作业列表为空',
          count: 0,
          assignments: [],
        });
      }

      const statements: D1PreparedStatement[] = [];

      if (body?.replace === true) {
        statements.push(env.DB.prepare('DELETE FROM assignments'));
      }

      for (const item of batchList) {
        const title = (item.title || item.name || '').trim();
        if (!title) continue;

        const courseName = (item.course_name || item.course || '常规课程').trim();
        const deadline = (item.deadline || item.due || '').trim();
        const completed = (item.completed || item.done) ? 1 : 0;

        statements.push(
          env.DB.prepare(
            `INSERT INTO assignments (course_name, title, deadline, completed, created_at)
             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
          ).bind(courseName, title, deadline, completed)
        );
      }

      if (statements.length > 0) {
        await env.DB.batch(statements);
      }

      const { results } = await env.DB.prepare(
        `SELECT id, course_name, title, deadline, completed, created_at
         FROM assignments
         ORDER BY completed ASC, id DESC`
      ).all<DbAssignmentRow>();

      const assignments = (results || []).map(mapRowToAssignment);

      return jsonResponse(
        {
          success: true,
          message: `成功${body?.replace ? '替换并' : ''}导入 ${batchList.length} 项作业`,
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
      `INSERT INTO assignments (course_name, title, deadline, completed, created_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(courseName, title, deadline, completed);

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
        'SELECT id, course_name, title, deadline, completed, created_at FROM assignments WHERE id = ?'
      )
        .bind(lastId)
        .first<DbAssignmentRow>();
      if (fetched) {
        createdAssignment = mapRowToAssignment(fetched);
      }
    }

    return jsonResponse(
      {
        success: true,
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
 * 更新作业（切换完成状态、修改标题、修改截止时间等）
 * Request Body: { id, completed?, done?, title?, deadline?, due?, course_name? }
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!checkDatabase(env)) {
    return errorResponse('Cloudflare D1 数据库未绑定，变量名为 DB', 500);
  }

  try {
    const body = (await request.json().catch(() => ({}))) as any;
    if (body.id === undefined || body.id === null) {
      return errorResponse('必须提供作业 id', 400);
    }

    const id = Number(body.id);
    if (isNaN(id)) {
      return errorResponse('作业 id 无效', 400);
    }

    const existing = await env.DB.prepare(
      'SELECT id, course_name, title, deadline, completed, created_at FROM assignments WHERE id = ?'
    )
      .bind(id)
      .first<DbAssignmentRow>();

    if (!existing) {
      return errorResponse(`未找到 id 为 ${id} 的作业`, 404);
    }

    let newCompleted = existing.completed ? 1 : 0;
    if (typeof body.completed === 'boolean') {
      newCompleted = body.completed ? 1 : 0;
    } else if (typeof body.done === 'boolean') {
      newCompleted = body.done ? 1 : 0;
    } else if (body.completed === undefined && body.done === undefined && !body.title && !body.deadline && !body.due) {
      // Toggle
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
       SET course_name = ?, title = ?, deadline = ?, completed = ?
       WHERE id = ?`
    )
      .bind(courseName, title, deadline, newCompleted, id)
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
 * 删除作业 或 一键清空所有作业
 * Query params: ?id=123 或 ?all=true
 * Body: { id: 123 } 或 { clearAll: true }
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!checkDatabase(env)) {
    return errorResponse('Cloudflare D1 数据库未绑定，变量名为 DB', 500);
  }

  try {
    const url = new URL(request.url);
    const queryId = url.searchParams.get('id');
    const isAll = url.searchParams.get('all') === 'true' || url.searchParams.get('clearAll') === 'true';

    const body = (await request.json().catch(() => ({}))) as any;

    if (isAll || body?.clearAll) {
      await env.DB.prepare('DELETE FROM assignments').run();
      return jsonResponse({
        success: true,
        message: '已清空全部作业',
      });
    }

    let targetId: number | null = null;
    if (queryId) {
      targetId = Number(queryId);
    } else if (body.id !== undefined && body.id !== null) {
      targetId = Number(body.id);
    }

    if (!targetId || isNaN(targetId)) {
      return errorResponse('请在 URL 参数 (?id=...) 或请求体中提供有效的作业 id，或通过 ?all=true 清空全部', 400);
    }

    await env.DB.prepare('DELETE FROM assignments WHERE id = ?').bind(targetId).run();

    return jsonResponse({
      success: true,
      message: '作业删除成功',
      id: targetId,
    });
  } catch (error: any) {
    return errorResponse(`删除作业失败: ${error?.message || '未知错误'}`, 500);
  }
};
