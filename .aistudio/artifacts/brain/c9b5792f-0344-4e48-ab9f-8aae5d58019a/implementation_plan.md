# Cloudflare D1 全局作业池与多用户作业同步实施方案

## 用户确认与关键决策

> [!IMPORTANT]
> 基于第一阶段沟通确认，本次实施采用以下核心方案：
> 1. **作业池架构**：在 Cloudflare D1 数据库中建立全局共享官方作业池（`homework_pool`），所有学生均可直接同步和自由勾选；
> 2. **去除示范作业**：彻底移除系统所有硬编码示范作业（如 Web编程技术、数据库等测试作业），作业池无数据时显示干净空白态；
> 3. **管理与下发方式**：控制台界面支持一键全员下发与同步至 D1，同时提供 Cloudflare D1 控制台的纯 SQL 脚本供直接执行。

---

## 1. 方案概述与目标

在原有单用户隔离存储（`assignments` 表通过 `username` 区分）的基础上，打通“全局官方作业池”与“全员学生作业下发”双向通道：
- **全局官方作业池（`homework_pool`）**：存放班级/全员标准的官方作业清单，所有学生账号在“官方作业清单同步”弹窗中看到的作业均实时来自此表；
- **全员作业同步与下发**：管理员可在界面控制台将学号 `2612114501` 现有的作业一键升格为官方作业池，并可一键推送到 D1 中所有学生的个人作业表；
- **纯净数据**：移除代码库中所有伪造或演示用途的作业项（`SAMPLE_ASSIGNMENTS`），保证真实、干净。

---

## 2. 界面与交互设计 (UX & Visual Standards)

### A. 官方作业清单导入界面（`HomeworkImportModal`）
- **数据来源**：100% 绑定来自 Cloudflare D1 的 `/api/homework/console-pool` 接口；
- **纯净空白态**：若作业池无数据，展示优雅的无干扰空白提示：“官方作业池暂无作业条目”，并提供刷新按钮，绝不回退到硬编码测试作业；
- **实时同步**：提供“从 D1 刷新作业池”按钮，学生一键拉取最新班级作业。

### B. 管理员控制台与下发界面（`AdminTerminalModal`）
- **快速同步学号数据**：新增“将当前账号(2612114501)作业同步至官方池”按钮；
- **全员作业广播**：支持“一键推送到所有学生”，自动遍历 D1 中的所有学生账号并在其个人作业库中生成对应作业；
- **清晰反馈**：操作完成后以文本清晰提示处理人数与受影响的作业记录数。

---

## 3. 技术架构与数据策略

```
┌───────────────────────────────────────────────────────────────┐
│                     Cloudflare D1 数据库                       │
│                                                               │
│   ┌──────────────────────────┐    ┌──────────────────────┐    │
│   │ homework_pool (官方作业池) │    │ assignments (个人表)  │    │
│   │ ──────────────────────── │    │ ──────────────────── │    │
│   │ id (自增主键)             │    │ id, username         │    │
│   │ course, title, due       │    │ course_name, title   │    │
│   │ creator, created_at      │    │ deadline, completed  │    │
│   └─────────────┬────────────┘    └──────────▲───────────┘    │
│                 │                            │                │
└─────────────────┼────────────────────────────┼────────────────┘
                  │ 一键广播下发                │ 学生自由勾选导入
                  ▼                            │
┌──────────────────────────────────────────────┴────────────────┐
│             Cloudflare Pages Functions API 端点                │
│                                                               │
│  • GET/POST/DELETE /api/homework/console-pool (池管理)         │
│  • POST /api/homework/console-pool/push (全员广播下发)          │
│  • GET/POST/PUT/DELETE /api/assignments (个人作业 CRUD)       │
└───────────────────────────────────────────────────────────────┘
```

### 数据库 Schema 与 D1 SQL 操作脚本

#### 1. 新建 `homework_pool` 表结构（写入 `schema.sql`）
```sql
CREATE TABLE IF NOT EXISTS homework_pool (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course TEXT NOT NULL,
  title TEXT NOT NULL,
  due TEXT,
  creator TEXT DEFAULT '管理员',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_hw_pool_course ON homework_pool(course);
```

#### 2. 将学号 `2612114501` 现有作业转为官方作业池（SQL 可直接在 D1 执行）
```sql
-- 将 2612114501 的现有作业去重复制进官方作业池
INSERT INTO homework_pool (course, title, due, creator)
SELECT course_name, title, deadline, '2612114501'
FROM assignments
WHERE username = '2612114501'
  AND title NOT IN (SELECT title FROM homework_pool);
```

#### 3. 将官方作业池推送到 D1 中所有学生的个人作业列表（SQL 可直接在 D1 执行）
```sql
-- 为 assignments 中出现过的所有不同学生账号插入官方作业池的作业（避免重复插入相同标题）
INSERT INTO assignments (username, course_name, title, deadline, completed)
SELECT u.username, p.course, p.title, p.due, 0
FROM (SELECT DISTINCT username FROM assignments) u
CROSS JOIN homework_pool p
WHERE NOT EXISTS (
  SELECT 1 FROM assignments a 
  WHERE a.username = u.username 
    AND a.course_name = p.course 
    AND a.title = p.title
);
```

---

## 4. 实施计划与步骤

1. **更新数据库 Schema (`schema.sql`)**：
   - 新增 `homework_pool` 官方作业池表定义与索引；
   - 补充 D1 Console 手动操作的 SQL 示例注释。
2. **实现 Cloudflare Pages Functions 接口 (`functions/api/homework/console-pool.ts`)**：
   - 适配 D1 数据库绑定；
   - 实现查询作业池、添加作业项、删除作业项、清空作业池接口；
   - 实现 `push` 接口：支持将作业池或单项作业下发给 D1 中全员学生。
3. **彻底清除示范测试数据**：
   - 清理 `src/services/api.ts` 中 `getConsoleHomeworkTemplates` 的 3 项硬编码测试作业；
   - 清理 `src/components/HomeworkImportModal.tsx` 中在请求失败或空列表时注入 `SAMPLE_ASSIGNMENTS` 的逻辑；
   - 清理或将 `SAMPLE_ASSIGNMENTS` 替换为空数组。
4. **增强控制台交互 (`src/components/AdminTerminalModal.tsx`)**：
   - 增加快速从当前学号作业生成官方作业池的按钮与指令；
   - 接入 D1 下发接口并提供直观反馈。
5. **本地验证与打包导出**：
   - 编译检查 (`npm run build`)；
   - 更新 `course-schedule-github.zip`，确保部署到 Cloudflare Pages 时最新 Functions 与前端同步生效。
