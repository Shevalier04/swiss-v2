# Persistent Floating Pomodoro Widget Implementation Plan

Implement a persistent, floating Pomodoro timer widget that stays active on screen even when the user navigates away or the app is in the background, continuing to tick until manually stopped, and only closing when explicitly clicked via its close ('X') button.

## User Review & Critical Decisions

> [!IMPORTANT]
> - **Persistent Floating Widget**: Will float on top of all views (bottom-right corner by default with drag support).
> - **Background Persistence**: Timer continues running across tab/view switches and background states.
> - **Explicit Close vs Stop**: Clicking 'X' minimizes/closes the floating widget (while timer continues running in the background state); clicking "Stop" or "Reset" inside the timer fully stops the session.

## 1. Overview & Core Concept

- **What It Does**: Elevates the Pomodoro timer into a floating, persistent overlay widget that floats at the bottom-right of the screen. It can be dragged around, minimized/closed via 'X' (without stopping the active timer), and keeps running continuously across views until manually stopped or completed.
- **Key Value**: Allows students and professionals to keep track of their study/work focus sessions anywhere in the app without interrupting their countdown when switching tabs.

## 2. User Experience & Visual Design

- **Floating Widget UI**:
  - Compact, sleek pill/card floating widget pinned to bottom-right (`fixed bottom-6 right-6 z-50`).
  - Displays countdown MM:SS, current mode (Focus / Short Break / Long Break), active task name, and playback controls (Start/Pause, Stop, Close 'X', Expand/Collapse).
  - Drag support via header handle so users can reposition it anywhere on screen.
- **Visual Identity**: Dark glassy backdrop (`bg-[#181a20]/95 backdrop-blur-md border border-[#6b7cff]/40 shadow-xl rounded-2xl p-3.5 text-white`) matching the app's aesthetic.

## 3. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│                   App-Level State / Context            │
│  - pomodoroTimeRemaining, pomodoroRunning, pomodoroMode│
│  - isFloatingWidgetOpen, floatingWidgetPosition        │
└───────────┬────────────────────────────────────────────┘
            │
            ├────────────────────────────────────────────┐
            ▼                                            ▼
┌───────────────────────┐                    ┌───────────────────────┐
│     PomodoroTab       │                    │  PersistentFloating   │
│  (Full Timer View)    │                    │     PomodoroWidget    │
└───────────────────────┘                    └───────────────────────┘
```

- **State Persistence**: Store timer state and floating widget visibility (`isFloatingWidgetOpen`, timer start timestamp / remaining seconds) in React state or localStorage/global context so it persists across tab switches and background states.
- **Timer Engine**: Use a robust `setInterval` / `requestAnimationFrame` or timestamp-based diff calculation so background timing stays accurate.
