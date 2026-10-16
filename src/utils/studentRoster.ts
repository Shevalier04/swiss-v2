/**
 * 计算机班级学号与学生姓名花名册映射表
 */
export const STUDENT_ROSTER: Record<string, string> = {
  admin: '系统管理员',
  '2612114501': '姜佳铭',
  '2612114502': '郑俊源',
  '2612114503': '林枫',
  '2612114504': '苏晓铭',
  '2612114505': '傅兴胜',
  '2612114506': '陈伟杰',
  '2612114507': '林元和',
  '2612114508': '谢炟荣',
  '2612114509': '黄圣涛',
  '2612114510': '滕开键',
  '2612114511': '张佳芝',
  '2612114512': '郑鋆',
  '2612114513': '丁艳杰',
  '2612114514': '陈均涵',
  '2612114515': '经森豪',
  '2612114516': '叶长钧',
  '2612114517': '李子烨',
  '2612114518': '何婉静',
  '2612114519': '蔡毅阳',
  '2612114520': '阮泽冰',
  '2612114521': '黄宇康',
  '2612114522': '白佳乐',
  '2612114523': '方晓敏',
  '2612114524': '刘书钰',
  '2612114525': '章志强',
  '2612114526': '吴煜灿',
  '2612114527': '陈哲铭',
  '2612114528': '李奎佑',
  '2612114529': '陈晶',
  '2612114530': '郑佳豪',
  '2612114531': '吴辰炀',
  '2612114532': '杨榕煌',
  '2612114533': '林琪竣',
  '2612114534': '林佳德',
  '2612114535': '刘抒凡',
  '2612114536': '王为焓',
  '2612114537': '黄义政',
  '2612114538': '张雅婷',
  '2612114539': '鲁传伟',
  '2612114540': '翁晗冰',
  '2612114541': '余哲涛',
  '2512114511': '林东林',
};

/**
 * 智能解析学号对应的真实姓名
 * 优先级：本地自定义姓名 > 花名册预设姓名 > 远端返回有效姓名 > 学号本身
 */
export function resolveDisplayName(username?: string, currentName?: string | null): string {
  if (!username) return '同学';

  // 1. 本地自定义修改过的姓名（最高优先级）
  try {
    const saved = localStorage.getItem(`cs_user_display_name_${username}`);
    if (saved && saved.trim() && saved.trim() !== username) {
      return saved.trim();
    }
  } catch (e) {}

  // 2. 班级花名册标准匹配
  if (STUDENT_ROSTER[username]) {
    return STUDENT_ROSTER[username];
  }

  // 3. 远端提供的 name，如果不是纯学号
  if (currentName && currentName.trim() && currentName.trim() !== username) {
    return currentName.trim();
  }

  // 4. 若为 admin
  if (username.toLowerCase() === 'admin') {
    return '系统管理员';
  }

  return username;
}

/**
 * 保存自定义展示姓名
 */
export function saveCustomDisplayName(username: string, newName: string): void {
  try {
    localStorage.setItem(`cs_user_display_name_${username}`, newName.trim());
  } catch (e) {}
}
