# 掌上课表 · Swiss Editorial (University Course Schedule & Focus System)

> 高格调瑞士报刊排版风大学课程表应用。支持课程排布、周次自动计算、作业截止倒计时、内置番茄钟深度专注、桌面小组件生成、PDF教务导入与离线单文件运行。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Vite](https://img.shields.io/badge/Vite-6-646CFF)

---

## 🌟 核心功能

1. **今日动态与周课表**
   - 智能识别当前学期周次、当日课程，高亮“下一节课”及距离上课剩余时间。
   - 紧凑报刊网格排版，双周/单周课程智能筛选。

2. **个人任务与番茄钟（Pomodoro Focus）**
   - 任务清单直接联动番茄工作法时钟。
   - 支持**深度专注 (25m)**、**短休息 (5m)**、**长休息 (15m)**。
   - Web Audio 提示音唤醒与今日番茄数统计（本地持久化）。

3. **作业截止倒计时**
   - 紧急度色彩标注，按截止时间自动排序，支持快速勾选完成与管理。

4. **教务处课表 PDF 智能解析导入**
   - 支持高校教务处直接导出的 PDF 课表文件解析。

5. **手机日历导出与桌面小组件**
   - 生成高清深色小组件 PNG 图片。
   - 导出 `.ics` 日历文件，直接导入 iOS / Android 系统日历。

6. **免服务器单文件版 (`public/mobile.html`)**
   - 单文件 HTML 架构，完全无需后端或 Node.js 环境，直接发到微信/手机浏览器即可永久使用。

---

## 🚀 如何上传并储存到 GitHub

你可以通过以下任一方式将本项目上传至 GitHub 仓库：

### 方式一：网页端直接上传（推荐新手）

1. 在 GitHub 上点击右上角 **「New repository」**（新建仓库），填写仓库名（如 `my-course-schedule`），选择 Public 或 Private，点击 **Create repository**。
2. 在新仓库页面中，点击 **「uploading an existing file」**（上传现有文件）。
3. 将下载的源码压缩包解压后的所有文件夹及文件（除 `node_modules` 之外）拖拽上传到 GitHub 页面。
4. 点击底部的 **「Commit changes」** 保存即可！

### 方式二：使用 Git 命令行推送

如果你电脑上安装了 Git，打开终端进入本项目根目录：

```bash
# 1. 初始化本地仓库
git init

# 2. 添加所有文件
git add .

# 3. 提交更改
git commit -m "feat: init course schedule & pomodoro app"

# 4. 关联 GitHub 远程仓库 (替换为你自己的 GitHub 仓库地址)
git remote add origin https://github.com/你的用户名/你的仓库名.git

# 5. 推送至 GitHub
git branch -M main
git push -u origin main
```

---

## 🌐 部署指南

### 1. 部署到 Cloudflare Pages（永久免费且国内访问极速）
1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/) -> **Workers & Pages** -> **Create application** -> **Pages**。
2. 选择 **Connect to Git**，选中你的 GitHub 仓库。
3. 构建配置设置：
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. 点击 **Save and Deploy**，即可获得全球 CDN 加速的访问网址！

### 2. 部署到 GitHub Pages
本项目内置了 `.github/workflows/deploy.yml` 自动化工作流。
在 GitHub 仓库中进入 **Settings -> Pages -> Build and deployment -> Source** 选择 **GitHub Actions**，每次 push 代码将自动构建并上线。

---

## 💻 本地开发运行

```bash
# 安装依赖
npm install

# 启动本地开发服务 (端口 3000)
npm run dev

# 生产环境打包构建
npm run build

# 预览生产产物
npm run preview
```

---

## 📁 目录结构

```
├── .github/workflows/   # GitHub Actions 自动化部署配置
├── public/              # 静态资源与独立离线版 (mobile.html)
├── src/
│   ├── components/      # React 组件 (番茄钟、今日课表、周课表、作业等)
│   ├── types/           # TypeScript 核心数据类型定义
│   ├── utils/           # 辅助工具函数 (音频、时间计算、日历导出等)
│   ├── App.tsx          # 主入口组件
│   └── main.tsx         # 渲染挂载点
├── package.json         # 项目依赖与编译脚本
├── vite.config.ts       # Vite 构建配置
└── README.md            # 项目说明文档
```

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 开源。
