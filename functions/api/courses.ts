/**
 * Cloudflare Pages Functions - Courses API (独立用户隔离版)
 * Path: /api/courses
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

interface DbCourseRow {
  id: number;
  username?: string;
  name: string;
  teacher: string | null;
  classroom: string | null;
  weekday: number;
  start_slot: number;
  end_slot: number;
  weeks: string | null;
  color: string | null;
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
 * 提取当前请求的用户标识
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
 * 平滑确保 courses 具备 username 字段与索引
 */
async function ensureCoursesSchema(db: D1Database): Promise<void> {
  try {
    await db.prepare(
      `CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL DEFAULT 'default',
        name TEXT NOT NULL,
        teacher TEXT,
        classroom TEXT,
        weekday INTEGER NOT NULL,
        start_slot INTEGER NOT NULL,
        end_slot INTEGER NOT NULL,
        weeks TEXT,
        color TEXT DEFAULT '#4f63e8',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ).run();
    await db.prepare("ALTER TABLE courses ADD COLUMN username TEXT NOT NULL DEFAULT 'default'").run().catch(() => {});
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_courses_user ON courses(username, weekday)').run().catch(() => {});
  } catch (e) {}
}

function mapRowToCourse(row: DbCourseRow) {
  const weekday = Number(row.weekday ?? 0);
  const startSlot = Number(row.start_slot ?? 1);
  const endSlot = Number(row.end_slot ?? startSlot);
  return {
    id: Number(row.id),
    name: row.name,
    teacher: row.teacher || '',
    room: row.classroom || '',
    classroom: row.classroom || '',
    day: weekday,
    weekday,
    s: startSlot,
    start_slot: startSlot,
    e: endSlot,
    end_slot: endSlot,
    weeks: row.weeks || '1-18周',
    color: row.color || '#4f63e8',
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
 * GET /api/courses
 * 查询当前登录用户的独立课程列表
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!checkDatabase(env)) {
    return errorResponse('Cloudflare D1 数据库尚未绑定为 "DB"', 500);
  }

  const username = getUsername(request);
  await ensureCoursesSchema(env.DB);

  try {
    const query = `
      SELECT id, name, teacher, classroom, weekday, start_slot, end_slot, weeks, color, created_at
      FROM courses
      WHERE username = ?
      ORDER BY weekday ASC, start_slot ASC, id ASC
    `;
    const { results } = await env.DB.prepare(query).bind(username).all<DbCourseRow>();

    const courses = (results || []).map(mapRowToCourse);

    return jsonResponse({
      success: true,
      username,
      courses,
    });
  } catch (error: any) {
    return errorResponse(`获取课程失败: ${error?.message || '未知错误'}`, 500);
  }
};

/**
 * POST /api/courses
 * 添加课程 或 批量导入课程 (仅写入当前登录账号)
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!checkDatabase(env)) {
    return errorResponse('Cloudflare D1 数据库未绑定，变量名为 DB', 500);
  }

  await ensureCoursesSchema(env.DB);

  try {
    const body = (await request.json().catch(() => ({}))) as any;
    const username = getUsername(request, body);

    // 1. 批量插入/导入逻辑
    const batchList: any[] = Array.isArray(body)
      ? body
      : Array.isArray(body?.courses)
      ? body.courses
      : Array.isArray(body?.items)
      ? body.items
      : null;

    if (batchList) {
      if (batchList.length === 0 && !body?.replace) {
        return jsonResponse({
          success: true,
          username,
          message: '导入课程列表为空',
          count: 0,
          courses: [],
        });
      }

      const statements: D1PreparedStatement[] = [];

      // 如果指定了 replace = true，仅清空当前用户的课程！绝不影响他人！
      if (body?.replace === true) {
        statements.push(env.DB.prepare('DELETE FROM courses WHERE username = ?').bind(username));
      }

      for (const item of batchList) {
        const name = (item.name || '').trim();
        if (!name) continue;

        const teacher = (item.teacher || '').trim();
        const classroom = (item.classroom || item.room || '').trim();
        const weekday = Number(item.weekday !== undefined ? item.weekday : (item.day !== undefined ? item.day : 0));
        const startSlot = Number(item.start_slot !== undefined ? item.start_slot : (item.s !== undefined ? item.s : 1));
        const endSlot = Number(item.end_slot !== undefined ? item.end_slot : (item.e !== undefined ? item.e : startSlot));
        const weeks = (item.weeks || '1-18周').trim();
        const color = (item.color || '#4f63e8').trim();

        statements.push(
          env.DB.prepare(
            `INSERT INTO courses (username, name, teacher, classroom, weekday, start_slot, end_slot, weeks, color, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
          ).bind(username, name, teacher, classroom, weekday, startSlot, endSlot, weeks, color)
        );
      }

      if (statements.length > 0) {
        await env.DB.batch(statements);
      }

      const { results } = await env.DB.prepare(
        `SELECT id, name, teacher, classroom, weekday, start_slot, end_slot, weeks, color, created_at
         FROM courses
         WHERE username = ?
         ORDER BY weekday ASC, start_slot ASC, id ASC`
      ).bind(username).all<DbCourseRow>();

      const courses = (results || []).map(mapRowToCourse);

      return jsonResponse(
        {
          success: true,
          username,
          message: `成功为账号 [${username}] ${body?.replace ? '替换并' : ''}导入 ${batchList.length} 门课程`,
          count: batchList.length,
          courses,
        },
        201
      );
    }

    // 2. 单门课程添加
    const name = (body.name || '').trim();
    if (!name) {
      return errorResponse('课程名称不能为空', 400);
    }

    const teacher = (body.teacher || '').trim();
    const classroom = (body.classroom || body.room || '').trim();
    const weekday = Number(body.weekday !== undefined ? body.weekday : (body.day !== undefined ? body.day : 0));
    const startSlot = Number(body.start_slot !== undefined ? body.start_slot : (body.s !== undefined ? body.s : 1));
    const endSlot = Number(body.end_slot !== undefined ? body.end_slot : (body.e !== undefined ? body.e : startSlot));
    const weeks = (body.weeks || '1-18周').trim();
    const color = (body.color || '#4f63e8').trim();

    const insertStmt = env.DB.prepare(
      `INSERT INTO courses (username, name, teacher, classroom, weekday, start_slot, end_slot, weeks, color, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(username, name, teacher, classroom, weekday, startSlot, endSlot, weeks, color);

    const result = await insertStmt.run();
    const lastId = result.meta?.last_row_id;

    let createdCourse = {
      id: lastId || Date.now(),
      name,
      teacher,
      room: classroom,
      classroom,
      day: weekday,
      weekday,
      s: startSlot,
      start_slot: startSlot,
      e: endSlot,
      end_slot: endSlot,
      weeks,
      color,
      created_at: new Date().toISOString(),
    };

    if (lastId) {
      const fetched = await env.DB.prepare(
        'SELECT id, name, teacher, classroom, weekday, start_slot, end_slot, weeks, color, created_at FROM courses WHERE id = ? AND username = ?'
      )
        .bind(lastId, username)
        .first<DbCourseRow>();
      if (fetched) {
        createdCourse = mapRowToCourse(fetched);
      }
    }

    return jsonResponse(
      {
        success: true,
        username,
        message: '课程创建成功',
        course: createdCourse,
      },
      201
    );
  } catch (error: any) {
    return errorResponse(`创建课程失败: ${error?.message || '未知错误'}`, 500);
  }
};

/**
 * PUT /api/courses
 * 更新课程信息（仅操作当前登录用户的课程）
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!checkDatabase(env)) {
    return errorResponse('Cloudflare D1 数据库未绑定，变量名为 DB', 500);
  }

  await ensureCoursesSchema(env.DB);

  try {
    const body = (await request.json().catch(() => ({}))) as any;
    const username = getUsername(request, body);

    if (body.id === undefined || body.id === null) {
      return errorResponse('必须提供课程 id', 400);
    }

    const id = Number(body.id);
    if (isNaN(id)) {
      return errorResponse('课程 id 无效', 400);
    }

    const existing = await env.DB.prepare(
      'SELECT id, name, teacher, classroom, weekday, start_slot, end_slot, weeks, color, created_at FROM courses WHERE id = ? AND (username = ? OR username = \'default\')'
    )
      .bind(id, username)
      .first<DbCourseRow>();

    if (!existing) {
      return errorResponse(`未找到归属账号 [${username}] 的课程 (id: ${id})`, 404);
    }

    const name = body.name !== undefined ? String(body.name).trim() : existing.name;
    const teacher = body.teacher !== undefined ? String(body.teacher).trim() : (existing.teacher || '');
    const classroom = body.classroom !== undefined
      ? String(body.classroom).trim()
      : (body.room !== undefined ? String(body.room).trim() : (existing.classroom || ''));
    const weekday = body.weekday !== undefined
      ? Number(body.weekday)
      : (body.day !== undefined ? Number(body.day) : existing.weekday);
    const startSlot = body.start_slot !== undefined
      ? Number(body.start_slot)
      : (body.s !== undefined ? Number(body.s) : existing.start_slot);
    const endSlot = body.end_slot !== undefined
      ? Number(body.end_slot)
      : (body.e !== undefined ? Number(body.e) : existing.end_slot);
    const weeks = body.weeks !== undefined ? String(body.weeks).trim() : (existing.weeks || '1-18周');
    const color = body.color !== undefined ? String(body.color).trim() : (existing.color || '#4f63e8');

    await env.DB.prepare(
      `UPDATE courses
       SET name = ?, teacher = ?, classroom = ?, weekday = ?, start_slot = ?, end_slot = ?, weeks = ?, color = ?, username = ?
       WHERE id = ?`
    )
      .bind(name, teacher, classroom, weekday, startSlot, endSlot, weeks, color, username, id)
      .run();

    const updated = await env.DB.prepare(
      'SELECT id, name, teacher, classroom, weekday, start_slot, end_slot, weeks, color, created_at FROM courses WHERE id = ?'
    )
      .bind(id)
      .first<DbCourseRow>();

    return jsonResponse({
      success: true,
      message: '课程更新成功',
      course: updated ? mapRowToCourse(updated) : { id, name, teacher, classroom, weekday, start_slot: startSlot, end_slot: endSlot, weeks, color },
    });
  } catch (error: any) {
    return errorResponse(`更新课程失败: ${error?.message || '未知错误'}`, 500);
  }
};

/**
 * DELETE /api/courses
 * 删除课程 或 仅清空当前用户的全部课程
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!checkDatabase(env)) {
    return errorResponse('Cloudflare D1 数据库未绑定，变量名为 DB', 500);
  }

  await ensureCoursesSchema(env.DB);

  try {
    const url = new URL(request.url);
    const queryId = url.searchParams.get('id');
    const isAll = url.searchParams.get('all') === 'true' || url.searchParams.get('clearAll') === 'true';

    const body = (await request.json().catch(() => ({}))) as any;
    const username = getUsername(request, body);

    if (isAll || body?.clearAll) {
      // 仅清空当前用户的课程
      await env.DB.prepare('DELETE FROM courses WHERE username = ?').bind(username).run();
      return jsonResponse({
        success: true,
        message: `已清空账号 [${username}] 的全部课程`,
      });
    }

    let targetId: number | null = null;
    if (queryId) {
      targetId = Number(queryId);
    } else if (body.id !== undefined && body.id !== null) {
      targetId = Number(body.id);
    }

    if (!targetId || isNaN(targetId)) {
      return errorResponse('请在 URL 参数 (?id=...) 或请求体中提供有效的课程 id，或通过 ?all=true 清空当前账号全部课程', 400);
    }

    await env.DB.prepare('DELETE FROM courses WHERE id = ? AND (username = ? OR username = \'default\')')
      .bind(targetId, username)
      .run();

    return jsonResponse({
      success: true,
      message: '课程删除成功',
      id: targetId,
    });
  } catch (error: any) {
    return errorResponse(`删除课程失败: ${error?.message || '未知错误'}`, 500);
  }
};
