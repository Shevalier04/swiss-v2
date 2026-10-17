# Web Push 系统级离线/锁屏推送通知架构方案

为“掌上课表”引入标准 Web Push Notifications（网络推送）技术栈，使学生在锁屏、手机休眠或应用未打开状态下，也能通过系统级通知栏准时接收课前提醒、作业截止预警及晚间早课预告。

### User Review & Critical Decisions

> [!IMPORTANT]
> 基于前期澄清沟通，本项目将采用全自动化服务端 VAPID 密钥管理与离线后台推送调度，并于“提醒”标签页呈现清晰直观的推送订阅卡片与全链路即时测试工具。

- **推送凭证管理方式（已确认）**：服务端自动生成与持久化 VAPID 公私钥对（首次启动如无则自动生成存储至 `data/vapid_keys.json`），前端无需手动配置任何外部凭证，开箱即用。
- **推送触发场景（已确认）**：
  1. 课程开课前调度提醒（默认按用户设置的课前提前时间，如 15/20/30 分钟）
  2. 作业截止倒计时预警（临近 24 小时 / 3 小时截止未完成作业）
  3. 即时手动“测试推送”按钮，供用户实时验证锁屏推送链路
- **UI 呈现位置（已确认）**：在“上课提醒（Reminders）”标签页内设计专属的「锁屏与系统级 Web Push」控制卡片，清晰指示订阅状态、设备注册状态及测试发送按钮。

---

### 1. Overview & Core Concept

- **What It Does**: 传统浏览器端定时器（`setInterval`）在手机熄屏或切出后台数分钟后会被移动端操作系统（iOS WebKit / Android Chromium）主动挂起休眠，导致课前通知漏报。本架构采用 W3C Push API 与 Push Service 机制，由 Node.js 服务端定时比对课表与作业，借助浏览器推送服务器向设备发送标准 Web Push 数据包；Service Worker 在锁屏唤醒并直接唤起操作系统原生通知栏。
- **Target Audience / Persona**: 习惯熄屏装在口袋或书包中的大学生用户，不需要时刻开着网页，即可在教室门口或寝室准时收到下节课的教室、座次与作业提醒。
- **Key Value**: 真正实现无感、可靠的系统级推送交付，从“前台轮询”转变为“云端协同原生体验”。

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **开启授权流程**：用户进入“提醒”标签页，点击「开启锁屏系统推送」，浏览器弹出原生系统级通知权限请求。
  2. **端到端自动注册**：授权成功后，前端从服务端拉取公钥，调用 `registration.pushManager.subscribe` 获取 `PushSubscription` 凭证，静默上报并绑定至当前账号。
  3. **实时测试验证**：卡片上提供「发送锁屏测试通知」按钮，点击后即使立即熄屏或最小化应用，5 秒内手机通知栏即可收到震动与推送卡片，点击通知卡片可直接精准深链接直达课表对应位置。
  4. **自主关闭或设备解绑**：支持一键关闭系统级推送或更换设备，服务端自动注销无效订阅。

- **Visual Identity & Theme**:
  - *Design Posture*: 沿用 Swiss Editorial 瑞士排版高格调深色模式（深墨色 `#1d1f24`、暖米色 `#e9e4d8`、克莱因蓝 `#6b7cff` 与薄荷绿 `#4ade80`）。
  - *Card Geometry*: 遵循移动端人体工学原则，设计圆角卡片、清晰的分隔线与宽触控区域（$\ge 44\text{px}$ 交互热区）。
  - *Zero-Pill Discipline*: 状态与设备信息采用无边框自然文本与微标点排版，坚决避免粗劣的多层药丸胶囊堆叠。

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: 自定义 Service Worker vs vite-plugin-pwa 插件配置**
  - *Chosen Approach*: 采用 `vite-plugin-pwa` 协同配置，并将包含 `push` 与 `notificationclick` 事件的核心脚本配置在 Service Worker 注入逻辑中（或提供标准 `public/sw.js` 注入策略），确保在开发模式与生产模式打包后均能稳健注册。
  - *Why*: 保证现有 PWA 离线缓存、更新逻辑不受破坏，同时赋予接收云端推送与点击深链接能力。
  - *Alternatives Considered*: 完全手写独立 Service Worker 会导致丢失 Vite 资源自动哈希预缓存机制。

- **Decision 2: VAPID 密钥持久化与安全性**
  - *Chosen Approach*: 服务端在 `data/vapid_keys.json` 中自动生成并持久化公私钥，公开端点 `/api/push/vapid-public-key` 仅暴露公钥。
  - *Why*: 彻底消除部署前繁琐的人工命令配置门槛，即便容器重启也保持密钥一致性。

- **Decision 3: 服务端后台巡检与推送调度调度器**
  - *Chosen Approach*: 在 Express 服务端集成轻量级分钟级轮询守护定时器，结合各用户的实时课表和作业数据，向已注册且开启提醒的订阅端点派发推文；同时提供即时单发测试接口。
  - *Why*: 纯服务端驱动能够抵御客户端休眠断连，保证准时到达。

---

### 4. Technical Architecture & Data Strategy

```
┌──────────────────────────────────────────────────────────────┐
│                      Client (Browser / PWA)                  │
│                                                              │
│  ┌───────────────────────┐       ┌────────────────────────┐  │
│  │   ReminderTab UI      │       │      Service Worker    │  │
│  │  - Web Push Switch    │       │     (push / click)     │  │
│  │  - Test Push Button   │       └───────────▲────────────┘  │
│  └───────────┬───────────┘                   │               │
│              │ Subscribe / Token             │               │
└──────────────┼───────────────────────────────┼───────────────┘
               │                               │ Native Push
               ▼                               │ Delivery
┌──────────────────────────────────────────────┼───────────────┐
│              Server (Node.js / Express)      │               │
│                                              │               │
│  ┌─────────────────────────┐                 │               │
│  │  Web Push API Router    │                 │               │
│  │  - GET /vapid-public-key│                 │               │
│  │  - POST /subscribe      │                 │               │
│  │  - POST /test-push      │                 │               │
│  └───────────┬─────────────┘                 │               │
│              │                               │               │
│              ▼                               │               │
│  ┌─────────────────────────┐                 │               │
│  │  Push Notification      │                 │               │
│  │  Dispatcher & Scheduler ├─────────────────┘               │
│  │  - Class Start Checker  │  (via web-push & Browser FCM /  │
│  │  - Homework Due Checker │   Apple Web Push Gateways)      │
│  └───────────┬─────────────┘                                 │
│              │                                               │
│              ▼                                               │
│  ┌─────────────────────────┐                                 │
│  │ Local JSON Database     │                                 │
│  │ - timetable_db.json     │                                 │
│  │ - vapid_keys.json       │                                 │
│  └─────────────────────────┘                                 │
└──────────────────────────────────────────────────────────────┘
```

- **Interactive Component & State Mapping**:
  - `ReminderTab.tsx`: 增加 Web Push 状态监控（已订阅 / 待授权 / 不支持）、一键订阅按钮、测试推送触发器与详细状态解说。
  - `src/utils/pushManager.ts`: 封装 Service Worker 注册检测、URL-Base64 公钥格式转换、`pushManager.subscribe` 与后端同步逻辑。
  - `server/pushService.ts`: 封装 `web-push` 库交互、VAPID 自动生成与存盘、多设备订阅存储、单播及广播发送、失效订阅（410 Gone / 404）自动清理逻辑。
  - `server/api.ts`: 挂载 `/api/push/*` 路由群组，包含公钥分发、订阅注册/注销、手动测试触发与定时检查触发。
