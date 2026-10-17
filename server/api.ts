import express, { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { dbStore } from './store';
import { getDefaultTemplateCourses, PALETTE } from './data';
import { pushService } from './pushService';

export const apiRouter = express.Router();
apiRouter.use(express.json({ limit: '25mb' }));
apiRouter.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Simple Bearer token / username resolution
export function getCurrentUser(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  const queryUser = req.query.user as string;
  if (queryUser) return queryUser;
  return null;
}

// Handler for homework synchronization
export async function handleSyncHomework(req: Request, res: Response) {
  try {
    const username = getCurrentUser(req) || (req.body && req.body.username) || 'admin';
    const { cookies, account } = req.body || {};

    const pool = dbStore.getConsoleHomework();
    const syncedItems: any[] = [];

    // Sync any un-synced console homework items to the user's homework list
    pool.forEach(item => {
      const existing = dbStore.getHomework(username).find(
        h => h.course === item.course && h.title.trim() === item.title.trim()
      );
      if (!existing) {
        const added = dbStore.addHomework(username, {
          course: item.course,
          title: item.title,
          due: item.due,
        });
        syncedItems.push(added);
      }
    });

    return res.json({
      success: true,
      message: `已同步 ${syncedItems.length} 项作业`,
      syncedCount: syncedItems.length,
      items: dbStore.getHomework(username)
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || '同步失败' });
  }
}

// Auth endpoints
apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '请输入学号/用户名和密码' });
  }

  const user = dbStore.getUser(username);
  if (!user) {
    return res.status(404).json({ error: '账号不存在，请确认学号' });
  }

  if (user.disabled) {
    return res.status(403).json({ error: '该账号已被管理员禁用' });
  }

  if (!dbStore.validatePassword(username, password)) {
    return res.status(401).json({ error: '密码错误' });
  }

  return res.json({
    token: user.username,
    user: {
      username: user.username,
      name: user.name,
      role: user.role
    }
  });
});

apiRouter.post('/auth/register', (req: Request, res: Response) => {
  const { username, password, withTemplate } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  if (!/^[\w\u4e00-\u9fa5]{2,16}$/.test(username)) {
    return res.status(400).json({ error: '用户名需 2-16 位中英文数字下划线' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: '密码至少 4 位' });
  }

  try {
    const newUser = dbStore.registerUser(username, password, withTemplate ?? true);
    return res.json({
      token: newUser.username,
      user: {
        username: newUser.username,
        name: newUser.name,
        role: newUser.role
      }
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || '注册失败' });
  }
});

apiRouter.get('/auth/me', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  if (!username) return res.status(401).json({ error: '未登录' });

  const user = dbStore.getUser(username);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  return res.json({
    username: user.username,
    name: user.name,
    role: user.role,
    disabled: user.disabled
  });
});

// Helper to normalize course fields (compat with D1 and local server)
function normalizeCourseInput(item: any, defaultId?: number) {
  const room = item.room || item.classroom || '';
  const day = Number(item.day !== undefined ? item.day : (item.weekday !== undefined ? item.weekday : 0));
  const s = Number(item.s !== undefined ? item.s : (item.start_slot !== undefined ? item.start_slot : 1));
  const e = Number(item.e !== undefined ? item.e : (item.end_slot !== undefined ? item.end_slot : s));
  return {
    id: Number(item.id) || defaultId || Date.now() + Math.floor(Math.random() * 100000),
    name: String(item.name || '').trim(),
    teacher: item.teacher ? String(item.teacher).trim() : '',
    room,
    day,
    s,
    e,
    weeks: item.weeks || '1-18周',
    color: item.color || PALETTE[0],
  };
}

// Helper to normalize assignment fields
function normalizeAssignmentInput(item: any) {
  const course = item.course || item.course_name || '常规课程';
  const title = item.title ? String(item.title).trim() : '';
  const due = item.due || item.deadline || '';
  const done = Boolean(item.completed !== undefined ? item.completed : item.done);
  return {
    id: item.id ? Number(item.id) : undefined,
    course,
    title,
    due,
    done,
  };
}

// ==========================================
// Courses endpoints (D1 & local compatible)
// ==========================================
apiRouter.get('/courses', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  if (!username) return res.status(401).json({ error: '未登录' });
  const courses = dbStore.getCourses(username);
  return res.json({ success: true, courses });
});

apiRouter.post('/courses', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  if (!username) return res.status(401).json({ error: '未登录' });

  // 1. Batch support: { courses: [...], replace?: boolean } or array
  const rawList = Array.isArray(req.body)
    ? req.body
    : (Array.isArray(req.body?.courses) ? req.body.courses : null);

  if (rawList) {
    const replace = req.body?.replace === true || Array.isArray(req.body);
    const normalizedList = rawList.map((c: any) => normalizeCourseInput(c));

    if (replace) {
      dbStore.saveCourses(username, normalizedList);
    } else {
      const existing = dbStore.getCourses(username);
      const combined = [...existing];
      normalizedList.forEach((c: any) => {
        combined.push({
          id: c.id || Date.now() + Math.floor(Math.random() * 1000),
          ...c,
        });
      });
      dbStore.saveCourses(username, combined);
    }
    const result = dbStore.getCourses(username);
    return res.json({ success: true, count: result.length, courses: result });
  }

  // 2. Single course insertion
  const norm = normalizeCourseInput(req.body);
  if (!norm.name) return res.status(400).json({ error: '课程名称不能为空' });

  const created = dbStore.addCourse(username, {
    name: norm.name,
    teacher: norm.teacher,
    room: norm.room,
    day: norm.day,
    s: norm.s,
    e: norm.e,
    weeks: norm.weeks,
    color: norm.color,
  });

  return res.json({ success: true, course: created });
});

apiRouter.put('/courses', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  if (!username) return res.status(401).json({ error: '未登录' });
  const id = Number(req.body?.id);
  if (!id) return res.status(400).json({ error: '请提供课程 id' });

  try {
    const norm = normalizeCourseInput(req.body);
    const patchData: any = {};
    if (req.body.name !== undefined) patchData.name = norm.name;
    if (req.body.teacher !== undefined) patchData.teacher = norm.teacher;
    if (req.body.room !== undefined || req.body.classroom !== undefined) patchData.room = norm.room;
    if (req.body.day !== undefined || req.body.weekday !== undefined) patchData.day = norm.day;
    if (req.body.s !== undefined || req.body.start_slot !== undefined) patchData.s = norm.s;
    if (req.body.e !== undefined || req.body.end_slot !== undefined) patchData.e = norm.e;
    if (req.body.weeks !== undefined) patchData.weeks = norm.weeks;
    if (req.body.color !== undefined) patchData.color = norm.color;

    const updated = dbStore.updateCourse(username, id, patchData);
    return res.json({ success: true, course: updated });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

apiRouter.put('/courses/:id', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  if (!username) return res.status(401).json({ error: '未登录' });
  const id = Number(req.params.id);

  try {
    const norm = normalizeCourseInput(req.body);
    const updated = dbStore.updateCourse(username, id, norm);
    return res.json({ success: true, course: updated });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/courses', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  if (!username) return res.status(401).json({ error: '未登录' });

  const isAll = req.query.all === 'true' || req.body?.all === true;
  if (isAll) {
    dbStore.saveCourses(username, []);
    return res.json({ success: true, count: 0, courses: [] });
  }

  const id = Number(req.query.id || req.body?.id);
  if (!id) return res.status(400).json({ error: '请提供课程 id 或使用 ?all=true' });

  dbStore.deleteCourse(username, id);
  return res.json({ success: true, deletedId: id });
});

apiRouter.delete('/courses/:id', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  if (!username) return res.status(401).json({ error: '未登录' });
  const id = Number(req.params.id);
  dbStore.deleteCourse(username, id);
  return res.json({ success: true, deletedId: id });
});

apiRouter.post('/courses/batch-replace', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  if (!username) return res.status(401).json({ error: '未登录' });
  const { courses } = req.body;
  if (!Array.isArray(courses)) return res.status(400).json({ error: '数据格式错误' });

  const normalized = courses.map(c => normalizeCourseInput(c));
  dbStore.saveCourses(username, normalized);
  return res.json({ success: true, count: normalized.length, courses: normalized });
});

apiRouter.post('/courses/reset-template', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  if (!username) return res.status(401).json({ error: '未登录' });
  const tpl = getDefaultTemplateCourses();
  dbStore.saveCourses(username, tpl);
  return res.json({ success: true, courses: tpl });
});

// ==========================================
// Homework & Assignments endpoints
// ==========================================
function getFormattedAssignments(username: string) {
  const hw = dbStore.getHomework(username);
  return hw.map(h => ({
    id: h.id,
    course: h.course,
    course_name: h.course,
    title: h.title,
    due: h.due || '',
    deadline: h.due || '',
    done: h.done,
    completed: h.done ? 1 : 0,
  }));
}

// GET /api/homework & /api/assignments
const handleGetAssignments = (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  if (!username) return res.status(401).json({ error: '未登录' });
  const hw = dbStore.getHomework(username);
  const formatted = getFormattedAssignments(username);
  return res.json({ success: true, homework: hw, assignments: formatted });
};

apiRouter.get('/homework', handleGetAssignments);
apiRouter.get('/assignments', handleGetAssignments);

// POST /api/homework & /api/assignments (single or batch)
const handlePostAssignments = (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  if (!username) return res.status(401).json({ error: '未登录' });

  // Batch support: { items: [...] } or { assignments: [...] } or array
  const rawList = Array.isArray(req.body)
    ? req.body
    : (Array.isArray(req.body?.items)
      ? req.body.items
      : (Array.isArray(req.body?.assignments) ? req.body.assignments : null));

  if (rawList) {
    const replace = req.body?.replace === true;
    let newCount = 0;
    let updatedCount = 0;
    if (replace) {
      const current = dbStore.getHomework(username);
      current.forEach(c => dbStore.deleteHomework(username, c.id));
      newCount = rawList.length;
    } else {
      // Upsert: deduplicate by course.trim().toLowerCase() and title.trim().toLowerCase()
      let current = dbStore.getHomework(username);
      rawList.forEach((item: any) => {
        const norm = normalizeAssignmentInput(item);
        const cName = (norm.course || '').trim().toLowerCase();
        const tName = (norm.title || '').trim().toLowerCase();
        const matchIndex = current.findIndex(h =>
          (h.course || '').trim().toLowerCase() === cName &&
          (h.title || '').trim().toLowerCase() === tName
        );
        if (matchIndex !== -1) {
          updatedCount++;
          const match = current[matchIndex];
          dbStore.deleteHomework(username, match.id);
          current.splice(matchIndex, 1);
        } else {
          newCount++;
        }
      });
    }
    const addedList = rawList.map((item: any) => {
      const norm = normalizeAssignmentInput(item);
      return dbStore.addHomework(username, {
        course: norm.course,
        title: norm.title || '待办作业',
        due: norm.due || undefined,
      });
    });
    const all = dbStore.getHomework(username);
    const formatted = getFormattedAssignments(username);
    return res.json({
      success: true,
      added: addedList,
      homework: all,
      assignments: formatted,
      stats: { total: addedList.length, newCount, updatedCount },
    });
  }

  // Single assignment
  const norm = normalizeAssignmentInput(req.body);
  if (!norm.title) return res.status(400).json({ error: '作业内容不能为空' });

  const added = dbStore.addHomework(username, {
    course: norm.course,
    title: norm.title,
    due: norm.due || undefined,
  });

  const formattedItem = {
    id: added.id,
    course: added.course,
    course_name: added.course,
    title: added.title,
    due: added.due,
    deadline: added.due,
    done: added.done,
    completed: added.done ? 1 : 0,
  };

  return res.json({
    success: true,
    homework: added,
    assignment: formattedItem,
  });
};

apiRouter.post('/homework', handlePostAssignments);
apiRouter.post('/assignments', handlePostAssignments);

// PUT /api/homework & /api/assignments (toggle or update)
const handleUpdateAssignment = (req: Request, res: Response) => {
  try {
    const username = getCurrentUser(req);
    if (!username) return res.status(401).json({ success: false, error: '未登录' });

    const id = Number(req.params?.id || req.body?.id || req.body?.homework_id);
    if (!id || isNaN(id)) return res.status(400).json({ success: false, error: '请提供有效的作业 id' });

    const { course, title, due, deadline, done, completed } = req.body || {};
    const courseVal = course !== undefined ? course : req.body?.course_name;
    const dueVal = due !== undefined ? due : deadline;
    const doneVal = done !== undefined ? done : (completed !== undefined ? Boolean(completed) : undefined);

    let updated;
    if (courseVal !== undefined || title !== undefined || dueVal !== undefined || doneVal !== undefined) {
      updated = dbStore.updateHomework(username, id, {
        course: courseVal,
        title,
        due: dueVal,
        done: doneVal,
      });
    } else {
      updated = dbStore.toggleHomework(username, id);
    }

    const formattedItem = {
      id: updated.id,
      course: updated.course,
      course_name: updated.course,
      title: updated.title,
      due: updated.due,
      deadline: updated.due,
      done: updated.done,
      completed: updated.done ? 1 : 0,
    };

    return res.json({
      success: true,
      homework: updated,
      assignment: formattedItem,
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message || '更新作业失败' });
  }
};

apiRouter.put('/homework/:id/toggle', handleUpdateAssignment);
apiRouter.put('/assignments/:id/toggle', handleUpdateAssignment);
apiRouter.put('/homework/:id', handleUpdateAssignment);
apiRouter.put('/assignments/:id', handleUpdateAssignment);
apiRouter.put('/homework', handleUpdateAssignment);
apiRouter.put('/assignments', handleUpdateAssignment);

// DELETE /api/homework & /api/assignments
const handleDeleteAssignments = (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  if (!username) return res.status(401).json({ error: '未登录' });

  const isAll = req.query.all === 'true' || req.body?.all === true;
  if (isAll) {
    const list = dbStore.getHomework(username);
    list.forEach(h => dbStore.deleteHomework(username, h.id));
    return res.json({ success: true, count: 0, homework: [], assignments: [] });
  }

  const id = Number(req.params.id || req.query.id || req.body?.id);
  if (!id) return res.status(400).json({ error: '请提供作业 id 或使用 ?all=true' });

  dbStore.deleteHomework(username, id);
  return res.json({ success: true, deletedId: id });
};

apiRouter.delete('/homework', handleDeleteAssignments);
apiRouter.delete('/assignments', handleDeleteAssignments);
apiRouter.delete('/homework/:id', handleDeleteAssignments);
apiRouter.delete('/assignments/:id', handleDeleteAssignments);

// Console Homework Pool endpoints
apiRouter.get('/homework/console-pool', (_req: Request, res: Response) => {
  return res.json({ templates: dbStore.getConsoleHomework() });
});

apiRouter.post('/homework/console-pool', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  const user = username ? dbStore.getUser(username) : null;
  const body = req.body || {};

  // 1. 全员广播推送
  if (body.action === 'push' || body.pushToAll === true) {
    let pushItems: { course: string; title: string; due?: string }[] = [];
    if (body.item && body.item.title) {
      pushItems = [{
        course: body.item.course || '常规课程',
        title: String(body.item.title).trim(),
        due: body.item.due ? String(body.item.due).trim() : undefined,
      }];
    } else {
      pushItems = dbStore.getConsoleHomework().map(h => ({
        course: h.course,
        title: h.title,
        due: h.due,
      }));
    }

    if (pushItems.length === 0) {
      return res.status(400).json({ error: '官方作业池为空，暂无待推送的作业' });
    }

    const allUsers = dbStore.getAllUsers();
    allUsers.forEach(u => {
      pushItems.forEach(it => {
        dbStore.addHomework(u.username, {
          course: it.course,
          title: it.title,
          due: it.due,
        });
      });
    });

    return res.json({
      success: true,
      message: `已向全员 ${allUsers.length} 名学生推送 ${pushItems.length} 项作业`,
      usersCount: allUsers.length,
      itemsCount: pushItems.length,
    });
  }

  // 2. 将指定管理员账号（如 admin）转存为官方作业池
  if (body.action === 'sync_user') {
    const targetUser = body.username || 'admin';
    const studentHw = dbStore.getHomework(targetUser);
    if (!studentHw || studentHw.length === 0) {
      return res.status(404).json({ error: `账号 [${targetUser}] 当前暂无作业数据` });
    }

    studentHw.forEach(it => {
      dbStore.addConsoleHomework({
        course: it.course,
        title: it.title,
        due: it.due,
        creator: targetUser,
      });
    });

    return res.json({
      success: true,
      message: `已成功将账号 [${targetUser}] 的 ${studentHw.length} 项作业转入官方作业池`,
      templates: dbStore.getConsoleHomework(),
    });
  }

  if (user && user.role !== 'admin') {
    return res.status(403).json({ error: '仅管理员可通过终端管理官方作业池' });
  }

  const { course, title, due } = body;
  if (!title) return res.status(400).json({ error: '作业内容不能为空' });
  const item = dbStore.addConsoleHomework({
    course: course || '其他',
    title: String(title).trim(),
    due: due ? String(due).trim() : undefined,
    creator: user?.name || username || '系统管理员'
  });
  return res.json({ template: item });
});

apiRouter.post('/homework/console-pool/push', (req: Request, res: Response) => {
  const body = req.body || {};
  let pushItems: { course: string; title: string; due?: string }[] = [];
  if (body.item && body.item.title) {
    pushItems = [{
      course: body.item.course || '常规课程',
      title: String(body.item.title).trim(),
      due: body.item.due ? String(body.item.due).trim() : undefined,
    }];
  } else {
    pushItems = dbStore.getConsoleHomework().map(h => ({
      course: h.course,
      title: h.title,
      due: h.due,
    }));
  }

  if (pushItems.length === 0) {
    return res.status(400).json({ error: '官方作业池为空，暂无待推送的作业' });
  }

  const allUsers = dbStore.getAllUsers();
  allUsers.forEach(u => {
    pushItems.forEach(it => {
      dbStore.addHomework(u.username, {
        course: it.course,
        title: it.title,
        due: it.due,
      });
    });
  });

  return res.json({
    success: true,
    message: `已向全员 ${allUsers.length} 名学生推送 ${pushItems.length} 项作业`,
    usersCount: allUsers.length,
    itemsCount: pushItems.length,
  });
});

apiRouter.post('/homework/console-pool/sync-user', (req: Request, res: Response) => {
  const targetUser = req.body?.username || 'admin';
  const studentHw = dbStore.getHomework(targetUser);
  if (!studentHw || studentHw.length === 0) {
    return res.status(404).json({ error: `账号 [${targetUser}] 当前暂无作业数据` });
  }

  studentHw.forEach(it => {
    dbStore.addConsoleHomework({
      course: it.course,
      title: it.title,
      due: it.due,
      creator: targetUser,
    });
  });

  return res.json({
    success: true,
    message: `已成功将学号 [${targetUser}] 的 ${studentHw.length} 项作业转入官方作业池`,
    templates: dbStore.getConsoleHomework(),
  });
});

apiRouter.post('/homework/console-pool/batch-sync', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  if (!username) return res.status(401).json({ error: '未登录' });
  const { items } = req.body;
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: '请提供待导入的作业列表' });
  }

  let current = dbStore.getHomework(username);
  let newCount = 0;
  let updatedCount = 0;

  const added = items.map(it => {
    const course = (it.course || '其他').trim();
    const title = (it.title || '待办作业').trim();
    const matchIndex = current.findIndex(h =>
      (h.course || '').trim().toLowerCase() === course.toLowerCase() &&
      (h.title || '').trim().toLowerCase() === title.toLowerCase()
    );
    let preservedDone = false;
    if (matchIndex !== -1) {
      updatedCount++;
      const match = current[matchIndex];
      preservedDone = Boolean(match.done);
      dbStore.deleteHomework(username, match.id);
      current.splice(matchIndex, 1);
    } else {
      newCount++;
    }
    return dbStore.addHomework(username, {
      course,
      title,
      due: it.due,
      done: preservedDone,
    });
  });

  return res.json({
    added,
    homework: dbStore.getHomework(username),
    stats: { total: items.length, newCount, updatedCount }
  });
});

apiRouter.delete('/homework/console-pool/:id', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  const user = username ? dbStore.getUser(username) : null;
  if (user?.role !== 'admin') {
    return res.status(403).json({ error: '仅管理员可通过终端管理官方作业池' });
  }
  const id = Number(req.params.id);
  dbStore.deleteConsoleHomework(id);
  return res.json({ success: true, templates: dbStore.getConsoleHomework() });
});

apiRouter.delete('/homework/console-pool', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  const user = username ? dbStore.getUser(username) : null;
  if (user?.role !== 'admin') {
    return res.status(403).json({ error: '仅管理员可通过终端管理官方作业池' });
  }
  dbStore.clearConsoleHomework();
  return res.json({ success: true, templates: [] });
});

// Tasks endpoints
apiRouter.get('/tasks', (req: Request, res: Response) => {
  const username = getCurrentUser(req) || 'demo';
  const list = dbStore.getTasks(username);
  return res.json({ success: true, tasks: list });
});

apiRouter.post('/tasks', (req: Request, res: Response) => {
  const username = getCurrentUser(req) || 'demo';
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: '任务内容不能为空' });

  const item = dbStore.addTask(username, title);
  return res.json({ success: true, task: item });
});

apiRouter.put('/tasks', (req: Request, res: Response) => {
  const username = getCurrentUser(req) || 'demo';
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: '请提供任务 id' });
  const updated = dbStore.toggleTask(username, Number(id));
  return res.json({ success: true, task: updated });
});

apiRouter.put('/tasks/:id/toggle', (req: Request, res: Response) => {
  const username = getCurrentUser(req) || 'demo';
  const id = Number(req.params.id);
  const updated = dbStore.toggleTask(username, id);
  return res.json({ success: true, task: updated });
});

apiRouter.delete('/tasks', (req: Request, res: Response) => {
  const username = getCurrentUser(req) || 'demo';
  const id = Number(req.query.id || req.body?.id);
  if (!id) return res.status(400).json({ error: '请提供任务 id' });
  dbStore.deleteTask(username, id);
  return res.json({ success: true });
});

apiRouter.delete('/tasks/:id', (req: Request, res: Response) => {
  const username = getCurrentUser(req) || 'demo';
  const id = Number(req.params.id);
  dbStore.deleteTask(username, id);
  return res.json({ success: true });
});

// Notices
apiRouter.get('/notices', (_req: Request, res: Response) => {
  return res.json({ notices: dbStore.getNotices() });
});

apiRouter.post('/notices', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  const user = username ? dbStore.getUser(username) : null;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: '仅管理员可发布公告' });
  }
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: '公告内容不能为空' });

  const notice = dbStore.addNotice(text, user.name);
  return res.json({ notice });
});

// Admin management
apiRouter.get('/admin/overview', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  const user = username ? dbStore.getUser(username) : null;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: '无权访问' });
  }

  const allUsers = dbStore.getAllUsers();
  const userList = allUsers.map(u => ({
    username: u.username,
    name: u.name,
    role: u.role,
    disabled: u.disabled,
    created: u.created,
    courseCount: dbStore.getCourses(u.username).length,
    pendingHw: dbStore.getHomework(u.username).filter(h => !h.done).length,
    pendingTasks: dbStore.getTasks(u.username).filter(t => !t.done).length
  }));

  return res.json({
    users: userList,
    stats: dbStore.getStats()
  });
});

apiRouter.post('/admin/users/:targetUser/toggle-disabled', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  const user = username ? dbStore.getUser(username) : null;
  if (!user || user.role !== 'admin') return res.status(403).json({ error: '无权操作' });

  const target = req.params.targetUser;
  const targetUser = dbStore.getUser(target);
  if (!targetUser) return res.status(404).json({ error: '用户不存在' });

  dbStore.setUserDisabled(target, !targetUser.disabled);
  return res.json({ success: true, disabled: !targetUser.disabled });
});

apiRouter.post('/admin/users/:targetUser/reset-password', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  const user = username ? dbStore.getUser(username) : null;
  if (!user || user.role !== 'admin') return res.status(403).json({ error: '无权操作' });

  const target = req.params.targetUser;
  const { password } = req.body;
  if (!password || password.length < 4) return res.status(400).json({ error: '密码至少 4 位' });

  dbStore.resetUserPassword(target, password);
  return res.json({ success: true });
});

apiRouter.post('/admin/users/:targetUser/rename', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  const user = username ? dbStore.getUser(username) : null;
  if (!user || user.role !== 'admin') return res.status(403).json({ error: '无权操作' });

  const target = req.params.targetUser;
  const { name } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: '姓名不能为空' });

  try {
    const trimmed = String(name).trim();
    dbStore.updateUserName(target, trimmed);
    return res.json({ success: true, name: trimmed });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/admin/users/:targetUser', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  const user = username ? dbStore.getUser(username) : null;
  if (!user || user.role !== 'admin') return res.status(403).json({ error: '无权操作' });

  const target = req.params.targetUser;
  try {
    dbStore.deleteUser(target);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Admin terminal command runner
apiRouter.post('/admin/terminal', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  const user = username ? dbStore.getUser(username) : null;
  if (!user || user.role !== 'admin') return res.status(403).json({ error: '仅管理员可使用终端' });

  const { command } = req.body;
  const raw = String(command || '').trim();
  if (!raw) return res.json({ output: [], status: 'ok' });

  const p = raw.split(/\s+/);
  const cmd = p[0].toLowerCase();
  const lines: { text: string; type?: 'info' | 'err' | 'echo' | '' }[] = [];

  const WD = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

  try {
    switch (cmd) {
      case 'help':
        lines.push({
          text: `可用命令：
  users                          列出所有用户
  user <名称>                    查看用户详情
  user <名称> rename <新真实姓名> 修改学生真实姓名(终端管理员专享)
  user <名称> disable            禁用账号（禁止登录）
  user <名称> enable             启用账号
  user <名称> reset <新密码>      重置密码
  user <名称> delete             删除账号及全部数据
  courses <名称>                 列出用户课程
  course add <名称> 课名|周几(1-7)|起始节|结束节|教室|教师
  course del <名称> <序号>        删除指定课程
  hw list                        查看全局官方作业库（供学生一键同步）
  hw add 课名|作业内容|截止日期   添加作业到官方作业库
  hw del <序号>                  从官方作业库删除作业
  hw sync <账号=admin>          将指定账号（默认管理员）作业转存入官方作业库
  hw broadcast                   将官方作业库全部作业广播下发给所有学生
  hw push 课名|作业内容|截止日期  直接将指定作业推送到所有学生作业清单
  hw clear                       清空官方作业库
  notice <内容>                  向全校发布公告
  notices                        查看公告列表
  stats                          全局统计
  clear                          清屏`
        });
        break;

      case 'users':
      case 'ls':
        const users = dbStore.getAllUsers();
        users.forEach(u => {
          const cs = dbStore.getCourses(u.username).length;
          const hw = dbStore.getHomework(u.username).length;
          const tk = dbStore.getTasks(u.username).length;
          lines.push({
            text: `${u.role === 'admin' ? '★' : '·'} ${u.username.padEnd(11, ' ')} ${u.name.padEnd(6, ' ')} ${u.disabled ? '已禁用' : '正常  '} 课程:${cs} 作业:${hw} 任务:${tk}`
          });
        });
        lines.push({ text: `共 ${users.length} 个账号（★ 为管理员）`, type: 'info' });
        break;

      case 'user':
        const target = p[1];
        if (!target) throw new Error('请指定用户名');
        const tu = dbStore.getUser(target);
        if (!tu) throw new Error('用户不存在: ' + target);
        const sub = (p[2] || '').toLowerCase();
        if (!sub) {
          const cs = dbStore.getCourses(target);
          lines.push({
            text: `账号：${target} (${tu.name}) ｜ 角色：${tu.role === 'admin' ? '管理员' : '普通学生'} ｜ 状态：${tu.disabled ? '已禁用' : '正常'}`
          });
          lines.push({
            text: `注册于：${new Date(tu.created).toLocaleString()} ｜ 课程 ${cs.length} 门 ｜ 未完成作业 ${dbStore.getHomework(target).filter(x => !x.done).length} 项`
          });
        } else if (sub === 'disable' || sub === 'enable') {
          dbStore.setUserDisabled(target, sub === 'disable');
          lines.push({ text: `已${sub === 'disable' ? '禁用' : '启用'}账号：${target}`, type: 'info' });
        } else if (sub === 'reset') {
          const np = p[3];
          if (!np || np.length < 4) throw new Error('用法：user <名称> reset <新密码(≥4位)>');
          dbStore.resetUserPassword(target, np);
          lines.push({ text: `已重置 ${target} 的密码`, type: 'info' });
        } else if (sub === 'rename') {
          const newName = p[3];
          if (!newName || !newName.trim()) throw new Error('用法：user <名称> rename <新真实姓名>');
          dbStore.updateUserName(target, newName.trim());
          lines.push({ text: `[控制台] 已将账号 ${target} 姓名变更为：${newName.trim()}`, type: 'info' });
        } else if (sub === 'delete') {
          dbStore.deleteUser(target);
          lines.push({ text: `已删除账号及所有数据：${target}`, type: 'err' });
        } else {
          throw new Error('未知子命令：' + sub);
        }
        break;

      case 'courses':
        const cTarget = p[1];
        if (!cTarget) throw new Error('请指定用户名');
        const cList = dbStore.getCourses(cTarget);
        if (!cList.length) {
          lines.push({ text: `${cTarget} 暂无课程`, type: 'info' });
        } else {
          cList.forEach((c, idx) => {
            lines.push({
              text: `${idx + 1}. ${WD[c.day]} 第${c.s}-${c.e}节 ${c.name}${c.room ? ' @' + c.room : ''}${c.teacher ? ' · ' + c.teacher : ''}${c.weeks ? ' · ' + c.weeks : ''}`
            });
          });
        }
        break;

      case 'course':
        const cSub = (p[1] || '').toLowerCase();
        if (cSub === 'add') {
          const cUser = p[2];
          if (!cUser || !dbStore.getUser(cUser)) throw new Error('用户不存在：' + cUser);
          const rest = raw.slice(raw.indexOf(cUser) + cUser.length + 1);
          const seg = rest.split('|');
          if (seg.length < 4) throw new Error('参数不足：课名|周几(1-7)|起始节|结束节|教室|教师');
          const [cName, dayStr, sStr, eStr, room, teacher] = [
            seg[0].trim(),
            Number(seg[1]),
            Number(seg[2]),
            Number(seg[3]),
            (seg[4] || '').trim(),
            (seg[5] || '').trim()
          ];
          if (!cName) throw new Error('课程名不能为空');
          if (dayStr < 1 || dayStr > 7) throw new Error('周几须为 1-7');
          if (sStr < 1 || eStr < sStr || eStr > 11) throw new Error('节次须满足 1≤起始≤结束≤11');

          dbStore.addCourse(cUser, {
            name: cName,
            day: dayStr - 1,
            s: sStr,
            e: eStr,
            room,
            teacher,
            color: PALETTE[0]
          });
          lines.push({ text: `已为 ${cUser} 添加课程：${cName}`, type: 'info' });
        } else if (cSub === 'del') {
          const cUser = p[2];
          const idx = Number(p[3]);
          if (!cUser || !dbStore.getUser(cUser)) throw new Error('用户不存在：' + cUser);
          const list = dbStore.getCourses(cUser);
          if (isNaN(idx) || idx < 1 || idx > list.length) throw new Error('序号无效');
          const targetC = list[idx - 1];
          dbStore.deleteCourse(cUser, targetC.id);
          lines.push({ text: `已删除 ${cUser} 的课程：${targetC.name}`, type: 'err' });
        } else {
          throw new Error('未知 course 子命令，请用 course add 或 course del');
        }
        break;

      case 'hw':
      case 'homework':
        const hwSub = (p[1] || 'list').toLowerCase();
        if (hwSub === 'list') {
          const pool = dbStore.getConsoleHomework();
          if (!pool.length) {
            lines.push({ text: '控制台作业库暂无作业，输入 hw add 课名|作业内容|截止日期 录入', type: 'info' });
          } else {
            lines.push({ text: `=== 控制台作业库 (共 ${pool.length} 项，供学生一键导入) ===`, type: 'info' });
            pool.forEach((h, i) => {
              lines.push({
                text: `${i + 1}. [${h.course}] ${h.title} ${h.due ? `(截止: ${h.due})` : '(无截止)'} · 由${h.creator || '控制台'}录入`
              });
            });
          }
        } else if (hwSub === 'add') {
          const rest = raw.slice(raw.indexOf(p[1]) + p[1].length + 1).trim();
          const seg = rest.split('|');
          if (seg.length < 2) throw new Error('用法：hw add 课名|作业内容|截止日期(可选)');
          const [hCourse, hTitle, hDue] = [seg[0].trim(), seg[1].trim(), (seg[2] || '').trim()];
          if (!hTitle) throw new Error('作业内容不能为空');
          dbStore.addConsoleHomework({
            course: hCourse || '其他',
            title: hTitle,
            due: hDue || undefined,
            creator: user.name || '系统管理员'
          });
          lines.push({ text: `已添加到控制台作业库：[${hCourse}] ${hTitle}`, type: 'info' });
        } else if (hwSub === 'del') {
          const idx = Number(p[2]);
          const pool = dbStore.getConsoleHomework();
          if (isNaN(idx) || idx < 1 || idx > pool.length) throw new Error('序号无效');
          const removed = pool.splice(idx - 1, 1)[0];
          dbStore.saveConsoleHomework(pool);
          lines.push({ text: `已从控制台作业库删除：${removed.title}`, type: 'err' });
        } else if (hwSub === 'clear') {
          dbStore.saveConsoleHomework([]);
          lines.push({ text: '已清空控制台作业库', type: 'err' });
        } else if (hwSub === 'push') {
          const rest = raw.slice(raw.indexOf(p[1]) + p[1].length + 1).trim();
          const seg = rest.split('|');
          if (seg.length < 2) throw new Error('用法：hw push 课名|作业内容|截止日期(可选)');
          const [hCourse, hTitle, hDue] = [seg[0].trim(), seg[1].trim(), (seg[2] || '').trim()];
          if (!hTitle) throw new Error('作业内容不能为空');
          const allU = dbStore.getAllUsers();
          allU.forEach(u => {
            dbStore.addHomework(u.username, {
              course: hCourse || '其他',
              title: hTitle,
              due: hDue || undefined,
            });
          });
          lines.push({ text: `已向全班 ${allU.length} 名学生推送作业：[${hCourse}] ${hTitle}`, type: 'info' });
        } else if (hwSub === 'sync') {
          const targetUser = p[2] || 'admin';
          const studentHw = dbStore.getHomework(targetUser);
          if (!studentHw || studentHw.length === 0) throw new Error(`账号 [${targetUser}] 当前没有作业可同步`);
          studentHw.forEach(it => {
            dbStore.addConsoleHomework({
              course: it.course,
              title: it.title,
              due: it.due,
              creator: targetUser
            });
          });
          lines.push({ text: `已将账号 [${targetUser}] 的 ${studentHw.length} 项作业成功转入官方作业池`, type: 'info' });
        } else if (hwSub === 'pushall' || hwSub === 'broadcast') {
          const pool = dbStore.getConsoleHomework();
          if (!pool || pool.length === 0) throw new Error('官方作业池为空，请先添加作业');
          const allU = dbStore.getAllUsers();
          allU.forEach(u => {
            pool.forEach(h => {
              dbStore.addHomework(u.username, {
                course: h.course,
                title: h.title,
                due: h.due
              });
            });
          });
          lines.push({ text: `已向全员 ${allU.length} 名学生广播下发官方作业池全部 ${pool.length} 项作业`, type: 'info' });
        } else {
          throw new Error('未知 hw 子命令，可用：hw list, hw add, hw del, hw push, hw sync, hw broadcast, hw clear');
        }
        break;

      case 'notice':
        const noteText = raw.slice(6).trim();
        if (!noteText) throw new Error('用法：notice <公告内容>');
        dbStore.addNotice(noteText, user.name);
        lines.push({ text: `已向全校发布公告：${noteText}`, type: 'info' });
        break;

      case 'notices':
        const allNotes = dbStore.getNotices();
        if (!allNotes.length) lines.push({ text: '暂无公告', type: 'info' });
        allNotes.forEach(n => {
          lines.push({ text: `[${new Date(n.time).toLocaleString()}] ${n.by}: ${n.text}` });
        });
        break;

      case 'stats':
        const st = dbStore.getStats();
        lines.push({
          text: `用户 ${st.userCount} 个 ｜ 课程总计 ${st.courseCount} 门 ｜ 作业 ${st.hwCount} 条 ｜ 待办 ${st.taskCount} 条 ｜ 公告 ${st.noticeCount} 条`,
          type: 'info'
        });
        break;

      case 'clear':
        return res.json({ clear: true, lines: [] });

      default:
        lines.push({ text: `未知命令：${cmd}，输入 help 查看帮助`, type: 'err' });
    }
  } catch (err: any) {
    lines.push({ text: `错误: ${err.message || err}`, type: 'err' });
  }

  return res.json({ lines });
});

// System Calendar iCal (.ics) subscription endpoint
apiRouter.get('/calendar/:username/schedule.ics', (req: Request, res: Response) => {
  const username = req.params.username;
  const user = dbStore.getUser(username);
  const courses = dbStore.getCourses(username);
  const homework = dbStore.getHomework(username);
  const studentName = user ? user.name : username;

  import('./calendar').then(({ generateICS }) => {
    const icsContent = generateICS(username, studentName, courses, homework);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="timetable-${username}.ics"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.send(icsContent);
  }).catch(err => {
    res.status(500).send('Error generating calendar: ' + err.message);
  });
});

// Live Desktop Widget SVG endpoint
apiRouter.get('/widget/:username/today.svg', (req: Request, res: Response) => {
  const username = req.params.username;
  const user = dbStore.getUser(username);
  const courses = dbStore.getCourses(username);
  const studentName = user ? user.name : username;

  import('./widgetRenderer').then(({ renderLiveWidgetSVG }) => {
    const svgContent = renderLiveWidgetSVG(studentName, courses);
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(svgContent);
  }).catch(err => {
    res.status(500).send('<svg xmlns="http://www.w3.org/2000/svg"><text y="20">Error</text></svg>');
  });
});

// Gemini AI Audio Transcription (model: gemini-3.5-transcribe)
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

apiRouter.post('/ai/transcribe', async (req: Request, res: Response) => {
  try {
    const { audio, mimeType, prompt } = req.body || {};
    if (!audio) {
      return res.status(400).json({ error: '请提供录音音频数据' });
    }

    const cleanBase64 = String(audio).replace(/^data:[^;]+;base64,/, '').trim();
    let cleanMimeType = String(mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
    if (cleanMimeType === 'audio/x-m4a' || cleanMimeType === 'audio/m4a') {
      cleanMimeType = 'audio/mp4';
    }
    const supportedAudioTypes = ['audio/webm', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/mp3', 'audio/flac', 'audio/mpeg'];
    if (!supportedAudioTypes.includes(cleanMimeType)) {
      cleanMimeType = cleanMimeType.includes('mp4') || cleanMimeType.includes('aac') || cleanMimeType.includes('m4a') ? 'audio/mp4' : 'audio/webm';
    }

    const ai = getGeminiClient();
    const audioPart = {
      inlineData: {
        mimeType: cleanMimeType,
        data: cleanBase64,
      },
    };

    const promptText = prompt || '请原样准确转录这段语音音频内容，输出中文或英文原话纯文本。不要添加任何多余解说、前缀、标号或特殊排版。如果是布置或记录作业/待办，完整保留课程名、作业内容和截止时间。';

    let text = '';
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            audioPart,
            { text: promptText },
          ],
        },
      });
      text = response.text ? response.text.trim() : '';
    } catch (primaryErr: any) {
      console.warn('gemini-3.5-transcribe error, falling back to gemini-3.8-flash:', primaryErr?.message);
      const fallbackResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: {
          parts: [
            audioPart,
            { text: promptText },
          ],
        },
      });
      text = fallbackResponse.text ? fallbackResponse.text.trim() : '';
    }

    return res.json({ text, success: true });
  } catch (err: any) {
    console.error('Gemini audio transcription error:', err);
    return res.status(500).json({
      error: err.message || '语音转录失败，请检查网络后重试',
      success: false,
    });
  }
});

// ==========================================
// Web Push Notifications API Endpoints
// ==========================================

// 1. Get VAPID public key
apiRouter.get('/push/vapid-public-key', (_req: Request, res: Response) => {
  try {
    const publicKey = pushService.getPublicKey();
    return res.json({ success: true, publicKey });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || '获取 VAPID 公钥失败' });
  }
});

// 2. Subscribe to Web Push
apiRouter.post('/push/subscribe', (req: Request, res: Response) => {
  try {
    const username = getCurrentUser(req) || 'admin';
    const { subscription, userAgent } = req.body || {};
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: '无效的推送订阅数据 (subscription)' });
    }

    const entry = dbStore.savePushSubscription(username, subscription, userAgent);
    const count = dbStore.getPushSubscriptions(username).length;

    return res.json({
      success: true,
      message: '推送订阅成功',
      subscriptionId: entry.id,
      activeDeviceCount: count,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || '保存推送订阅失败' });
  }
});

// 3. Unsubscribe from Web Push
apiRouter.post('/push/unsubscribe', (req: Request, res: Response) => {
  try {
    const username = getCurrentUser(req) || 'admin';
    const { endpoint } = req.body || {};
    if (!endpoint) {
      return res.status(400).json({ error: '请提供 endpoint' });
    }

    const removed = dbStore.removePushSubscription(username, endpoint);
    return res.json({
      success: true,
      removed,
      message: removed ? '已注销该设备推送' : '未找到匹配的订阅记录',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || '注销推送订阅失败' });
  }
});

// 4. Get push status for current user
apiRouter.get('/push/status', (req: Request, res: Response) => {
  try {
    const username = getCurrentUser(req) || 'admin';
    const subs = dbStore.getPushSubscriptions(username);
    return res.json({
      success: true,
      supported: true,
      hasSubscriptions: subs.length > 0,
      subscriptionCount: subs.length,
      subscriptions: subs.map(s => ({
        id: s.id,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt,
        userAgent: s.userAgent,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || '获取推送状态失败' });
  }
});

// 5. Send test push notification
apiRouter.post('/push/test', async (req: Request, res: Response) => {
  try {
    const username = getCurrentUser(req) || 'admin';
    const result = await pushService.sendTestPush(username);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || '测试推送发送失败',
    });
  }
});


