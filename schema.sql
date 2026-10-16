-- ==============================================================================
-- Cloudflare D1 Database Schema: Swiss Class Schedule App (多用户数据独立隔离版)
-- 表结构定义：tasks (任务), courses (课程表), assignments (作业)
-- 每个账号 (username) 独立存储，互不影响
-- ==============================================================================
-- 使用方法：
-- 1. 新建数据库或初始化执行：
--    npx wrangler d1 execute swiss-db --file=./schema.sql
--
-- 2. 或在 Cloudflare Dashboard：
--    Workers & Pages -> D1 -> 选择数据库 (swiss-db) -> Console -> 粘贴并执行以下 SQL
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. 任务表 (tasks)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL DEFAULT 'default',  -- 用户账号唯一标识（如学号或用户名）
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,      -- 0: 未完成, 1: 已完成
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(username, created_at DESC);

-- ------------------------------------------------------------------------------
-- 2. 课程表 (courses)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL DEFAULT 'default',  -- 用户账号唯一标识
  name TEXT NOT NULL,
  teacher TEXT,
  classroom TEXT,
  weekday INTEGER NOT NULL,                  -- 0:周一, 1:周二, ..., 6:周日
  start_slot INTEGER NOT NULL,               -- 起始节次 (1-11)
  end_slot INTEGER NOT NULL,                 -- 结束节次 (1-11)
  weeks TEXT,                                -- 适用周次，如 "2-14周,16-17周"
  color TEXT DEFAULT '#4f63e8',              -- 卡片视觉颜色 (HEX)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_courses_user ON courses(username, weekday);

-- ------------------------------------------------------------------------------
-- 3. 课后作业表 (assignments)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL DEFAULT 'default',  -- 用户账号唯一标识
  course_name TEXT NOT NULL,                 -- 关联课程名称
  title TEXT NOT NULL,                       -- 作业要求或标题
  deadline TEXT,                             -- 截止日期时间
  completed INTEGER NOT NULL DEFAULT 0,      -- 0: 未完成, 1: 已完成
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assignments_user ON assignments(username, created_at DESC);

-- ------------------------------------------------------------------------------
-- 4. 全局官方作业池表 (homework_pool)
-- 全班统一的作业模版库，供全员学生在客户端自由勾选同步，亦可由管理员一键全员下发
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS homework_pool (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course TEXT NOT NULL,                      -- 课程名称
  title TEXT NOT NULL,                       -- 作业内容与要求
  due TEXT,                                  -- 截止日期时间
  creator TEXT DEFAULT '管理员',             -- 创建人 / 发布学号
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hw_pool_course ON homework_pool(course, created_at DESC);

-- ==============================================================================
-- 针对已建旧表的平滑升级迁移（如果之前已建表，执行下列 ALTER 语句补充 username 字段）：
-- ==============================================================================
-- ALTER TABLE tasks ADD COLUMN username TEXT NOT NULL DEFAULT 'default';
-- ALTER TABLE courses ADD COLUMN username TEXT NOT NULL DEFAULT 'default';
-- ALTER TABLE assignments ADD COLUMN username TEXT NOT NULL DEFAULT 'default';

-- ==============================================================================
-- D1 控制台常用实用 SQL 脚本（复制到 Cloudflare D1 Console 即可执行）：
-- ==============================================================================

-- 【脚本 1】将学号 2612114501 的现有作业一键转存为全局官方作业池（去重写入）：
-- INSERT INTO homework_pool (course, title, due, creator)
-- SELECT course_name, title, deadline, '2612114501'
-- FROM assignments
-- WHERE username = '2612114501'
--   AND (course_name || ':::' || title) NOT IN (SELECT course || ':::' || title FROM homework_pool);

-- 【脚本 2】将官方作业池的全部作业一键广播推送到所有学生的个人作业表（assignments）：
-- INSERT INTO assignments (username, course_name, title, deadline, completed)
-- SELECT u.username, p.course, p.title, p.due, 0
-- FROM (SELECT DISTINCT username FROM assignments) u
-- CROSS JOIN homework_pool p
-- WHERE NOT EXISTS (
--   SELECT 1 FROM assignments a 
--   WHERE a.username = u.username 
--     AND LOWER(TRIM(a.course_name)) = LOWER(TRIM(p.course))
--     AND LOWER(TRIM(a.title)) = LOWER(TRIM(p.title))
-- );

-- 【脚本 3】删除历史测试数据或旧示范作业池：
-- DELETE FROM homework_pool WHERE title LIKE '%示范%' OR title LIKE '%测试%' OR creator = '官方预设';
-- DELETE FROM assignments WHERE username = 'default' AND (title LIKE '%示范%' OR title LIKE '%测试%');
