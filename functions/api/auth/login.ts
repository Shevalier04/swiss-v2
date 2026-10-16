/**
 * Cloudflare Pages Function - /api/auth/login
 */

const STUDENT_ROSTER: Record<string, string> = {
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User, X-Username',
};

export const onRequestOptions = async () => {
  return new Response(null, { headers: corsHeaders });
};

export const onRequestPost = async (context: any) => {
  try {
    const body = await context.request.json();
    const { username, password } = body || {};

    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: '请输入学号/用户名和密码' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmedUser = String(username).trim();
    const role = trimmedUser.toLowerCase() === 'admin' ? 'admin' : 'user';
    const name = STUDENT_ROSTER[trimmedUser] || (role === 'admin' ? '系统管理员' : trimmedUser);

    return new Response(
      JSON.stringify({
        token: trimmedUser,
        user: {
          username: trimmedUser,
          name,
          role,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message || '登录异常' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};
