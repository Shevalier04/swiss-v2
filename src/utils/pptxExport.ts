import pptxgen from 'pptxgenjs';

export interface SlideData {
  id: number;
  section: string;
  title: string;
  subtitle: string;
  points: { title: string; desc: string; icon?: string }[];
  highlightBadge?: string;
  notes?: string;
  footerText?: string;
}

export const PRESENTATION_SLIDES: SlideData[] = [
  {
    id: 1,
    section: '产品介绍 · COVER',
    title: '掌上课表 Swiss Editorial',
    subtitle: '新一代极简高校课表、智能作业解析与专注管理系统 · 产品使用说明书',
    points: [
      {
        title: '产品定位',
        desc: '专为高校师生打造的极简报刊风（Swiss Editorial）日程管理、作业协同与番茄专注工具。',
      },
      {
        title: '核心特色',
        desc: '教务处课表一键导入、群通知智能识别、作业与待办双向联动、桌面小组件与系统日历同步、班级管理员终端统一管控。',
      },
      {
        title: '多端支持',
        desc: 'Cloudflare D1 云端数据库实时存储，支持 PWA 离线运行、桌面端与移动端即开即用。',
      },
    ],
    highlightBadge: 'v4.5 全功能官方手册',
    notes: '本手册面向高校学生与班级骨干/系统管理员，详细介绍掌上课表的各项核心功能、快捷操作及最佳实践。',
  },
  {
    id: 2,
    section: '全局架构 · ARCHITECTURE',
    title: '系统功能全景与架构图',
    subtitle: '以课程表为核心基座，辐射作业管理、个人待办、专注番茄钟与班级协同',
    points: [
      {
        title: '1. 日程基座（Timetable & Today）',
        desc: '今日日程卡片、全学期 1-25 周课表网格、多周轮换高亮、教务系统 PDF 智能解析与课表录入。',
      },
      {
        title: '2. 学业闭环（Homework & Tasks）',
        desc: '微信/QQ班群消息智能一键粘贴、作业截止倒计时、作业一键顺手转待办、完成状态双向实时同步。',
      },
      {
        title: '3. 专注提效（Pomodoro & Alerts）',
        desc: '任务联动番茄钟、自定义白噪音/提示音、课前自定义分钟预警、周日晚贴心次日首课强提醒。',
      },
      {
        title: '4. 跨端与协同（Widget & Terminal）',
        desc: '高清深色桌面小组件预览导出、手机日历系统级同步、管理员终端（CLI+GUI）全员作业强制下发。',
      },
    ],
    highlightBadge: '一体化学业流',
    notes: '掌上课表打破了传统课表软件“只查课不记作业”的痛点，将课表时段与作业截止、待办专注紧密打通。',
  },
  {
    id: 3,
    section: '模块一 · TIMETABLE',
    title: '极速课表与学期排课',
    subtitle: '双视图无缝切换，支持多周别、教室地点与双师信息，精准把控每节课',
    points: [
      {
        title: '今日视图（Today）',
        desc: '以时间轴形式清晰罗列当前节次、上课倒计时、教室门牌号及授课教师；当前进行中的课程呼吸灯动效高亮。',
      },
      {
        title: '学期周视图（Week）',
        desc: '横向 7 天 + 纵向 12 节课标准报刊风格网格；顶部周次滑动切换（1-25周）；非本周课程智能半透明置灰。',
      },
      {
        title: '教务 PDF 一键智能导入',
        desc: '支持直接上传教务系统导出的横版/旋转 PDF 课表，内置 pdf.js 本地极速提取，自动拆解节次与周次。',
      },
      {
        title: '自定义课程与颜色编码',
        desc: '点击任意网格空白处或“+ 课程”，轻松录入单双周、教室、连堂节次与定制色块。',
      },
    ],
    highlightBadge: '双视图 · PDF秒导',
    notes: '建议开学初直接在“我的 -> 从教务系统 PDF 导入课表”，或手动在周视图空白格子点击添加。',
  },
  {
    id: 4,
    section: '模块二 · SMART PARSER',
    title: '群消息智能粘贴与作业解析',
    subtitle: '零手动输入：直接复制微信/QQ群长消息，AI 规则引擎毫秒级清洗提取',
    points: [
      {
        title: '群聊杂质自动剔除',
        desc: '智能识别并过滤昵称、时间戳（如“学委 14:30”）、系统撤回提示、@所有人、分割线以及各类格式噪音。',
      },
      {
        title: '聊天表情包彻底剥离',
        desc: '深度过滤【表情】、[表情]、[动画表情]、[图片]、[语音]及各类多媒体标签，避免表情字符被误填入作业标题。',
      },
      {
        title: '课程简称智能映射',
        desc: '自动将“高数/微积分”映射为“高等数学”，“大物”映射为“大学物理”，“线代”映射为“线性代数”等。',
      },
      {
        title: '自然语言截止时间推算',
        desc: '自动识别“今晚21:30”、“明天上午10点”、“下周三前”等口语化日期，精确换算为标准截止时间戳与倒计时。',
      },
    ],
    highlightBadge: '秒级解析 · 智能去噪',
    notes: '在作业页点击右上角“智能粘贴”，将整段群公告直接粘贴进去，即可看到预览卡片，一键保存。',
  },
  {
    id: 5,
    section: '模块三 · WORK & TASKS',
    title: '作业与待办双向打通',
    subtitle: '作业一键顺手加入待办，联动番茄钟，双向同步完成状态，界面极简不杂乱',
    points: [
      {
        title: '一键“+ 待办”轻量胶囊',
        desc: '作业列表中每条未完成作业显示紧凑胶囊按钮，轻触即可顺手加入个人待办，留在当前页不打断操作流。',
      },
      {
        title: '自动升温为“🍅 去专注”',
        desc: '已加待办的作业按钮自动切换为蓝紫高亮“🍅 去专注”，点击直接跳转到待办页并自动选中番茄钟。',
      },
      {
        title: '双向完成状态实时联动',
        desc: '在待办栏勾选完成，对应同名作业自动标记为已完成；反之在作业列表勾选，待办任务同步标完，免重复操作。',
      },
      {
        title: '角标实时更新',
        desc: '底部导航栏与顶部 D1 状态栏实时反映未完成总数，支持 PWA 图标角标同步。',
      },
    ],
    highlightBadge: '双向联动 · 无缝专注',
    notes: '作业管理注重学科和截止期，待办任务注重执行过程，两者的无缝连通帮助同学们彻底告别学业拖延。',
  },
  {
    id: 6,
    section: '模块四 · FOCUS',
    title: '极简极客番茄钟与专注统计',
    subtitle: '报刊极简美学，沉浸式倒计时，专为大学自习、写作业与期末复习打造',
    points: [
      {
        title: '标准工作与休息周期',
        desc: '经典 25 分钟专注 + 5 分钟短休 + 15 分钟长休，支持快捷微调时长。',
      },
      {
        title: '当前专注任务自动装载',
        desc: '可随时切换挂载“当前要专注的任务”，倒计时结束自动提示，可一键完成该任务。',
      },
      {
        title: '沉浸音效与全屏模式',
        desc: '包含轻柔滴答提示音、时钟翻页动画与纯净背景，杜绝任何无关花哨干扰。',
      },
      {
        title: '每日番茄钟累计战报',
        desc: '记录当天已完成番茄钟个数与专注总时长，增强学业成就感与自律反馈。',
      },
    ],
    highlightBadge: '极简专注 · 战报激励',
    notes: '在待办页顶部展开番茄钟，点击“开始专注”，手机立起来即可进入沉浸自习模式。',
  },
  {
    id: 7,
    section: '模块五 · REMINDER',
    title: '全天候智能上课提醒体系',
    subtitle: '课前精准预警 + 周日晚贴心备课弹窗，再也不会错过早八或教室变更',
    points: [
      {
        title: '课前提前预警（自定义 5-30 分钟）',
        desc: '可自由设置提前 10/15/20 分钟提醒；支持 Web Notification 系统级弹窗、音频提醒及应用内浮动横幅。',
      },
      {
        title: '教室地点与带物备忘',
        desc: '提醒内容精准标注教学楼、教室门牌号与第一节课名称，减少赶课路上的焦虑。',
      },
      {
        title: '周日晚 20:00 贴心次日提醒',
        desc: '每周日晚自动弹出“新一周启航”专卡，预告周一第一堂课时间、地点及全天课程数，提醒早睡备课。',
      },
      {
        title: '静音与测试按钮',
        desc: '在设置中提供“触发模拟提醒”与“测试周日弹窗”，方便随时检验通知与音效是否生效。',
      },
    ],
    highlightBadge: '课前提醒 · 周日预报',
    notes: '首次使用请根据浏览器提示允许“通知权限”，即可在锁屏或后台收到即时上课提醒。',
  },
  {
    id: 8,
    section: '模块六 · WIDGET & CALENDAR',
    title: '桌面小组件与手机系统日历',
    subtitle: '深色高颜值今日小组件 + 苹果/安卓系统级日历 (.ics) 双向无缝融合',
    points: [
      {
        title: '今日课程深色挂件（Widget）',
        desc: '针对 OLED 屏幕优化的深黑报刊风格卡片，支持实时预览与一键导出 2x 超清 PNG 手机壁纸/小组件底图。',
      },
      {
        title: '系统日历全学期订阅/导入',
        desc: '一键生成标准 iCalendar (.ics) 文件，原生支持 iPhone 日历、华为/小米日历、Outlook 与 Google Calendar。',
      },
      {
        title: '日历桌面卡片原生联动',
        desc: '导入系统日历后，手机负一屏、桌面日历大卡片、智能手表或手环均可直接同步显示下一节课。',
      },
      {
        title: '撤销与重新生成保障',
        desc: '提供专用日历清空脚本，当课表发生重大调整时可一键清空旧日程并重新导入，杜绝日程堆叠混乱。',
      },
    ],
    highlightBadge: '桌面大卡 · 系统日历',
    notes: '在“我的 -> 手机系统日历同步”页面，点击“下载日历订阅”，在手机端选择“用日历打开”即可一秒完成全学期导入。',
  },
  {
    id: 9,
    section: '模块七 · ADMIN TERMINAL',
    title: '管理员后台终端与作业分发',
    subtitle: '班级学委与管理员的超级工具箱：命令行 CLI + 图形化作业池全员推送',
    points: [
      {
        title: '安全权限收拢',
        desc: '严格校验 admin 角色身份，普通学生端仅能勾选导入，禁止任意篡改或发布到官方作业池。',
      },
      {
        title: '官方作业池统一发布（Pool）',
        desc: '管理员发布标准作业模板，学生在“官方作业同步”弹窗按需勾选导入，自动显示“已存在·覆盖更新”标识。',
      },
      {
        title: '一键全员强制下发（Push）',
        desc: '支持执行 `hw push 课程|标题|截止` 或 GUI 一键直发，直达全班 42 名学生，智能保留已完成状态并更新时间。',
      },
      {
        title: '双模式 CLI 终端控制',
        desc: '内置类 Linux 终端，支持 `help`、`list`、`hw add`、`hw push`、`hw pool`、`clear` 等极客命令，操作行云流水。',
      },
    ],
    highlightBadge: '学委利器 · 终端智控',
    notes: '管理员点击“我的 -> 后台终端 (ROOT)”，不仅能用终端敲命令，底部还有直观的作业池图形化管理面板。',
  },
  {
    id: 10,
    section: '模块八 · CLOUD & PWA',
    title: '云端 D1 数据库与 PWA 多端支持',
    subtitle: '强健的持久化架构，多端实时漫游，离线可用，图标角标无缝推送',
    points: [
      {
        title: 'Cloudflare D1 云数据库',
        desc: '分布式轻量 SQL 存储，保障课程、作业、任务多端秒级同步，账号换机数据不丢失。',
      },
      {
        title: '全量数据备份与还原',
        desc: '支持一键导出结构化 JSON 完整备份，可随时随地快速迁移、还原或清空重置。',
      },
      {
        title: 'PWA 渐进式 Web 应用',
        desc: '支持“添加到主屏幕”，无需通过应用商店下载，获得媲美原生 App 的全屏沉浸式体验。',
      },
      {
        title: 'App Badging 图标未完成角标',
        desc: '当有未完成作业或待办任务时，桌面 App 图标自动展示红色数字角标，一目了然。',
      },
    ],
    highlightBadge: '云端存储 · 离线可用',
    notes: '建议在 Safari 或 Chrome 浏览器点击“分享/设置 -> 添加到主屏幕”，即可像原生 App 一样启动！',
  },
  {
    id: 11,
    section: '新手指南 · QUICKSTART',
    title: '五步快速上手最佳路线',
    subtitle: '从零开始配置专属课表，开启井井有条的高校学业之旅',
    points: [
      {
        title: '第 1 步：导入课表',
        desc: '进入“我的 -> PDF导入”，上传教务处课表 PDF；或在周视图空白格子点击“+”手动添加。',
      },
      {
        title: '第 2 步：开启上课提醒',
        desc: '进入“我的 -> 上课提醒”，开启课前 15 分钟提醒，并允许浏览器通知权限。',
      },
      {
        title: '第 3 步：同步系统日历',
        desc: '进入“小组件与日历”标签，一键导出 .ics 并添加到手机系统日历，让手环与手表也能播报。',
      },
      {
        title: '第 4 步：微信作业智能识别',
        desc: '班级群收到作业通知时，长按复制，打开作业页“智能粘贴”一键收录。',
      },
      {
        title: '第 5 步：加待办并开启番茄专注',
        desc: '在作业项点击“+ 待办”，随后进入待办页启动番茄钟，25分钟专注冲刺！',
      },
    ],
    highlightBadge: '5分钟快速上手',
    notes: '若遇到课表变更，随时可以在课程详情中编辑，或在数据管理中心重新导入。',
  },
  {
    id: 12,
    section: '常见问答 · FAQ',
    title: '高频问题解答与故障排查',
    subtitle: '针对单双周、群消息识别、手机离线等常见场景的官方解答',
    points: [
      {
        title: 'Q1: 单双周课程如何设置？',
        desc: 'A: 在编辑课程时，“周次”输入“1-16单周”或“2-16双周”，系统会自动在非当前周淡化显示。',
      },
      {
        title: 'Q2: 群消息包含多张图片或表情包能识别吗？',
        desc: 'A: 能。系统已内置强大的媒体过滤引擎，【表情】、[图片]等标签会被全部清洗，不影响作业提取。',
      },
      {
        title: 'Q3: 换手机或者清除浏览器缓存后，数据还在吗？',
        desc: 'A: 在。所有数据均实时保存在云端 D1 数据库中，只要使用原账号登录即可全量恢复。',
      },
      {
        title: 'Q4: 如何将小组件放在手机主屏幕上？',
        desc: 'A: 在“小组件”页点击“保存高清卡片图”，或将生成的系统日历卡片直接添加到手机负一屏。',
      },
    ],
    highlightBadge: '答疑解惑',
    notes: '若有更多定制需求或班级协同建议，可在 GitHub 或终端管理员界面提交反馈。',
  },
  {
    id: 13,
    section: '结语 · THE END',
    title: '致简致美 · 伴你学业有成',
    subtitle: '让每一节课心中有数，让每一份作业从容应对，开启高效自律大学生活',
    points: [
      {
        title: '设计理念',
        desc: 'Swiss International Typographic Style · 拒绝繁复花哨，恪守克制与高效。',
      },
      {
        title: '开源与自由',
        desc: '数据完全归属于您自己，随时支持导出与离线使用，无任何广告插播与冗余推送。',
      },
      {
        title: '持续演进',
        desc: '感谢各位同学与老师的建议！掌上课表将持续打磨智能算法与流畅体验。',
      },
    ],
    highlightBadge: 'Handheld Timetable v4.5',
    notes: '祝各位同学考试高分通过，学业进步，每一天都充实且自信！',
  },
];

/**
 * Generates and downloads a real PowerPoint (.pptx) presentation file
 * using pptxgenjs with high visual fidelity, custom editorial color themes,
 * shapes, titles, icons, and speaker notes.
 */
export async function exportToPptxFile(slides: SlideData[] = PRESENTATION_SLIDES): Promise<void> {
  const pptx = new pptxgen();

  // Set presentation properties
  pptx.layout = 'LAYOUT_16x9';
  pptx.title = '掌上课表产品使用说明与功能全景';
  pptx.author = '掌上课表 研发团队';
  pptx.company = 'Handheld Timetable';
  pptx.subject = '高校日程与学业管理系统完整使用手册';

  // Define brand colors (Swiss Editorial dark/newsprint palette)
  const BG_COLOR = '1D1F24';
  const CARD_BG = '26282E';
  const TEXT_WHITE = 'E9E4D8';
  const TEXT_MUTED = '9A978E';
  const ACCENT_BLUE = '6B7CFF';
  const BORDER_COLOR = '3A3D46';
  const ACCENT_CORAL = 'FF6B57';

  slides.forEach((slideItem, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: BG_COLOR };

    // Slide Header Top Tag
    slide.addText(slideItem.section.toUpperCase(), {
      x: 0.8,
      y: 0.5,
      w: 8.0,
      h: 0.35,
      fontSize: 11,
      fontFace: 'Arial',
      color: ACCENT_BLUE,
      bold: true,
      charSpacing: 2,
    });

    // Main Title
    slide.addText(slideItem.title, {
      x: 0.8,
      y: 0.85,
      w: 11.5,
      h: 0.75,
      fontSize: 26,
      fontFace: 'Georgia',
      color: TEXT_WHITE,
      bold: true,
    });

    // Subtitle
    slide.addText(slideItem.subtitle, {
      x: 0.8,
      y: 1.6,
      w: 11.5,
      h: 0.5,
      fontSize: 13,
      fontFace: 'Arial',
      color: TEXT_MUTED,
    });

    // Top Right Badge if exists
    if (slideItem.highlightBadge) {
      slide.addText(slideItem.highlightBadge, {
        x: 10.0,
        y: 0.5,
        w: 2.5,
        h: 0.4,
        fontSize: 10,
        fontFace: 'Arial',
        color: 'FFFFFF',
        bold: true,
        align: 'center',
        fill: { color: ACCENT_BLUE },
      });
    }

    // Divider Line
    slide.addShape(pptx.ShapeType.line, {
      x: 0.8,
      y: 2.15,
      w: 11.7,
      h: 0,
      line: { color: BORDER_COLOR, width: 1 },
    });

    // Content Cards Grid (2 columns or 4 grid cards)
    const cardW = 5.65;
    const cardH = 1.95;
    const startX = 0.8;
    const startY = 2.4;
    const gapX = 0.4;
    const gapY = 0.3;

    slideItem.points.forEach((point, pIdx) => {
      const col = pIdx % 2;
      const row = Math.floor(pIdx / 2);
      const posX = startX + col * (cardW + gapX);
      const posY = startY + row * (cardH + gapY);

      // Card Background Box
      slide.addShape(pptx.ShapeType.rect, {
        x: posX,
        y: posY,
        w: cardW,
        h: cardH,
        fill: { color: CARD_BG },
        line: { color: BORDER_COLOR, width: 1 },
      });

      // Card Header Left Pill Indicator
      slide.addShape(pptx.ShapeType.rect, {
        x: posX,
        y: posY,
        w: 0.12,
        h: cardH,
        fill: { color: pIdx % 2 === 0 ? ACCENT_BLUE : ACCENT_CORAL },
        line: { color: 'transparent' },
      });

      // Card Title
      slide.addText(point.title, {
        x: posX + 0.3,
        y: posY + 0.2,
        w: cardW - 0.5,
        h: 0.35,
        fontSize: 14,
        fontFace: 'Arial',
        color: TEXT_WHITE,
        bold: true,
      });

      // Card Description
      slide.addText(point.desc, {
        x: posX + 0.3,
        y: posY + 0.6,
        w: cardW - 0.5,
        h: cardH - 0.75,
        fontSize: 11,
        fontFace: 'Arial',
        color: TEXT_MUTED,
        lineSpacing: 16,
      });
    });

    // Footer Info
    slide.addText('掌上课表 · Swiss Editorial v4.5 · 官方产品说明书', {
      x: 0.8,
      y: 6.85,
      w: 8.0,
      h: 0.3,
      fontSize: 9,
      fontFace: 'Arial',
      color: '666666',
    });

    slide.addText(`PAGE ${index + 1} / ${slides.length}`, {
      x: 10.5,
      y: 6.85,
      w: 2.0,
      h: 0.3,
      fontSize: 9,
      fontFace: 'Arial',
      color: '666666',
      align: 'right',
    });

    // Add Speaker Notes
    if (slideItem.notes) {
      slide.addNotes(slideItem.notes);
    }
  });

  // Write file to user's browser download
  await pptx.writeFile({ fileName: `掌上课表-产品使用说明与功能全景.pptx` });
}

export function exportToMarkdownOutline(slides: SlideData[] = PRESENTATION_SLIDES): string {
  let md = `# 掌上课表 (Swiss Editorial) · 产品使用说明书与全景演示文稿\n\n`;
  md += `> 版本：v4.5 官方旗舰版 | 格式：16:9 演示文稿幻灯片大纲\n\n---\n\n`;

  slides.forEach((slide) => {
    md += `## Slide ${slide.id}: [${slide.section}] ${slide.title}\n`;
    md += `**副标题**：${slide.subtitle}\n\n`;
    if (slide.highlightBadge) {
      md += `> 🏷️ 核心标签：\`${slide.highlightBadge}\`\n\n`;
    }
    md += `### 核心要点：\n`;
    slide.points.forEach((pt, i) => {
      md += `${i + 1}. **${pt.title}**：${pt.desc}\n`;
    });
    if (slide.notes) {
      md += `\n💬 **演讲者备注**：${slide.notes}\n`;
    }
    md += `\n---\n\n`;
  });

  return md;
}
