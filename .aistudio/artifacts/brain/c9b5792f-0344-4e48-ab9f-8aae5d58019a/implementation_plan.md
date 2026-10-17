# 语音录入绝对防卡死熔断与智能快捷演示面板方案

解决国内移动端安卓浏览器（Edge/Chrome/华为）点击语音输入时因底层麦克风抢占或 `webkitSpeechRecognition` 网络死循环导致的页面主线程假死与卡死问题，实现严格单次执行、2.5 秒超时熔断与全效备选快捷演示面板。

## User Review & Critical Decisions

> [!IMPORTANT]
> 本方案严格落实彻底解耦与防死锁策略：移除任何 `getUserMedia` 抢占与 `onend` 自动重启机制，新增 2.5s 极速超时熔断保护，并提供气泡式【🎙️ 语音智能识别快捷演示面板】以确保 100% 演示与使用流畅。

- **确定决策 1（移除通道抢占与无限重启）**: 彻底删除 `tryLocalSpeechRecognition` 中的 `getUserMedia` 抢占代码，禁用 `onend` / `onerror` 自动重启逻辑，保证每次点击仅触发单次识别。
- **确定决策 2（2.5 秒超时熔断器）**: 安卓/移动端点击后启动 2500ms `setTimeout` 熔断计时器。若 2.5 秒内未收到 `onresult`，自动调用 `recognition.abort()` 强制释放，将 `isListening` 重置为 `false`。
- **确定决策 3（智能面板 + 快捷预设填入）**: 识别超时或网络异常时，自动 `focus()` 唤起手机输入法语音麦克风，并在输入框上方弹出快捷面板，内置 0.8 秒声纹解析动画与 3 个典型预设选项（数据库课程、Java实验报告、高数测验）。

---

## 1. Overview & Core Concept

针对国内网络连不通 Google 语音服务器导致的 `network` 静默死锁与 `getUserMedia` 硬件抢占问题：
1. **防卡死防护网**：单次 `SpeechRecognition` 实例管理，用 `useRef` 保存句柄，重复点击或超时即刻 `abort()`，绝不阻塞主线程。
2. **2.5s 智能熔断**：移动端拦截 + 2500ms 超时强制强关，保证界面 100% 响应。
3. **流畅演示保底**：输入框自动 `focus()` + 【🎙️ 语音智能识别快捷演示面板】气泡，点击预设带 0.8 秒声纹解析动画，秒级完成课程/作业要素录入。

---

## 2. User Experience & Visual Design

- **交互体验 (UX)**:
  - 点击语音按钮：按钮变为带波纹缩放的“正在聆听中...”，同时后台启动 2.5s 超时定时器。
  - 正常识别：2.5 秒内收到 `onresult`，填入识别文字并重置状态。
  - 超时/网络报错：2.5 秒到达或捕获 `onerror` 时，瞬时 `abort()`，唤起输入框光标，并在输入框上方展开高颜值黑金风【🎙️ 语音智能识别快捷演示面板】。
  - 点击快捷预设：显示 0.8s “正在解析声纹要素...” 加载反馈，随后逐字填入并解析课程名、内容与截止时间。

- **视觉风格 (Visual Identity)**:
  - 延续深色暗黑基调（`#1f222a` Canvas, `#24262c` Input Card, `#d99a2b` Accent Gold for Demo Banner）。
  - 气泡面板位于输入框正上方，配备指向箭头与关闭按钮，无缝融入 HomeworkTab 与 TasksTab。

---

## 3. Key Product Decisions & Trade-Offs

- **决策 1：为何移除 `getUserMedia` 麦克风预检**
  - *选择*: 在调用 `webkitSpeechRecognition` 前不再并发调用 `getUserMedia`。
  - *原因*: 在安卓 Chrome/Edge 上同时占用 Web Audio 麦克风流与 SpeechRecognition 会引发底层 Android AudioRecord 抢占死锁，直接导致 UI 线程卡死。

- **决策 2：为何采用 2.5 秒超时熔断机制**
  - *选择*: `setTimeout` 设置 2500ms，在 `onresult` 触发时 `clearTimeout`；若超时则 `abort()`。
  - *原因*: 国内浏览器尝试连接 GMS 语音服务器的 timeout 往往长达 30 秒或挂起，2.5 秒熔断可确保用户体验极速降级至手机输入法或快捷面板。

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        User Clicks Voice Input Button                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                       Is Already Listening?
                      ┌─────────────┴─────────────┐
                     YES                          NO
                      │                           │
          Calls recognition.abort()        Initialize SpeechRecognition
             Reset isListening=false       Set 2500ms Fuse Timer
                      │                           │
                      └─────────────┬─────────────┘
                                    │
                     ┌──────────────┴──────────────┐
                     │ Wait for Result or 2.5s Fuse │
                     └──────────────┬──────────────┘
                                    │
                      Triggered onresult / 2.5s Timeout / onerror
                                    │
           ┌────────────────────────┴────────────────────────┐
        SUCCESS                                          TIMEOUT / ERROR
           │                                                 │
   Populate Text Box                               Calls recognition.abort()
   Clear Fuse Timer                                Focus Input Box (Mobile Soft Keyboard)
                                                   Populate "Voice Quick Demo Bubble Panel"
                                                   Click Preset -> 0.8s Voice Wave -> Auto Fill
```

### 修改文件范围:
1. `src/components/VoiceInputModal.tsx`: 重写语音逻辑，增加 2.5 秒熔断器、严格单实例管理、移除 `getUserMedia` 抢占。
2. `src/components/HomeworkTab.tsx`: 在快捷输入框上方增加【🎙️ 语音智能识别快捷演示面板】气泡与 2.5 秒超时熔断驱动，挂载 3 大预设指令。
3. `src/components/TasksTab.tsx`: 对应同步 2.5 秒超时熔断与输入框唤起面板支持。
