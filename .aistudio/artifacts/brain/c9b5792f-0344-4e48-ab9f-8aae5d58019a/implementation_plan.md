# 实施计划 - 国内安卓浏览器 Web Push 优雅降级与 SW 后台锁屏测试通知重构

为了解决国内安卓手机（如华为、小米、OPPO、vivo 等）在 Edge/Chrome 浏览器中由于无法连接海外 FCM/WNS 推送服务器而触发 `Registration failed - push service error` 报错、且熄屏收不到通知的问题，本方案将对推送与通知流程进行深度重构。

---

## 一、核心重构方案

### 1. 【优雅降级，屏蔽报错】推送订阅重构 (`src/utils/pushManager.ts`)
- **错误捕获与静默降级**：
  在 `subscribeToPushNotifications()` 调用 `pushManager.subscribe()` 时，用 `try-catch` 捕获 `push service error`、`Push service not available`、`AbortError` 等国内长连接不可达错误。
- **屏蔽英文报错 Toast**：
  捕获错误后，不再向用户弹出原始英文报错，而是自动记录 `localStorage.setItem('cs_sw_local_mode', 'true')` 并切换为 **“SW 系统级通知模式”**。
- **UI 状态与测试解封**：
  当通知权限为 `granted` 且处于 SW 本地守护模式时，将推送状态更新为 **“已开启 (SW 系统级通知模式)”**，并同步解锁下方的 **“发送锁屏测试通知 (可熄屏验证)”** 按钮。
- **标准 VAPID 转换**：
  确保存量的 VAPID 公钥转换严格使用标准的 `urlBase64ToUint8Array` 函数。

### 2. 【SW 后台接管，5秒熄屏锁屏测试】(`public/sw-push.js` & `src/utils/pushManager.ts`)
- **Service Worker 后台定时器处理**：
  在 `public/sw-push.js` 中增加 `SCHEDULE_LOCK_NOTIFICATION` 监听，接收包含 `delay: 5000` 的消息，由 Service Worker 在后台通过 `setTimeout` 直接执行 `self.registration.showNotification()`。
- **双重保底触发**：
  - **网页侧**：点击测试时首先 Toast 提示：“请在 5 秒内按电源键锁屏/息屏，5 秒后将触发系统锁屏通知”，并启动 5 秒 `setTimeout`。
  - **Service Worker 侧**：通过 `navigator.serviceWorker.controller.postMessage()` 向 SW 投递后台倒计时任务，即使页面在按电源键后被安卓冻结，SW 依然能在后台亮屏震动弹出通知（`vibrate: [300, 100, 300]`，`requireInteraction: true`）。

### 3. 【界面与逻辑全面联动】(`src/components/ReminderTab.tsx`)
- 整合服务端测试推送与 SW 锁屏测试逻辑：当网络可达时走 Web Push，当处于国内 SW 模式时自动触发 5 秒倒计时熄屏锁屏测试。
- 在页面状态卡片中明确标识：“系统通知权限：已允许 (SW 系统级通知模式已就绪)”。

---

## 二、拟修改的文件列表

1. `public/sw-push.js`:
   - 增加 `SCHEDULE_LOCK_NOTIFICATION` 监听逻辑，处理 SW 后台延时锁屏弹窗与震动。
2. `src/utils/pushManager.ts`:
   - 重构 `subscribeToPushNotifications()` 异常捕获与降级逻辑；
   - 重构 `sendLocalTestNotification()` 与 `scheduleDelayedLockScreenTest()`，实现 SW 消息与页面双轨触发。
3. `src/components/ReminderTab.tsx`:
   - 更新“开启锁屏系统推送”与“发送锁屏测试通知”按钮的逻辑与状态样式。

---

## 三、用户确认

请确认上述实施计划。确认后请点击 **“Proceed”**，我将开始代码编写与编译验证。
