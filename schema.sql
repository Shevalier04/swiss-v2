-- ==============================================================================
-- Cloudflare D1 Database Schema: tasks
-- ==============================================================================
-- 使用方法：
-- 1. 在本地或 CI/CD 使用 Wrangler 执行初始化：
--    npx wrangler d1 execute <YOUR_DATABASE_NAME> --file=./schema.sql
--
-- 2. 或在 Cloudflare Dashboard：
--    Workers & Pages -> D1 -> 选择你的数据库 -> Console -> 粘贴并执行以下 SQL：
-- ==============================================================================

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0, -- 0: 未完成, 1: 已完成
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 为创建时间创建索引，加快列表倒序检索
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
