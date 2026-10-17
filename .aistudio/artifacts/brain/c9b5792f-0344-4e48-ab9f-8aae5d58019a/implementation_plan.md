# 实施计划 - 通知全效组合降级与多重保底方案

针对华为浏览器、Edge 移动端及各类内核无法启用系统原生通知权限的情况，本方案将引入**“全效组合降级保底”机制**。当检测到系统通知无法开启或被拦截时，系统将自动无缝降级，同步激活**【应用内强提醒悬浮卡片 + 手机物理震动 + Web Audio 提示音 + 手机系统日历响铃】**，确保开课与作业提醒 100% 准时触达。

## 一、方案核心内容

### 1. 通知强制降级与组合保底开关 (Switch)
- 在 `BrowserDoctorModal` 与 `ReminderTab` 中增加 **“强制开启全效通知组合降级”** 开关（持久化存储至 `cs_force_fallback_notify`）。
- 当开启或触发降级时，即便 `Notification.permission` 为 denied 或不支持，系统也不会阻断提醒，而是直接标记为 `全效组合降级模式已激活 ✓`。

### 2. 组合降级四重保底执行逻辑 (`checkReminders` & `triggerReminder`)
当开课前（如提前 10-15 分钟）或作业临期时，若处于降级模式或系统通知不可用：
1. **应用内悬浮横幅**：页面顶部展示倒计时弹窗与课程信息（`ReminderToast`）。
2. **手机物理马达震动**：调用 `navigator.vibrate([300, 150, 300, 150, 400])` 触发震动。
3. **Web Audio 提示音**：使用 Web Audio API 播放清脆开课提醒蜂鸣 (`playReminderBeep()`)。
4. **一键同步系统日历**：在降级卡片中直接嵌入【一键同步手机系统日历】按钮，生成带 15 分钟提前闹钟的 `.ics` 文件，依靠手机原生日历实现黑屏锁屏响铃。

### 3. UI 交互与测试工具升级
- 在 `ReminderTab` 与 `BrowserDoctorModal` 中提供 **“一键实测组合降级提醒”** 按钮，点击瞬间同时发出音效、物理震动、弹出悬浮卡片。
- 在检测面板与降级卡片中，增加针对 Edge 与华为浏览器的专用排查说明与日历快捷同步入口。

---

## 二、拟修改的文件列表

1. `src/utils/pushManager.ts`:
   - 增加 notification capability 的降级状态识别与 `scheduleFallbackReminder` 辅助工具。
2. `src/components/ReminderTab.tsx`:
   - 增加“全效组合降级卡片”，包含切换开关、组合测试按钮与一键同步日历。
3. `src/components/BrowserDoctorModal.tsx`:
   - 增加“强制通知降级与组合保底开关”及多重提醒实测工具。
4. `src/App.tsx`:
   - 优化 `checkReminders` 逻辑，确保当原生 Notification 失败或被封锁时，组合降级（横幅+震动+声音）持续稳定执行。

---

## 三、用户确认

请确认是否按照上述计划开始执行代码编写与测试？
