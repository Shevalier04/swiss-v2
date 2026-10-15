/**
 * Utility for parsing single-line quick homework input and class group notice messages
 * Supports intelligent WeChat/QQ group notice parsing, multi-line course context,
 * common college course alias recognition, noise filtering, and natural language deadline extraction.
 */

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * 常见高校课程简称/别名映射字典，用于将群消息中的口语化简称映射到标准课程库
 */
/**
 * 常见高校课程简称/别名映射字典，用于将群消息中的口语化简称映射到标准课程库
 */
export const COURSE_ALIASES: Record<string, string[]> = {
  '高等数学': ['高数', '微积分', '高等数学A', '高等数学B', '高数上', '高数下', '数分', '数学分析'],
  '线性代数': ['线代', '高代', '高等代数', '线性代数与空间解析几何', '线性代数与几何'],
  '概率论与数理统计': ['概率论', '概统', '数理统计', '概率与数理统计'],
  '大学英语': ['大英', '英语', '视听说', '大学英语一', '大学英语二', '大学英语三', '大学英语四', '英语听说', '英语读写', '综合英语', 'English'],
  '大学物理': ['大物', '大学物理实验', '物理实验', '大学物理A', '大学物理B', '大学物理I', '大学物理II'],
  '计算机网络': ['计网', '网络', '计算机网络原理', '网络技术', '计算机网络与通信', '网原'],
  '计算机组成原理': ['计组', '组原', '计算机体系结构', '体系结构', '组成原理'],
  '操作系统': ['OS', '操作系统原理', '操作系'],
  '数据结构': ['DS', '数据结构与算法', '算法与数据结构', '算法设计与分析', '算法'],
  '数据库概论': ['数据库', '数据库系统', '数据库原理', 'SQL', 'DB', '数据库系统概论'],
  '软件工程导论': ['软工', '软件工程', '软工导论', '软件工程概论'],
  'Web编程技术': ['Web', 'Web编程', '前端', 'Web前端', '网页制作', 'JavaScript', 'HTML', 'Web技术', '网页设计'],
  '毛泽东思想和中国特色社会主义理论体系概论': ['毛概', '毛特', '毛中特'],
  '马克思主义基本原理': ['马原', '马克思主义原理'],
  '中国近现代史纲要': ['近代史', '史纲', '纲要', '现代史'],
  '思想道德与法治': ['思修', '道法', '思想道德修养与法律基础'],
  '离散数学': ['离散'],
  '数字逻辑': ['数电', '数字电路', '数字逻辑设计', '数字逻辑电路'],
  '面向对象程序设计': ['Java', 'C++', 'Python', '面向对象', 'OOP', '程序设计'],
};

/**
 * 微信/QQ等群聊消息中常见的多媒体占位符与表情标签
 */
export const CHAT_MEDIA_KEYWORDS = new Set([
  '表情',
  '动画表情',
  '表情包',
  '图片',
  '语音',
  '视频',
  '文件',
  '红包',
  '微信红包',
  'QQ红包',
  '聊天记录',
  '小程序',
  '位置',
  '链接',
  '名片',
  '卡片消息',
  '合并转发',
  '图文',
  '音乐',
  '抱拳',
  '强',
  '弱',
  '握手',
  '胜利',
  '微笑',
  '呲牙',
  '偷笑',
  '玫瑰',
  '爱心',
  '心碎',
  '点赞',
  '加油',
  '庆祝',
  'OK',
  'NO',
  '收到',
  '好的',
  '1',
  '打卡',
]);

/**
 * 判断文本是否仅为一个聊天表情或媒体占位符（如 [表情]、[图片]、[动画表情] 或 【表情】）
 */
export function isChatMediaTag(text: string): boolean {
  if (!text) return false;
  const clean = text.trim().replace(/^[【\[\(（]|[\)）\]】]$/g, '').trim();
  return CHAT_MEDIA_KEYWORDS.has(clean) || CHAT_MEDIA_KEYWORDS.has(text.trim());
}

/**
 * 彻底过滤群聊复制文本中的各类表情占位符、媒体标签与现代 Emoji
 * 支持：
 * - [表情]、[动画表情]、[表情包]、[图片]、[语音]、[视频]、[红包] 等
 * - 【表情】、【动画表情】、【图片】、【文件】 等中文方括号形式
 * - 微信/QQ括号表情 [微笑]、[呲牙]、[抱拳]、[强]、[玫瑰]、[OK] 等
 * - Unicode Pictographic Emoji (👍、👏、🎉 等)
 */
export function removeChatMediaAndEmojis(text: string): string {
  if (!text) return '';
  return text
    // 移除各类常见多媒体和系统提示占位符：[表情]、[图片]、[动画表情]、[语音]、[视频] 等及【表情】等
    .replace(/[\[【](?:表情|动画表情|表情包|图片|语音|视频|红包|微信红包|QQ红包|聊天记录|文件|卡片消息|位置|链接|小程序|合并转发|图文|音乐)[\]】]/gi, ' ')
    // 移除微信/QQ中括号形式的常见表情名，如 [微笑]、[呲牙]、[抱拳]、[强]、[玫瑰]、[OK]、[庆祝] 等，及【抱拳】、【强】
    .replace(/[\[【](?:微笑|撇嘴|色|发呆|得意|流泪|害羞|闭嘴|睡|大哭|尴尬|发怒|调皮|呲牙|惊讶|难过|酷|冷汗|抓狂|吐|偷笑|愉快|白眼|傲慢|饥饿|困|惊恐|流汗|憨笑|悠闲|奋斗|咒骂|疑问|嘘|晕|折磨|衰|骷髅|敲打|再见|擦汗|抠鼻|鼓掌|糗大了|坏笑|左哼哼|右哼哼|哈欠|鄙视|委屈|快哭了|阴险|亲亲|吓|可怜|菜刀|西瓜|啤酒|篮球|乒乓|咖啡|饭|猪头|玫瑰|凋谢|嘴唇|爱心|心碎|蛋糕|闪电|炸弹|刀|足球|瓢虫|便便|月亮|太阳|礼物|拥抱|强|弱|握手|胜利|抱拳|勾引|拳头|差劲|爱你|NO|OK|爱情|飞吻|跳跳|发抖|怄火|转圈|磕头|回头|跳绳|挥手|激动|街舞|献吻|左太极|右太极|双喜|鞭炮|灯笼|发财|K歌|购物|邮件|互粉|禄|拾|天使|生病|脏话|打小人|喝彩|点赞|加油|庆祝|给力|围观|威武)[\]】]/gi, ' ')
    // 移除各类现代 Unicode Emoji 表情字符
    .replace(/\p{Extended_Pictographic}/gu, ' ');
}

/**
 * 解析课程名称别名或候选库，精准映射到学生现有课表或最合适课程名
 */
export function resolveCourseName(rawCourse: string, courseCandidates: string[] = []): string {
  const clean = (rawCourse || '').trim().replace(/^[【\[\(（]|[\)）\]】]$/g, '').trim();
  if (!clean || isChatMediaTag(clean)) {
    return courseCandidates[0] || '常规课程';
  }

  // 1. 完全或前缀匹配现有课表课程
  const exactInCandidates = courseCandidates.find(
    c => c.toLowerCase() === clean.toLowerCase() || c.toLowerCase().includes(clean.toLowerCase())
  );
  if (exactInCandidates) {
    return exactInCandidates;
  }

  // 2. 通过别名字典反查匹配学生课表
  for (const [canonical, aliases] of Object.entries(COURSE_ALIASES)) {
    const isMatchedAlias =
      clean === canonical ||
      aliases.some(alias => clean.toLowerCase() === alias.toLowerCase() || clean.includes(alias));

    if (isMatchedAlias) {
      // 检查学生课表中是否有该标准课程名或其别名
      const matchedInStudent = courseCandidates.find(
        c =>
          c.includes(canonical) ||
          canonical.includes(c) ||
          aliases.some(alias => c.includes(alias))
      );
      if (matchedInStudent) {
        return matchedInStudent;
      }
      return canonical;
    }
  }

  // 3. 检查反向包含：如果学生课表某项包含这个词（例如 clean='网络'，课表有'计算机网络'）
  const partial = courseCandidates.find(c => c.includes(clean) || clean.includes(c));
  if (partial) {
    return partial;
  }

  return clean;
}

/**
 * 智能清洗作业内容标题：
 * 1. 过滤聊天表情包与媒体占位符（如 【表情】、[表情]、[图片] 等，表情绝非作业内容）
 * 2. 过滤开头的冒号、连字符等连接符号
 * 3. 剥离前缀 generic 词汇（如 "作业"、"大作业"、"课后作业"）
 * 4. 若无实质具体内容（例如仅输入了 "界面设计作业" 或带表情 "界面设计作业 【表情】"），返回空字符串 ""（无需填）
 */
export function cleanHomeworkTitle(title: string): string {
  let t = (title || '').trim();

  // 1. 过滤聊天表情符号与媒体占位符
  t = removeChatMediaAndEmojis(t).trim();

  // 2. 移除开头的标点符号与连接符
  t = t.replace(/^[:：\-\s\—_、,，~#*]+/, '').trim();
  t = t.replace(/[:：\-\s\—_、,，~#*]+$/, '').trim();

  // 3. 移除开头的冗余"作业/大作业"引导词，例如 "作业 完成原型设计" -> "完成原型设计"
  t = t.replace(/^(?:大?作业|课后作业|随堂作业|随堂任务|小作业|实验作业|期末大作业|课程设计|本次作业|今日作业|任务)[:：\s]*/i, '').trim();

  // 纯泛化通用词清单：若剩余内容仅为这些词，则判定为没有具体作业内容，返回空字符串
  const genericWords = new Set([
    '',
    '作业',
    '大作业',
    '课后作业',
    '随堂作业',
    '随堂任务',
    '小作业',
    '任务',
    '今日作业',
    '本次作业',
    '实验',
    '实验作业',
    '设计',
    '课程设计',
    '表情',
    '动画表情',
    '表情包',
    '图片',
    '语音',
    '视频',
    '收到',
    '收到回复',
    '打卡',
  ]);

  if (genericWords.has(t)) {
    return '';
  }

  // 4. 去除可能残留的任意方括号标签后检查是否还有实质文本
  const strippedBrackets = t
    .replace(/[\[【][^\]】]*[\]】]/g, '')
    .replace(/[\s\-_—~.,，。！!？?~、:：]/g, '')
    .trim();

  if (!strippedBrackets || genericWords.has(strippedBrackets)) {
    return '';
  }

  return t;
}

/**
 * 智能解析自然语言日期为 YYYY-MM-DD
 * 支持：
 * - @今天、@明天、@后天、@大后天、@今晚、@明晚
 * - @周X、@星期X、@礼拜X、@本周X、@下周X
 * - @周末、@本周末、@下周末
 * - @N天后 (如 3天后)
 * - @M月D日、@M.D、@M-D、@M/D、@X号、@X日
 * - @YYYY-MM-DD、@YYYY.MM.DD、@YYYY年M月D日
 * - 截止时间关键词包含的自然文本 (如 "周五前交", "明天课前", "10月25日23:59前")
 */
export function parseNaturalDate(raw: string, baseDate = new Date()): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();

  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const date = baseDate.getDate();

  // 1. 今天 / 今晚
  if (s.includes('今天') || s.includes('今晚') || s === 'today') {
    return formatDate(baseDate);
  }

  // 2. 明天 / 明晚 / 次日
  if (s.includes('明天') || s.includes('明晚') || s.includes('次日') || s === 'tomorrow') {
    const d = new Date(year, month, date + 1);
    return formatDate(d);
  }

  // 3. 后天
  if (s.includes('后天')) {
    const d = new Date(year, month, date + 2);
    return formatDate(d);
  }

  // 4. 大后天
  if (s.includes('大后天')) {
    const d = new Date(year, month, date + 3);
    return formatDate(d);
  }

  // 5. N天后 (如 3天后)
  const daysLaterMatch = s.match(/(\d+)\s*天后/);
  if (daysLaterMatch) {
    const addDays = parseInt(daysLaterMatch[1], 10);
    const d = new Date(year, month, date + addDays);
    return formatDate(d);
  }

  // 6. 周末 / 本周末 / 下周末
  if (s.includes('下周末')) {
    const curWeekday = baseDate.getDay() === 0 ? 7 : baseDate.getDay();
    const diff = 7 - curWeekday + 7;
    const d = new Date(year, month, date + diff);
    return formatDate(d);
  }
  if (s.includes('周末') || s.includes('本周末')) {
    const curWeekday = baseDate.getDay() === 0 ? 7 : baseDate.getDay();
    const diff = 7 - curWeekday;
    const d = new Date(year, month, date + diff);
    return formatDate(d);
  }

  // 7. 周几 / 星期几 / 礼拜几 (含 下周X / 本周X)
  const isNextWeek = s.includes('下周') || s.includes('下星期') || s.includes('下礼拜');
  const weekdayMap: Record<string, number> = {
    '一': 1, '1': 1,
    '二': 2, '2': 2,
    '三': 3, '3': 3,
    '四': 4, '4': 4,
    '五': 5, '5': 5,
    '六': 6, '6': 6,
    '日': 7, '天': 7, '7': 7, '0': 7,
  };

  const weekMatch = s.match(/(?:下周|下星期|下礼拜|本周|周|星期|礼拜)([一二三四五六日天1234567])/);
  if (weekMatch) {
    const targetWeekday = weekdayMap[weekMatch[1]];
    if (targetWeekday) {
      const curWeekday = baseDate.getDay() === 0 ? 7 : baseDate.getDay();
      let diff = targetWeekday - curWeekday;
      if (isNextWeek) {
        diff = (targetWeekday - curWeekday + 7);
      } else if (diff < 0) {
        // 如果提到的星期几已经过了，默认指下周该天
        diff += 7;
      }
      const d = new Date(year, month, date + diff);
      return formatDate(d);
    }
  }

  // 8. 完整日期 YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD, YYYY年MM月DD日
  const fullDateMatch = s.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})[日号]?/);
  if (fullDateMatch) {
    const y = parseInt(fullDateMatch[1], 10);
    const m = parseInt(fullDateMatch[2], 10);
    const dayVal = parseInt(fullDateMatch[3], 10);
    return `${y}-${pad2(m)}-${pad2(dayVal)}`;
  }

  // 9. 短日期 MM-DD, M.D, M月D日, M/D
  const shortDateMatch = s.match(/(\d{1,2})[-/.月](\d{1,2})[日号]?/);
  if (shortDateMatch) {
    const m = parseInt(shortDateMatch[1], 10);
    const dayVal = parseInt(shortDateMatch[2], 10);
    return `${year}-${pad2(m)}-${pad2(dayVal)}`;
  }

  // 10. 单独的 "X号" 或 "X日" (如 "25号前", "18日截止")
  const dayOnlyMatch = s.match(/(\d{1,2})\s*[号日]/);
  if (dayOnlyMatch) {
    const dayVal = parseInt(dayOnlyMatch[1], 10);
    if (dayVal >= 1 && dayVal <= 31) {
      // 若该号数小于当前日期，推断为下个月的该号数
      let targetMonth = month;
      let targetYear = year;
      if (dayVal < date) {
        targetMonth += 1;
        if (targetMonth > 11) {
          targetMonth = 0;
          targetYear += 1;
        }
      }
      return `${targetYear}-${pad2(targetMonth + 1)}-${pad2(dayVal)}`;
    }
  }

  return null;
}

export interface ParsedQuickHomework {
  course: string;
  title: string;
  due?: string;
  rawDueText?: string;
}

/**
 * 从文本中提取截止时间，并返回净化后的标题和解析出的日期
 * 完整覆盖：日期 + 时间修饰词（如 晚上/下午）+ 具体钟点（如 21:30、21：30、9点半）+ 截止动作词（如 截止、前交）
 * 避免将 "晚上21:30截止" 等残留时间作为作业内容输出
 */
export function extractDeadlineFromText(text: string): {
  cleanText: string;
  due?: string;
  rawDueText?: string;
} {
  let remaining = text;
  let parsedDue: string | undefined = undefined;
  let rawDueText: string | undefined = undefined;

  // 1. 优先提取显式 @截止时间 (如 @明天, @周五, @10-25, @10月21日)
  const atMatch = remaining.match(/@([^\s@，,。]+)/);
  if (atMatch) {
    rawDueText = atMatch[1];
    const d = parseNaturalDate(rawDueText);
    if (d) {
      parsedDue = d;
    }
    remaining = remaining.replace(atMatch[0], ' ').trim();
  }

  // 2. 检查形如 "截止时间：..."、"截止：..."、"截至：..."、"提交截止：..." 的显式前缀声明
  if (!parsedDue) {
    const deadlineKeywordMatch = remaining.match(
      /(?:截止时间|截止日期|提交截止|交卷时间|截止至|截止到|截至|截止)[：:\s]*([^\s，,。]+(?:\s+[^\s，,。]+)?)/i
    );
    if (deadlineKeywordMatch) {
      const candidateStr = deadlineKeywordMatch[1];
      const d = parseNaturalDate(candidateStr);
      if (d) {
        parsedDue = d;
        rawDueText = candidateStr;
        remaining = remaining.replace(deadlineKeywordMatch[0], ' ').trim();
      }
    }
  }

  // 3. 检查复合自然语言：日期 + [时间段修饰] + [具体钟点] + [截止/前交后缀]
  // 例如："10月21日晚上21:30截止"、"10月21日 晚上21:30 截止"、"明天晚上21:30前"、"周五晚上22点交"
  if (!parsedDue) {
    const fullDeadlineRegex = /(?:在|于)?((?:\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日号]?|\d{1,2}月\d{1,2}[日号]?|\d{1,2}[-/.]\d{1,2}[日号]?|\d{1,2}[号日]|今天|今晚|明天|明晚|后天|大后天|次日|下周[一二三四五六日天1234567]|本周[一二三四五六日天1234567]|周[一二三四五六日天1234567]|星期[一二三四五六日天1234567]|礼拜[一二三四五六日天1234567]|本周末|周末|下周末)\s*(?:[早晨上午中午下午傍晚夜间凌晨半夜晚上晚]+\s*)?(?:\d{1,2}\s*[:：]\s*\d{2}(?::\d{2})?|\d{1,2}\s*点\s*(?:半|\d{1,2}\s*分?)?|\d{1,2}\s*时\s*(?:半|\d{1,2}\s*分?)?)?\s*(?:前交|交齐|前提交|提交|前完成|截止|交卷|上交|收齐|前|晚|底)?)/i;

    const fullMatch = remaining.match(fullDeadlineRegex);
    if (fullMatch && fullMatch[1]) {
      const datePartStr = fullMatch[1];
      const d = parseNaturalDate(datePartStr);
      if (d) {
        parsedDue = d;
        rawDueText = fullMatch[0].trim();
        remaining = remaining.replace(fullMatch[0], ' ').trim();
      }
    }
  }

  // 4. 清理残留的时间碎片与截止动作词，防止其作为“作业内容”泄露（如 "晚上21:30"、"上21:30"、"截止"、"前交"）
  remaining = remaining
    // 清理 "晚上21:30截止", "21:30", "晚上21：30", "上21:30截止", "21:30截止"
    .replace(/(?:[早晨上午中午下午傍晚夜间凌晨半夜晚上晚]|上)?\s*\d{1,2}\s*[:：]\s*\d{2}(?::\d{2})?\s*(?:截止|截至|前交|交齐|前提交|提交|交卷|上交|收齐|前)?/gi, ' ')
    // 清理 "晚上9点半", "下午5点", "晚22点"
    .replace(/(?:[早晨上午中午下午傍晚夜间凌晨半夜晚上晚]|上)?\s*\d{1,2}\s*点\s*(?:半|\d{1,2}\s*分?)?\s*(?:截止|截至|前交|交齐|前提交|提交|交卷|上交|收齐|前)?/gi, ' ')
    // 清理孤立的 "晚上", "上午", "下午", "中午", "凌晨"
    .replace(/(?:\s|^)(?:早上|早晨|上午|中午|下午|傍晚|夜间|凌晨|半夜|晚上|今晚|明晚)(?=\s|$|[，,。])/g, ' ')
    // 清理孤立的 "截止", "截至", "前交", "截止时间"
    .replace(/(?:\s|^)(?:截止时间|截止日期|提交截止|交卷时间|截止至|截止到|截至|截止|前交|交齐|前提交|前完成|交卷|上交|收齐)(?=\s|$|[，,。])/g, ' ')
    // 清除首尾标点空白
    .replace(/[，,;；、\s\-—_]+$/, '')
    .replace(/^[，,;；、\s\-—_]+/, '')
    .trim();

  return {
    cleanText: remaining,
    due: parsedDue,
    rawDueText,
  };
}

/**
 * 解析单行极速录入文本
 * 格式如:
 * "界面设计作业 10月21日晚上21:30截止"
 * "高数 课后习题P32 @明天"
 * "大学英语 Unit2单词抄写 @周日"
 * "数据库概论: ER图设计 @2026-10-25"
 * "Web编程技术 大作业项目"
 * "计网 实验报告 周五前交"
 */
export function parseQuickHomeworkLine(
  rawLine: string,
  courseCandidates: string[] = []
): ParsedQuickHomework | null {
  let line = (rawLine || '').trim();
  if (!line) return null;

  // 0. 移除聊天表情与媒体占位符（例如 "界面设计作业 10月21日晚上21:30截止 【表情】" -> "界面设计作业 10月21日晚上21:30截止"）
  line = removeChatMediaAndEmojis(line).trim();
  if (!line) return null;

  // 1. 提取时间
  const { cleanText, due, rawDueText } = extractDeadlineFromText(line);
  let remaining = cleanText.trim();

  // 2. 提取括号课程如 【高数】、【Web编程】、[大学英语]、（界面设计）
  const bracketMatch = remaining.match(/^[【\[\(（]([^】\]\)）]+)[】\]\)）]\s*(.*)$/);
  if (bracketMatch) {
    const rawC = bracketMatch[1].trim();
    if (!isChatMediaTag(rawC)) {
      const resolvedC = resolveCourseName(rawC, courseCandidates);
      const content = bracketMatch[2].trim();
      const title = cleanHomeworkTitle(content);
      return {
        course: resolvedC,
        title, // 若无作业内容则返回空字符串 ""
        due,
        rawDueText,
      };
    } else {
      // 若开头的方括号是 【表情】 或 【图片】，将其去除，继续向后匹配真实课程
      remaining = bracketMatch[2].trim();
    }
  }

  // 3. 检查已知候选课程库前缀（优先长名字匹配，如 "界面设计"、"计算机网络"）
  const sortedCandidates = [...courseCandidates].sort((a, b) => b.length - a.length);
  for (const c of sortedCandidates) {
    if (remaining.startsWith(c)) {
      const rest = remaining.slice(c.length);
      const title = cleanHomeworkTitle(rest);
      return {
        course: c,
        title, // 若仅输入了 "界面设计作业"，此处 title 清洗后为空字符串 ""
        due,
        rawDueText,
      };
    }
  }

  // 4. 检查常见别名匹配前缀（如以 "高数"、"计网"、"线代" 开头）
  for (const [canonical, aliases] of Object.entries(COURSE_ALIASES)) {
    const allNames = [canonical, ...aliases].sort((a, b) => b.length - a.length);
    for (const name of allNames) {
      if (remaining.startsWith(name)) {
        const rest = remaining.slice(name.length);
        const resolvedC = resolveCourseName(name, courseCandidates);
        const title = cleanHomeworkTitle(rest);
        return {
          course: resolvedC,
          title,
          due,
          rawDueText,
        };
      }
    }
  }

  // 5. 检查带有 "XXX作业"、"XXX大作业"、"XXX课后作业" 后缀的未登记课程
  const courseSuffixMatch = remaining.match(
    /^([^\s:：]{2,15}?)(?:大?作业|课后作业|随堂作业|课程设计|实验)[:：\s]*(.*)$/
  );
  if (courseSuffixMatch) {
    const rawC = courseSuffixMatch[1].trim();
    if (!isChatMediaTag(rawC)) {
      const resolvedC = resolveCourseName(rawC, courseCandidates);
      const rawRest = courseSuffixMatch[2].trim();
      const title = cleanHomeworkTitle(rawRest);
      return {
        course: resolvedC,
        title,
        due,
        rawDueText,
      };
    }
  }

  // 6. 检查冒号分隔 (如 "高数：课后习题P32" 或 "科目：高等数学 作业：课后习题")
  const colonParts = remaining.split(/[:：]/);
  if (colonParts.length >= 2 && colonParts[0].trim().length <= 15) {
    const rawCourse = colonParts[0].trim().replace(/^(科目|课程|课程名称|学科)/, '').trim();
    if (!isChatMediaTag(rawCourse)) {
      const resolvedCourse = resolveCourseName(rawCourse || colonParts[0].trim(), courseCandidates);
      const rawTitle = colonParts.slice(1).join(':').replace(/^(作业|内容|任务)[：:\s]*/, '').trim();
      const title = cleanHomeworkTitle(rawTitle);
      return {
        course: resolvedCourse || (courseCandidates[0] || '常规课程'),
        title,
        due,
        rawDueText,
      };
    }
  }

  // 7. 按空格拆分首词作为课程名 (如 "高数 课后习题P32")
  const spaceParts = remaining.split(/\s+/);
  if (spaceParts.length >= 2) {
    const potentialCourse = spaceParts[0].trim();
    if (!isChatMediaTag(potentialCourse)) {
      const resolvedCourse = resolveCourseName(potentialCourse, courseCandidates);
      const rawTitle = spaceParts.slice(1).join(' ').trim();
      const title = cleanHomeworkTitle(rawTitle);
      return {
        course: resolvedCourse,
        title,
        due,
        rawDueText,
      };
    }
  }

  // 8. 仅剩单独一个词或空，视为作业内容（若为泛化通用词或表情占位符则为空）
  const finalTitle = cleanHomeworkTitle(remaining);
  return {
    course: courseCandidates[0] || '常规课程',
    title: finalTitle,
    due,
    rawDueText,
  };
}

export interface ParsedGroupAssignmentItem {
  id: string;
  course: string;
  title: string;
  due?: string;
  rawText: string;
  selected: boolean;
  matchedFromCourseTable?: boolean;
}

/**
 * 判断一行是否为课程分组大标题（例如 "【高等数学】" 或 "计算机网络："）
 */
function isCourseSectionHeader(line: string, courseCandidates: string[] = []): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // 过滤纯表情、多媒体标签或表情包行
  if (
    isChatMediaTag(trimmed) ||
    trimmed.match(/^[\[【](?:表情|动画表情|表情包|图片|语音|视频|红包|微信红包|QQ红包|聊天记录|文件|卡片消息|位置|链接|小程序|合并转发|图文|音乐)[\]】]$/i) ||
    !removeChatMediaAndEmojis(trimmed).replace(/[\s\-_—~.,，。！!？?~、:：#*]+/g, '')
  ) {
    return null;
  }

  // 1. 【高数】、[大学英语]、(计算机网络) 单独占一行
  const bracketMatch = trimmed.match(/^[【\[\(（]([^】\]\)）]+)[】\]\)）][:：\s]*$/);
  if (bracketMatch) {
    const c = bracketMatch[1].trim();
    if (isChatMediaTag(c)) return null;
    return resolveCourseName(c, courseCandidates);
  }

  // 2. "科目：高等数学" 或 "课程：计算机网络"
  const prefixMatch = trimmed.match(/^(?:科目|课程|学科)[：:\s]+([^:：\s]+)\s*$/);
  if (prefixMatch) {
    return resolveCourseName(prefixMatch[1].trim(), courseCandidates);
  }

  // 3. 课程名后跟冒号独占一行，如 "高等数学：" 或 "计网:"
  const colonHeaderMatch = trimmed.match(/^([^:：\s]{2,12})[:：]\s*$/);
  if (colonHeaderMatch) {
    return resolveCourseName(colonHeaderMatch[1].trim(), courseCandidates);
  }

  // 4. 单独一个纯课程名（且没有作业动词如“做”、“交”、“背”、“写”、“习题”、“P\d+”）
  if (
    trimmed.length <= 10 &&
    !trimmed.match(/[做交背写读查报预复练习题pP\d@]/) &&
    (courseCandidates.some(c => c === trimmed) ||
      Object.keys(COURSE_ALIASES).some(
        c => c === trimmed || COURSE_ALIASES[c].includes(trimmed)
      ))
  ) {
    return resolveCourseName(trimmed, courseCandidates);
  }

  return null;
}

/**
 * 判断是否为微信/QQ群聊元数据或寒暄杂质行（如发信人时间戳、@所有人、表情包等）
 */
function isChatNoiseLine(line: string): boolean {
  const s = line.trim();
  if (!s) return true;

  // 1. 发信人昵称与时间戳行，例如:
  // "学委-张三 2026/10/15 14:30:25"
  // "李老师 10:20:15"
  // "班长(123456789) 12:00"
  // "张三 2026-10-15 12:00:00"
  if (
    s.match(/^.{1,25}?\s*(?:\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日号]?\s*)?\d{1,2}:\d{2}(?::\d{2})?$/) ||
    s.match(/^\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日号]?\s+\d{1,2}:\d{2}(?::\d{2})?\s+.{1,25}$/)
  ) {
    return true;
  }

  // 2. QQ/微信系统媒体提示与表情占位符独占一行，如 [表情]、[图片]、[动画表情]、[文件]、[语音]、[视频]、[红包] 以及 【表情】、【图片】 等
  if (
    isChatMediaTag(s) ||
    s.match(/^[\[【](?:表情|动画表情|表情包|图片|语音|视频|红包|微信红包|QQ红包|聊天记录|文件|卡片消息|位置|链接|小程序|合并转发|图文|音乐)[\]】]$/i) ||
    s.match(/^\[(?:图片|语音|视频|红包|动画表情|聊天记录|文件|卡片消息|位置|QQ红包)\]$/i)
  ) {
    return true;
  }

  // 3. 检查整行是否仅由表情包标签、括号表情或 Unicode Emoji 及标点符号组成（例如 "【表情】"、"[表情][表情]"、"👍👍"、"[抱拳]"）
  const strippedNoise = removeChatMediaAndEmojis(s)
    .replace(/[\[【][^\]】]{1,6}[\]】]/g, '')
    .replace(/[\s\-_—~.,，。！!？?~、:：#*]+/g, '');

  if (!strippedNoise) {
    return true;
  }

  // 4. @所有人、@全体成员、@all
  if (s.match(/^[@＠](?:所有人|全体成员|all|ALL|全部成员)\s*$/i)) {
    return true;
  }

  // 5. 群公告开头或结尾常见寒暄无用行
  if (
    s.match(/^(今日作业|本周作业|作业通知|各科作业|作业汇总|大家记得交作业|收到请回复|重要通知|温馨提示|作业布置|各位同学|同学们好|大家好|通知)[!！:：\s]*$/i) ||
    s.match(/.*(作业通知|作业汇总|今日作业|本周作业)[：:\s]*$/) ||
    s.match(/^(请按时提交|请大家按时完成|逾期不补|不交者平时分扣除|收到回复|收到请扣1)[!！。~]*$/) ||
    s.match(/^(收到[了]?|好的|1|收到谢谢老师|谢谢老师|辛苦了)[!！。~]*$/)
  ) {
    return true;
  }

  // 6. 分割线
  if (s.match(/^[=\-—~_#*]{3,}$/)) {
    return true;
  }

  return false;
}

/**
 * 智能解析群消息整段作业通知
 * 具备特性：
 * 1. 过滤群聊昵称、时间戳、@所有人等聊天元数据
 * 2. 具备科目分块上下文（例如【高数】下方多行缩进或编号的作业自动继承高数）
 * 3. 智能关联高校常见课程缩写（高数、计网、线代、马原、大物等）
 * 4. 自动提取并彻底剥离自然语言截止时间（含晚上21:30、周五前交、明天课前、10月21日截止等）
 * 5. 如果未包含具体作业内容（如仅为“界面设计作业”），作业内容字段置为空字符串，不强塞占位词
 */
export function parseGroupNoticeText(
  fullText: string,
  courseCandidates: string[] = []
): ParsedGroupAssignmentItem[] {
  if (!fullText || !fullText.trim()) return [];

  // 如果输入包含 JSON 数据结构，安全尝试解析
  if (fullText.trim().startsWith('{') || fullText.trim().startsWith('[')) {
    try {
      const parsedJson = JSON.parse(fullText.trim());
      const arr = Array.isArray(parsedJson) ? parsedJson : [parsedJson];
      const validItems: ParsedGroupAssignmentItem[] = [];
      arr.forEach((entry, idx) => {
        if (entry && typeof entry === 'object' && (entry.title || entry.content || entry.task || entry.course)) {
          const course = resolveCourseName(entry.course || entry.subject || '', courseCandidates);
          const rawTitle = entry.title || entry.content || entry.task || '';
          const title = cleanHomeworkTitle(rawTitle);
          const due = entry.due || parseNaturalDate(entry.dueDate || entry.deadline || '');
          validItems.push({
            id: `parsed-json-${Date.now()}-${idx}`,
            course,
            title,
            due: due || undefined,
            rawText: JSON.stringify(entry),
            selected: true,
            matchedFromCourseTable: courseCandidates.includes(course),
          });
        }
      });
      if (validItems.length > 0) {
        return validItems;
      }
    } catch {
      // 不是合法的作业 JSON，继续常规文本解析
    }
  }

  const rawLines = fullText.split(/\r?\n/);
  const items: ParsedGroupAssignmentItem[] = [];

  // 维持一个上下文课程（用于处理按科目分段的多行作业）
  let currentCourseContext: string | null = null;

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const line = rawLine.trim();
    if (!line) continue;

    // 1. 过滤聊天元数据与纯寒暄噪音
    if (isChatNoiseLine(line)) {
      continue;
    }

    // 2. 检查是否为科目分组标题行（例如 "【高等数学】" 或 "计算机网络："）
    const detectedSectionCourse = isCourseSectionHeader(line, courseCandidates);
    if (detectedSectionCourse) {
      currentCourseContext = detectedSectionCourse;
      continue;
    }

    // 3. 剥离序号，如 "1." "1、" "1 " "一、" "(1)" "[1]" "①" "- " "* " 等
    let stripped = line.replace(
      /^(\d+[\.\、\s\-\)\]]|一[\、\.\s]|二[\、\.\s]|三[\、\.\s]|四[\、\.\s]|五[\、\.\s]|六[\、\.\s]|七[\、\.\s]|八[\、\.\s]|九[\、\.\s]|十[\、\.\s]|[\(\[\{（]\d+[\)\]\}）]|[①②③④⑤⑥⑦⑧⑨⑩]|[\*\-\•·])\s*/,
      ''
    ).trim();

    if (!stripped) continue;

    // 4. 解析单项作业
    // 如果当前有科目上下文，优先将上下文课程候选置前
    const contextCandidates = currentCourseContext
      ? [currentCourseContext, ...courseCandidates.filter(c => c !== currentCourseContext)]
      : courseCandidates;

    const parsed = parseQuickHomeworkLine(stripped, contextCandidates);

    if (parsed) {
      // 只要识别出有效课程、截止日期或作业内容中的任意一项，即可收录为待导入条目
      const hasValidCourse = Boolean(parsed.course && parsed.course !== '常规课程');
      const hasDue = Boolean(parsed.due);
      const hasTitle = Boolean(parsed.title && parsed.title.trim());

      if (hasValidCourse || hasDue || hasTitle) {
        let finalCourse = parsed.course;
        if (
          currentCourseContext &&
          (parsed.course === (courseCandidates[0] || '常规课程') || !stripped.includes(parsed.course))
        ) {
          finalCourse = currentCourseContext;
        }

        const cleanedTitle = cleanHomeworkTitle(parsed.title);

        items.push({
          id: `parsed-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          course: finalCourse || (courseCandidates[0] || '常规课程'),
          title: cleanedTitle, // 如果没有具体内容则为空字符串 ""，界面中无需填写
          due: parsed.due,
          rawText: line,
          selected: true,
          matchedFromCourseTable: courseCandidates.includes(finalCourse),
        });
      }
    }
  }

  return items;
}
