# Implementation Plan - 实现作业可编辑功能

## 需求分析
用户提出：“作业定义后就没法改了，将它改为可编辑”。
我们需要为已有的作业（Homework）添加编辑功能，允许用户修改作业所属课程（Course）、作业标题（Title）以及截止时间（Due）。

## 修改方案

### 1. 后端支持更新作业 (`server/store.ts` & `server/api.ts`)
- 在 `server/store.ts` 的 `DbStore` 类中添加 `updateHomework(username: string, id: number, updates: { course?: string; title?: string; due?: string })` 方法。
- 在 `server/api.ts` 中添加 `PUT /api/homework/:id` 或 `PUT /api/assignments/:id` 路由，接收更新字段并持久化。

### 2. 前端 API 封装 (`src/services/api.ts`)
- 在 `api` 对象中添加 `updateHomework(id: number, data: { course: string; title: string; due?: string })` 方法，调用后端更新接口。

### 3. 创建作业编辑弹窗组件 (`src/components/HomeworkEditModal.tsx`)
- 新建 `HomeworkEditModal.tsx`，提供直观的表单输入：
  - 课程名称（下拉选择或手动输入）
  - 作业标题
  - 截止时间
- 支持保存与取消操作，带有校验与提示。

### 4. 在作业列表与 App 中集成编辑入口 (`src/components/HomeworkTab.tsx` & `src/App.tsx`)
- 在 `HomeworkTab.tsx` 的每条作业行（右侧操作区或菜单）中增加“编辑”按钮（铅笔图标）。
- 在 `App.tsx` 中实现 `handleUpdateHomework` 函数，调用 API 并更新本地状态。

## 验证计划
- 编译与代码检查：运行 `compile_applet` 与 `lint_applet` 确保无语法或类型错误。
- 功能验证：在“作业”标签页点击某项作业的编辑按钮，修改课程、标题或截止时间后保存，验证列表与云端同步正确更新。
