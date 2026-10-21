# 官方作业清单同步池（导入池）排序功能实施计划

## 1. 用户需求与确认要点
- **功能目标**：为“官方作业清单同步”（HomeworkImportModal）列表增加排序功能，便于学生和教师根据紧迫度或科目清晰浏览并批量勾选导入。
- **支持维度（基于答复）**：
  1. **截止日期升序（紧迫优先）**：截止时间最近的作业排在最前；
  2. **截止日期降序（远期在前）**：截止时间较晚的作业排在最前；
  3. **按课程名称排序**：按科目字母/拼音自然归类排列；
  4. **默认顺序**：保持云端作业池原录入顺序。
- **默认排序（基于答复）**：打开弹窗时，默认按 **截止日期升序（紧迫优先）** 展示。
- **UI 布局（基于答复）**：在搜索栏与课程筛选下拉框右侧，新增一个精致小巧的**排序下拉框（Compact Dropdown）**。

---

## 2. 详细技术方案

### A. 状态与排序引擎 (`src/components/HomeworkImportModal.tsx`)
1. **状态定义**：
   ```tsx
   export type ImportPoolSortType = 'due_asc' | 'due_desc' | 'course_asc' | 'original';
   const [sortBy, setSortBy] = useState<ImportPoolSortType>('due_asc');
   ```
2. **多维排序算法 (`useMemo`)**：
   - 提取截止时间解析函数，支持 `YYYY-MM-DD HH:mm`、`YYYY/MM/DD` 等各类型时间戳转换。
   - 无明确截止时间（null/空）的条目统一置于末尾。
   - `due_asc`（默认）：紧迫优先，`msA - msB`；若时间相同，按 ID 升序排列。
   - `due_desc`：远期在前，`msB - msA`。
   - `course_asc`：使用 `itemA.course.localeCompare(itemB.course, 'zh-CN')`，同课程内自动按截止时间排序。
   - `original`：维持模板加载时的初始 ID 次序。

### B. 工具栏界面集成 (`src/components/HomeworkImportModal.tsx`)
1. **紧凑型排序选择器**：
   - 紧邻现有的课程分类选择器（`select`），风格完全对齐暗色瑞士设计：
     - 背景色 `#141518`、边框 `#3a3d46`、字体大小 `text-xs`、高亮焦点 `#6b7cff`。
   - 选项内容清晰易懂：
     - `⏳ 截止紧迫优先 (默认)`
     - `📅 截止远期在前`
     - `📚 按课程名称排序`
     - `🔄 原始录入顺序`
2. **联动保持**：
   - 排序与已有的模糊搜索（`searchQuery`）及课程过滤（`selectedCourseFilter`）无缝联动。
   - 排序切换不影响已勾选状态（`selectedIds` 保持不变）。

---

## 3. 验证计划
1. **编译检查**：调用 `compile_applet` 确保 TypeScript 类型与 JSX 构建通过。
2. **语法检查**：调用 `lint_applet` 确保无 lint 报错。
3. **功能验证**：
   - 打开导入池时，确认第一条为截止时间最近的作业（如 `2026-10-19 10:00` 早于 `2026-10-26`）；
   - 切换“截止远期在前”，确认最晚截止的作业排到顶部；
   - 切换“按课程名称排序”，确认相同课程连续聚合；
   - 测试结合搜索词与分类筛选时，排序均正常生效且全选/导入功能运作顺畅。
