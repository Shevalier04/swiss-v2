# D1 官方作业池与管理员数据清空同步方案

解决用户反馈的“D1数据库只能存不能清空，admin用户清空作业池时D1数据没有同步”问题。

---

## 一、问题根因深度分析

1. **接口权限与静默吞错导致 D1 未真实删除**：
   - 现有的 `DELETE /homework/console-pool` 接口在校验管理员身份时过于严格，当请求头 token 解析异常或为缺省管理员标识时直接返回 403 拒绝。
   - 前端 `api.clearConsoleHomeworkTemplates()` 在遇到 403 报错后，静默执行了 `localStorage.setItem('cs_console_hw_pool', '[]')` 本地兜底，使得界面暂时变空，但 **Cloudflare D1 后端实际并没有执行任何删除操作**，刷新页面后数据原封不动再次出现。
2. **数据管理中心与作业池割裂**：
   - 在“云端数据管理中心”（`DataManagementModal.tsx`）中，“清空全部云端作业”仅调用了 `/api/assignments?all=true`，只删除了 admin 用户的私有作业，**完全没有联动清空 D1 官方作业池（`homework_pool` / `consoleHomework`）**。
   - 缺乏双向清空机制，导致管理员在数据中心清空了作业后，官方池中依然存留大量旧数据。

---

## 二、架构设计与解决步骤

### 1. 后端清空接口加固 (`server/api.ts` & `server/store.ts`)
- **权限判定宽容性与容错增强**：
  - 允许 `username === 'admin'` 或 `user?.role === 'admin'` 均能合法执行官方池清空操作。
  - 在 `POST /homework/console-pool` 中新增 `action: 'clear'` 支持，与 `DELETE /homework/console-pool` 双通道保障清空请求 100% 成功。
  - 确保 `dbStore.clearConsoleHomework()` 彻底清空内存对象与 `timetable_db.json` 文件持久化。
- **全量清空联动**：
  - 当以管理员身份清空全部作业时（`/assignments?all=true`），支持同时清除 D1 官方作业池，实现真正的一键同步清空。

### 2. 前端 API 交互加固 (`src/services/api.ts`)
- **真实同步拒绝静默伪装**：
  - 重构 `clearConsoleHomeworkTemplates()` 与 `clearAllHomework()`：优先请求后端真实删除，并在成功后再清理本地缓存；若网络或权限失败，向上抛出真实错误并由 Toast 告警，杜绝“假清空”。
  - 增强 `clearAllHomework()`：管理员操作时自动联动清空官方作业池。

### 3. 数据管理中心（DataManagementModal）功能扩充
- **“清空重置”标签页扩充入口**：
  1. **升级“清空全部云端作业”**：明确提示并执行“清空管理员作业及 D1 官方作业池”，双端一网打尽。
  2. **新增独立按钮“清空 D1 官方作业池 (homework_pool)”**：专用于单独清空全局官方共享作业，不影响课表与待办。
  3. **升级“一键清空全部云端数据”**：彻底清空课程、个人作业、待办任务以及 D1 官方作业池全部数据。

### 4. 官方作业清单同步弹窗（HomeworkImportModal）体验闭环
- 加固“清空官方作业池”按钮，执行后立即重置状态，并通知上层组件刷新，防止数据残留。

---

## 三、文件修改清单

1. **`server/api.ts` & `server/store.ts`**
   - 优化 `DELETE /homework/console-pool` 与 `POST /homework/console-pool (action: 'clear')`。
   - 联动管理员作业清空与官方作业池清空。
2. **`src/services/api.ts`**
   - 强化 `clearConsoleHomeworkTemplates` 与 `clearAllHomework`，保证与 D1 同步。
3. **`src/components/DataManagementModal.tsx`**
   - 在“清空重置”界面增加“清空 D1 官方作业池”专属控制项，并使作业清空全面覆盖 D1 池。
4. **`src/components/HomeworkImportModal.tsx`**
   - 加固清空按钮的操作反馈与即时状态同步。

---

## 四、验证与验收标准

1. **官方池清空验证**：管理员点击“清空官方作业池”，刷新页面后模态框中作业池数量归零，D1 数据库真实清空。
2. **数据管理中心联动验证**：在“云端数据管理中心”点击清空作业或清空 D1 官方作业池后，两处列表均同步被清空。
3. **重新转存验证**：清空后再录入新作业并转存，D1 数据库仅有新作业，不再有任何历史残留脏数据。
