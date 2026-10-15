# 官方作业池集中管理与全员作业分发实施方案

## 1. 核心需求与背景分析
当前作业导入功能虽已移除普通前台控制台输入，但后端官方作业池接口尚未对管理员权限施加严格判定，且管理员在后台终端管理面板中缺少直观的一键全员强制推送能力。同时，学生端导入弹窗仍保留了局部添加自定义项目的入口，可能造成公共作业管理的逻辑模糊。

本次升级的目标是：
1. **权限收拢与安全拦截**：将官方作业池（`console-pool`）的增删改清空权限在后端及 API 层严格锁定给超级管理员（`admin`），普通学生请求直接返回 403 权限拒绝。
2. **作业去重与智能覆盖（Upsert）**：优化 `server/store.ts` 与 `server/api.ts` 的作业存储逻辑，当向官方池添加或向全员推送同名（同课程 + 同标题）作业时，自动覆盖更新截止日期 `due` 并保留学生的勾选完成状态，杜绝冗余重复项。
3. **强化终端管理能力（AdminTerminalModal.tsx）**：在管理员终端的作业池面板中提供「发布至官方作业池」与「一键全员强制下发」双操作按钮，并在列表项右侧增加「全员推送」快捷键。
4. **纯净化学生导入体验（HomeworkImportModal.tsx）**：移除任何用户侧自建共享项的入口，纯粹展示管理员发布的官方作业，对比已有作业实时标注「已存在 · 勾选将覆盖更新」，导入时自动无缝覆盖旧版本。

---

## 2. 详细技术方案与改动计划

### A. 后端接口权限锁定与存储层 Upsert 改造
- **`server/api.ts`**：
  - `POST /homework/console-pool`：校验当前登录用户 `user?.role === 'admin'`，非管理员直接返回 `403 { error: '仅管理员可通过终端管理官方作业池' }`。
  - `DELETE /homework/console-pool/:id` 与 `DELETE /homework/console-pool`：同样增加 `admin` 权限校验拦截。
  - `POST /homework/console-pool/batch-sync`：在批量同步时，对覆盖项提取其原本的 `done` 状态并保留写入，更新统计计数。
- **`server/store.ts`**：
  - `addConsoleHomework(item)`：检查池中是否已有同课程+同标题作业，若有则直接更新 `due` 与更新时间，避免池内重复。
  - `addHomework(username, item)`：支持传递保留 `done?: boolean`，并检查用户表中已有同课程同标题作业；若已存在则直接更新 `due`，保留学生原有的已完成进度。

### B. 管理员终端控制增强（AdminTerminalModal.tsx & api.ts）
- **`src/services/api.ts`**：
  - 增强 `addConsoleHomeworkTemplate`、`deleteConsoleHomeworkTemplate`、`clearConsoleHomeworkTemplates`，在离线/D1 回退逻辑中也同步支持同名同课程覆盖判断。
  - 封装便捷全员推送方法或通过 `runTerminalCommand('hw push ...')` 实现一键全员批量注入。
- **`src/components/AdminTerminalModal.tsx`**：
  - 在作业池表单中提供明确的双分支交互：
    1. 绿色按钮「发布至官方作业池」：调用 `addConsoleHomeworkTemplate`，供学生在客户端按需勾选。
    2. 蓝紫色按钮「一键全员强制下发」：调用终端 `hw push 课名|标题|截止日期`，实时下发给所有已注册学生并提示覆盖/新增结果。
  - 作业池列表每一项的操作区：增加「全员推送」小按钮，管理员点击后可将池中已有条目快速覆盖推送到全班学生课表。

### C. 学生端官方作业导入纯净化（HomeworkImportModal.tsx & App.tsx）
- **`src/components/HomeworkImportModal.tsx`**：
  - 移除 `showQuickAdd` 及普通用户的自定义作业表单与状态。
  - 强化列表比对：当 `isItemExisting(item.course, item.title)` 为真时，展示黄色警示标签 `已存在 · 勾选将覆盖更新`；若不存在展示 `未导入`。
  - 自由多选/全选/反选，底部统一点击「导入选中作业」。
- **`src/App.tsx`**：
  - 在 `handleBatchAddHw` 中，记录被替换旧作业原有的完成状态，导入新作业后保持已完成状态不变，更新截止日期，弹出统计明确的 Toast 提示。

---

## 3. 验证与测试步骤
1. **后端权限校验测试**：
   - 使用普通学生账号发起 `POST /api/homework/console-pool`，验证是否被拦截并返回 403 错误。
2. **覆盖更新与状态保留测试**：
   - 学生将某门作业勾选为已完成。
   - 管理员在终端中修改其截止日期并点击「全员推送」，验证学生端该作业的截止时间更新，而完成打勾状态不受影响。
3. **学生端自由勾选导入测试**：
   - 打开「勾选导入作业清单」，验证普通用户无发布入口；勾选已有作业导入，验证无多余重复作业生成。
4. **编译与类型检查**：
   - 运行 `compile_applet` 和 `lint_applet` 确保 TypeScript 类型零错误，前端生产构建无异常。
