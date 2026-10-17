# Implementation Plan - 修复手动添加作业提交按钮不可见与 Java Web 课程别名一致映射

## 问题分析

1. **“填了提交不了，没有提交键”问题**：
   - 结合用户上传的截图分析，`HomeworkTab.tsx` 中的手动添加作业表单采用了 `grid-cols-1 sm:grid-cols-3` 网格布局。
   - 在中等或较窄屏幕宽度下，第三列“作业内容”输入框与“添加”提交按钮位于同一个 `flex` 容器内。由于输入框伸展，导致最右侧的“添加”按钮超出了视口右侧边界，被右侧容器截断隐藏，导致用户找不到提交按钮。

2. **`Java Web` 别名一致识别为 `Web编程技术`**：
   - 需要确保 `Java Web`、`java web`、`JavaWeb`、`JAVA WEB`、`java-web` 等所有大小写、空格与连字符变体，无论在单行极速录入、群消息解析还是课表映射中，均 100% 一致识别映射为 `Web编程技术`。

---

## Proposed Changes

### 1. `src/components/HomeworkTab.tsx`
- **重构手动表单按钮布局**：
  - 优化手动表单的 Grid/Flex 响应式布局。
  - 将“添加”提交按钮设置为固定大小 (`shrink-0 min-w-[72px]`)、显著的深蓝/高亮背景与加粗文字，并在右侧预留足够的内边距 (`padding`)，确保在任何手机或 PC 屏幕宽度下，“添加”按钮均 100% 完整显示在视口内。
  - 为表单各 Input 输入框添加按 `Enter` 回车键直接触发提交的功能，提升录入体验。

### 2. `src/utils/assignmentParser.ts`
- **全面补全 `Java Web` 别名库变体**：
  - 在 `COURSE_ALIASES['Web编程技术']` 数组中添加全部大小写与连字符形式：`'Java Web'`, `'java web'`, `'JavaWeb'`, `'javaweb'`, `'JAVA WEB'`, `'Java-Web'`, `'java-web'`, `'Java_Web'`, `'JavaWeb编程'`, `'Java Web程序设计'`。
  - 增强 `resolveCourseName` 中的小写标准化（`toLowerCase()`）反查匹配逻辑，保证即使课表中写的是 `Web编程技术`，输入的任何 `Java Web` 形式均能精准锁定该课程。

---

## Verification Plan

### 1. 手动添加表单界面与功能验证
- 展开「手动填写表单」，检查右侧是否出现清晰直观的 **「添加」** 按钮。
- 输入作业内容并点击“添加”按钮或按下回车键，确认作业成功添加至作业列表。

### 2. Java Web 识别一致性验证
- 在极速录入框与智能粘贴弹窗中分别输入以下变体：
  - `java web 实验3`
  - `JAVA WEB 完成任务1`
  - `JavaWeb 阶段测试`
- 确认识别预览与解析条目中的课程名统一且稳定地显示为 `Web编程技术`。

### 3. 代码构建检查
- 执行 `lint_applet` 与 `compile_applet` 确保构建无错。
