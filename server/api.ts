import express, { Request, Response } from 'express';
import { dbStore } from './store';
import { getDefaultTemplateCourses, PALETTE } from './data';

export const apiRouter = express.Router();
apiRouter.use(express.json());

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
    const username = getCurrentUser(req) || (req.body && req.body.username) || '2612114501';
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

// Courses endpoints
apiRouter.get('/courses', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  if (!username) return res.status(401).json({ error: '未登录' });
  const courses = dbStore.getCourses(username);
  return res.json({ courses });
});

apiRouter.post('/courses', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  if (!username) return res.status(401).json({ error: '未登录' });
  const { name, teacher, room, day, s, e, weeks, color } = req.body;
  if (!name) return res.status(400).json({ error: '课程名称不能为空' });

  const created = dbStore.addCourse(username, {
    name,
    teacher: teacher || '',
    room: room || '',
    day: Number(day),
    s: Number(s),
    e: Number(e),
    weeks: weeks || '',
    color: color || PALETTE[0]
  });

  return res.json({ course: created });
});

apiRouter.put('/courses/:id', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  if (!username) return res.status(401).json({ error: '未登录' });
  const id = Number(req.params.id);

  try {
    const updated = dbStore.updateCourse(username, id, req.body);
    return res.json({ course: updated });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/courses/:id', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  if (!username) return res.status(401).json({ error: '未登录' });
  const id = Number(req.params.id);
  dbStore.deleteCourse(username, id);
  return res.json({ success: true });
});

apiRouter.post('/courses/batch-replace', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  if (!username) return res.status(401).json({ error: '未登录' });
  const { courses } = req.body;
  if (!Array.isArray(courses)) return res.status(400).json({ error: '数据格式错误' });

  dbStore.saveCourses(username, courses);
  return res.json({ success: true, count: courses.length });
});

apiRouter.post('/courses/reset-template', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  if (!username) return res.status(401).json({ error: '未登录' });
  const tpl = getDefaultTemplateCourses();
  dbStore.saveCourses(username, tpl);
  return res.json({ courses: tpl });
});

// Homework endpoints
apiRouter.get('/homework', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  if (!username) return res.status(401).json({ error: '未登录' });
  return res.json({ homework: dbStore.getHomework(username) });
});

apiRouter.post('/homework', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  if (!username) return res.status(401).json({ error: '未登录' });
  const { course, title, due } = req.body;
  if (!title) return res.status(400).json({ error: '作业内容不能为空' });

  const item = dbStore.addHomework(username, { course, title, due });
  return res.json({ homework: item });
});

apiRouter.put('/homework/:id/toggle', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  if (!username) return res.status(401).json({ error: '未登录' });
  const id = Number(req.params.id);
  const updated = dbStore.toggleHomework(username, id);
  return res.json({ homework: updated });
});

apiRouter.delete('/homework/:id', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  if (!username) return res.status(401).json({ error: '未登录' });
  const id = Number(req.params.id);
  dbStore.deleteHomework(username, id);
  return res.json({ success: true });
});

// Console Homework Pool endpoints
apiRouter.get('/homework/console-pool', (_req: Request, res: Response) => {
  return res.json({ templates: dbStore.getConsoleHomework() });
});

apiRouter.post('/homework/console-pool', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  const user = username ? dbStore.getUser(username) : null;
  const { course, title, due } = req.body;
  if (!title) return res.status(400).json({ error: '作业内容不能为空' });
  const item = dbStore.addConsoleHomework({
    course: course || '其他',
    title: String(title).trim(),
    due: due ? String(due).trim() : undefined,
    creator: user?.name || username || '控制台'
  });
  return res.json({ template: item });
});

apiRouter.post('/homework/console-pool/batch-sync', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  if (!username) return res.status(401).json({ error: '未登录' });
  const { items } = req.body;
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: '请提供待导入的作业列表' });
  }
  const added = items.map(it =>
    dbStore.addHomework(username, {
      course: it.course || '其他',
      title: it.title,
      due: it.due,
    })
  );
  return res.json({ added, homework: dbStore.getHomework(username) });
});

apiRouter.delete('/homework/console-pool/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  dbStore.deleteConsoleHomework(id);
  return res.json({ success: true, templates: dbStore.getConsoleHomework() });
});

apiRouter.delete('/homework/console-pool', (_req: Request, res: Response) => {
  dbStore.clearConsoleHomework();
  return res.json({ success: true, templates: [] });
});

// Tasks endpoints
apiRouter.get('/tasks', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  if (!username) return res.status(401).json({ error: '未登录' });
  return res.json({ tasks: dbStore.getTasks(username) });
});

apiRouter.post('/tasks', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  if (!username) return res.status(401).json({ error: '未登录' });
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: '任务内容不能为空' });

  const item = dbStore.addTask(username, title);
  return res.json({ task: item });
});

apiRouter.put('/tasks/:id/toggle', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  if (!username) return res.status(401).json({ error: '未登录' });
  const id = Number(req.params.id);
  const updated = dbStore.toggleTask(username, id);
  return res.json({ task: updated });
});

apiRouter.delete('/tasks/:id', (req: Request, res: Response) => {
  const username = getCurrentUser(req);
  if (!username) return res.status(401).json({ error: '未登录' });
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
  user <名称> disable            禁用账号（禁止登录）
  user <名称> enable             启用账号
  user <名称> reset <新密码>      重置密码
  user <名称> delete             删除账号及全部数据
  courses <名称>                 列出用户课程
  course add <名称> 课名|周几(1-7)|起始节|结束节|教室|教师
  course del <名称> <序号>        删除指定课程
  hw list                        查看控制台作业库（供学生一键导入）
  hw add 课名|作业内容|截止日期   添加作业到控制台作业库
  hw del <序号>                  从控制台作业库删除作业
  hw push 课名|作业内容|截止日期  直接将作业推送到所有学生作业清单
  hw clear                       清空控制台作业库
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
        } else {
          throw new Error('未知 hw 子命令，可用：hw list, hw add, hw del, hw push, hw clear');
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
  const studentName = user ? user.name : username;

  import('./calendar').then(({ generateICS }) => {
    const icsContent = generateICS(username, studentName, courses);
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
