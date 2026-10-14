/**
 * Utility for parsing single-line quick homework input and class group notice messages
 */

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * 智能解析自然语言日期为 YYYY-MM-DD
 * 支持：@今天、@明天、@后天、@大后天、@周X、@下周X、@M月D日、@M-D、@YYYY-MM-DD、@N天后、@本周末 等
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

  // 2. 明天 / 明晚
  if (s.includes('明天') || s.includes('明晚') || s === 'tomorrow') {
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

  // 6. 周末
  if (s === '周末' || s === '本周末') {
    const curWeekday = baseDate.getDay() === 0 ? 7 : baseDate.getDay();
    const diff = 7 - curWeekday;
    const d = new Date(year, month, date + diff);
    return formatDate(d);
  }

  // 7. 周几 / 星期几 / 礼拜几 (含 下周X)
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

  const weekMatch = s.match(/(?:下周|下星期|下礼拜|周|星期|礼拜)([一二三四五六日天1234567])/);
  if (weekMatch) {
    const targetWeekday = weekdayMap[weekMatch[1]];
    if (targetWeekday) {
      const curWeekday = baseDate.getDay() === 0 ? 7 : baseDate.getDay();
      let diff = targetWeekday - curWeekday;
      if (isNextWeek) {
        diff = (targetWeekday - curWeekday + 7);
      } else if (diff <= 0) {
        diff += 7;
      }
      const d = new Date(year, month, date + diff);
      return formatDate(d);
    }
  }

  // 8. 完整日期 YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD, YYYY年MM月DD日
  const fullDateMatch = s.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?/);
  if (fullDateMatch) {
    const y = parseInt(fullDateMatch[1], 10);
    const m = parseInt(fullDateMatch[2], 10);
    const dayVal = parseInt(fullDateMatch[3], 10);
    return `${y}-${pad2(m)}-${pad2(dayVal)}`;
  }

  // 9. 短日期 MM-DD, M.D, M月D日, M/D
  const shortDateMatch = s.match(/(\d{1,2})[-/.月](\d{1,2})日?/);
  if (shortDateMatch) {
    const m = parseInt(shortDateMatch[1], 10);
    const dayVal = parseInt(shortDateMatch[2], 10);
    return `${year}-${pad2(m)}-${pad2(dayVal)}`;
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
 * 解析单行极速录入文本
 * 格式如:
 * "高数 课后习题P32 @明天"
 * "大学英语 Unit2单词抄写 @周日"
 * "数据库概论: ER图设计 @2026-10-25"
 * "Web编程技术 大作业项目"
 */
export function parseQuickHomeworkLine(
  rawLine: string,
  courseCandidates: string[] = []
): ParsedQuickHomework | null {
  const line = rawLine.trim();
  if (!line) return null;

  let remaining = line;
  let parsedDue: string | undefined = undefined;
  let rawDueText: string | undefined = undefined;

  // 1. 优先提取 @截止时间
  const atMatch = remaining.match(/@([^\s@]+)/);
  if (atMatch) {
    rawDueText = atMatch[1];
    const d = parseNaturalDate(rawDueText);
    if (d) {
      parsedDue = d;
    }
    // 移除 @xxx 部分
    remaining = remaining.replace(atMatch[0], '').trim();
  } else {
    // 2. 检查是否有 "截止时间：xxx" 或 "截止：xxx" 或 "周X前交" 等自然截止时间
    const deadlineKeywordMatch = remaining.match(/(?:截止时间|截止|交卷时间)[：:\s]*([^\s，,。]+)/i);
    if (deadlineKeywordMatch) {
      rawDueText = deadlineKeywordMatch[1];
      const d = parseNaturalDate(rawDueText);
      if (d) {
        parsedDue = d;
      }
      remaining = remaining.replace(deadlineKeywordMatch[0], '').trim();
    }
  }

  // 3. 提取括号课程如 【高数】、【Web编程】、[大学英语]
  const bracketMatch = remaining.match(/^[【\[\(]([^】\]\)]+)[】\]\)]\s*(.*)$/);
  if (bracketMatch) {
    return {
      course: bracketMatch[1].trim(),
      title: bracketMatch[2].trim() || '随堂作业',
      due: parsedDue,
      rawDueText,
    };
  }

  // 4. 检查是否匹配已知课程库前缀
  const sortedCandidates = [...courseCandidates].sort((a, b) => b.length - a.length);
  for (const c of sortedCandidates) {
    if (remaining.startsWith(c)) {
      const rest = remaining.slice(c.length).replace(/^[:：\-\s]+/, '').trim();
      return {
        course: c,
        title: rest || '随堂作业',
        due: parsedDue,
        rawDueText,
      };
    }
  }

  // 5. 检查冒号分隔 (如 "高数：课后习题P32")
  const colonParts = remaining.split(/[:：]/);
  if (colonParts.length >= 2 && colonParts[0].trim().length <= 15) {
    const course = colonParts[0].trim();
    const title = colonParts.slice(1).join(':').trim();
    return {
      course: course || (courseCandidates[0] || '其他课程'),
      title: title || '随堂作业',
      due: parsedDue,
      rawDueText,
    };
  }

  // 6. 按空格拆分首词作为课程名 (如 "高数 课后习题P32")
  const spaceParts = remaining.split(/\s+/);
  if (spaceParts.length >= 2) {
    const course = spaceParts[0].trim();
    const title = spaceParts.slice(1).join(' ').trim();
    return {
      course: course,
      title: title,
      due: parsedDue,
      rawDueText,
    };
  }

  // 7. 单独一个词，视为作业内容，课程使用默认首选课程
  return {
    course: courseCandidates[0] || '常规课程',
    title: remaining,
    due: parsedDue,
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
}

/**
 * 智能解析群消息整段作业通知
 */
export function parseGroupNoticeText(
  fullText: string,
  courseCandidates: string[] = []
): ParsedGroupAssignmentItem[] {
  if (!fullText || !fullText.trim()) return [];

  const rawLines = fullText.split(/\r?\n/);
  const items: ParsedGroupAssignmentItem[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i].trim();
    if (!line) continue;

    // 过滤掉公告开头或尾部常见的寒暄无用行
    if (
      line.match(/^(今日作业|本周作业|作业通知|各科作业|作业汇总|大家记得交作业|收到请回复|重要通知|温馨提示|作业布置|各位同学)[!！:：\s]?$/i) ||
      line.match(/.*(作业通知|作业汇总|今日作业|本周作业)[：:\s]*$/) ||
      line.match(/^[=-—~_]{3,}$/)
    ) {
      continue;
    }

    // 剥离序号，如 "1." "1、" "1 " "一、" "(1)" "[1]" "①" 等
    const stripped = line.replace(
      /^(\d+[\.\、\s\-\)\]]|一[\、\.\s]|二[\、\.\s]|三[\、\.\s]|四[\、\.\s]|五[\、\.\s]|六[\、\.\s]|七[\、\.\s]|八[\、\.\s]|九[\、\.\s]|十[\、\.\s]|[\(\[\{]\d+[\)\]\}]|[①②③④⑤⑥⑦⑧⑨⑩]|[\*\-\•])\s*/,
      ''
    ).trim();

    if (!stripped) continue;

    const parsed = parseQuickHomeworkLine(stripped, courseCandidates);
    if (parsed && parsed.title) {
      items.push({
        id: `parsed-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        course: parsed.course || (courseCandidates[0] || '常规课程'),
        title: parsed.title,
        due: parsed.due,
        rawText: line,
        selected: true,
      });
    }
  }

  return items;
}
