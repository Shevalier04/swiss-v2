# 华为浏览器息屏通知降级适配与语音识别异常修复方案

针对用户在手机端（特别是华为浏览器及鸿蒙机型环境）使用时出现的两大实际问题：
1. 语音录音转录弹出 `BACKEND_HTML_FALLBACK` 异常；
2. 华为浏览器因缺少 FCM 推送服务无法开启标准 Web Push 导致提示“暂不支持”。

---

### User Review & Critical Decisions

> [!IMPORTANT]
> 根据您的确认选择，我们将执行以下技术改造：

- **华为浏览器提醒适配方案（已确认）**：采用“纯系统通知降级”。在检测到缺少 `PushManager` 的华为/国产浏览器环境时，自动切换为**「本地增强系统级通知模式」**，支持一键申请手机系统级通知权限并触发系统通知栏提醒，同时在界面提供针对华为鸿蒙系统的“后台保活与常驻设置指引”（应用启动管理/允许后台活动）。
- **语音录音识别优化方案（已确认）**：采用“双轨并行”方案。在 Cloudflare Pages 边缘端补齐 `functions/api/ai/transcribe.ts` 接口消除 404/HTML 回退；同时在前端拦截底层异常，若云端不可用则**无缝自动降级为浏览器本地 Web Speech 离线语音识别**，杜绝出现 `BACKEND_HTML_FALLBACK` 等技术代号。

---

### 1. Overview & Core Concept

- **解决语音转录 HTML 报错**: 部署在 Cloudflare Pages 静态边缘时，请求 `/api/ai/transcribe` 原先会回退到 `index.html`，触发 `BACKEND_HTML_FALLBACK`。本次在 `functions/api/ai/` 增加边缘处理程序，并在前端 `VoiceInputModal.tsx` 中建立双重保险：优先云端转录，遇到网络或静态部署异常时自动采用已录制并实时转录的 `webkitSpeechRecognition` 结果，呈现温和友好的中文提示。
- **解决华为浏览器息屏提醒限制**: 国内安卓 OEM 浏览器（华为浏览器）未内置 Google FCM 推送中继，导致 `window.PushManager` 为空。通过环境特征感知，对华为浏览器展示“本地系统通知与后台守护”专属卡片，通过原生 `Notification` API 和 Service Worker 本地定时调度实现系统通知栏提醒。

---

### 2. User Experience & Visual Design

- **语音识别交互体验 (`VoiceInputModal.tsx`)**:
  - 录音过程中实时启动双轨监听（本地 Web Speech 实时出字 + MediaRecorder 录音流）。
  - 若云端接口正常，采用高精度大模型解析；若云端未配置密钥或返回 HTML，前端自动使用本地识别结果填入输入框，提示“已采用本地离线语音识别”，不再抛出任何红色技术报错框。
- **华为浏览器专属提醒卡片 (`ReminderTab.tsx`)**:
  - 当检测到当前为华为浏览器或环境不支持 `PushManager` 但支持 `Notification` 时，状态显示为：`华为浏览器/鸿蒙设备 · 已切换为本地系统级通知模式`。
  - 核心操作按钮动态变为：`开启本地系统级通知`，点击直接调用原生授权弹窗。
  - 新增展开式**「华为手机后台常驻与熄屏保活指引」**弹窗/抽屉：
    - 步骤 1：手机设置 -> 应用和服务 -> 应用启动管理 -> 找到“掌上课表”或“华为浏览器” -> 改为“手动管理”（允许自启动、允许后台活动）。
    - 步骤 2：多任务界面下拉锁定卡片。
    - 步骤 3：在浏览器菜单中点击“添加到桌面”快捷方式，拥有独立进程体验。

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: 区分 PushManager（云端中继）与 Notification（本地系统通知）**
  - *Chosen Approach*: 将 `isPushNotificationSupported()` 细分为两层能力探测：`hasPushManager`（支持远端熄屏云唤醒）与 `hasNotification`（支持本地原生系统通知栏横幅）。华为浏览器虽然不支持前者，但完全支持后者。
  - *Why*: 彻底消除华为用户被“一票否决”拦截在外的痛点，让华为用户也能享受到系统通知栏弹窗。
- **Decision 2: 消除技术性错误代号暴露**
  - *Chosen Approach*: 在 `src/services/api.ts` 与 `VoiceInputModal.tsx` 中将任何非 JSON 或 HTML 响应映射为可控的语义化处理，默认回退本地语音文本。

---

### 4. Technical Architecture & Data Strategy

```
┌──────────────────────────────────────────────────────────────┐
│                  Client Environment Detection                │
│                                                              │
│  ┌─────────────────────────┐     ┌────────────────────────┐  │
│  │ Chrome / Edge / PWA     │     │ Huawei Browser / EMUI  │  │
│  │ (has PushManager + FCM) │     │ (has Notification API) │  │
│  └───────────┬─────────────┘     └───────────┬────────────┘  │
│              │                               │               │
│              ▼                               ▼               │
│  ┌─────────────────────────┐     ┌────────────────────────┐  │
│  │ Mode A: Web Push Mode   │     │ Mode B: Local Sys Mode │  │
│  │ - VAPID Key Subscribe   │     │ - Request Notification │  │
│  │ - Cloud Push Service    │     │ - Service Worker Alert │  │
│  │ - True Lock-Screen Wake │     │ - Background Keepalive │  │
│  └─────────────────────────┘     └────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                               │
               Voice Recording │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                 Dual-Engine Voice Transcription              │
│                                                              │
│        ┌────────────────────────────────────────────┐        │
│        │ 1. Web Speech API (Local Realtime Stream)  │        │
│        └─────────────────────┬──────────────────────┘        │
│                              │ Fallback on error             │
│                              ▼                               │
│        ┌────────────────────────────────────────────┐        │
│        │ 2. Cloud AI (/api/ai/transcribe)           │        │
│        │    (Cloudflare Pages Function + Gemini)    │        │
│        └────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────┘
```

- **Interactive Component & State Mapping**:
  - `functions/api/ai/transcribe.ts`: Cloudflare Pages Edge Function，支持处理音频 Base64 转录，未配置 Key 时返回友好结构，不返回 HTML。
  - `src/components/VoiceInputModal.tsx`: 优化转录异常捕获逻辑，接入本地文本静默回退，消除红框报错。
  - `src/utils/pushManager.ts`: 增加 `getNotificationCapability()`，明确分流 Web Push 与本地系统通知。
  - `src/components/ReminderTab.tsx`: 根据检测结果自适应展示“云端锁屏推送”或“本地系统通知保活”卡片，并集成华为保活说明弹层。
