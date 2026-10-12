-- ==============================================================================
-- Cloudflare D1 Database Schema: Swiss Class Schedule App
-- 表结构定义：tasks (任务), courses (课程表), assignments (作业)
-- ==============================================================================
-- 使用方法：
-- 1. 在本地或 GitHub Actions / CI 使用 Wrangler 执行初始化：
--    npx wrangler d1 execute swiss-db --file=./schema.sql
--
-- 2. 或在 Cloudflare Dashboard：
--    Workers & Pages -> D1 -> 选择数据库 (swiss-db) -> Console -> 粘贴并执行以下 SQL：
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. 任务表 (tasks)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0, -- 0: 未完成, 1: 已完成
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);

-- ------------------------------------------------------------------------------
-- 2. 课程表 (courses)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  teacher TEXT,
  classroom TEXT,
  weekday INTEGER NOT NULL,            -- 0:周一, 1:周二, 2:周三, 3:周四, 4:周五, 5:周六, 6:周日
  start_slot INTEGER NOT NULL,         -- 起始节次 (1-11)
  end_slot INTEGER NOT NULL,           -- 结束节次 (1-11)
  weeks TEXT,                          -- 适用周次，如 "2-14周,16-17周"
  color TEXT DEFAULT '#4f63e8',        -- 卡片视觉颜色 (HEX)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_courses_weekday ON courses(weekday);

-- ------------------------------------------------------------------------------
-- 3. 课后作业表 (assignments)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_name TEXT NOT NULL,           -- 关联课程名称
  title TEXT NOT NULL,                 -- 作业要求或标题
  deadline TEXT,                       -- 截止日期时间，如 "2026-10-18" 或 "2026-10-18 23:59"
  completed INTEGER NOT NULL DEFAULT 0,-- 0: 未完成, 1: 已完成
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assignments_created_at ON assignments(created_at DESC);
