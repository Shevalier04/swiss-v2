import React, { useState } from 'react';
import { api } from '../services/api';
import { User } from '../types';

interface AuthViewProps {
  onLoginSuccess: (user: User) => void;
  toast: (msg: string) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess, toast }) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [loginUser, setLoginUser] = useState('2612114501');
  const [loginPw, setLoginPw] = useState('123456');

  const [regUser, setRegUser] = useState('');
  const [regPw, setRegPw] = useState('');
  const [regPw2, setRegPw2] = useState('');
  const [regDemo, setRegDemo] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!loginUser.trim() || !loginPw) {
      toast('请输入学号和密码');
      return;
    }
    setLoading(true);
    try {
      const res = await api.login(loginUser.trim(), loginPw);
      toast(`欢迎回来，${res.user.name}`);
      onLoginSuccess(res.user);
    } catch (err: any) {
      toast(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!regUser.trim() || !regPw) {
      toast('请完整填写用户名与密码');
      return;
    }
    if (regPw !== regPw2) {
      toast('两次密码输入不一致');
      return;
    }
    setLoading(true);
    try {
      const res = await api.register(regUser.trim(), regPw, regDemo);
      toast(`注册成功，欢迎 ${res.user.name}`);
      onLoginSuccess(res.user);
    } catch (err: any) {
      toast(err.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative z-10 min-h-screen flex flex-col justify-center px-7 py-8 max-w-[480px] mx-auto text-[#e9e4d8]">
      <div className="text-[10px] tracking-[5px] text-[#8f8b80] text-center font-bold">
        COURSE · SCHEDULE · VOL.04
      </div>

      <h1 className="font-editorial text-4xl sm:text-5xl font-extrabold text-center my-3 tracking-[12px] pl-3 text-[#e9e4d8]">
        掌上课表
      </h1>

      <div className="w-14 h-1 bg-[#6b7cff] mx-auto my-4 rounded-full" />

      <div className="flex justify-center gap-4 text-xs text-[#8f8b80] mb-8 tracking-widest font-mono">
        <span>每个账号</span>
        <span>·</span>
        <span>一份专属课表</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b-2 border-[#e9e4d8] mb-6">
        <button
          type="button"
          onClick={() => setTab('login')}
          className={`flex-1 pb-2.5 text-sm font-bold tracking-[3px] transition-colors relative cursor-pointer ${
            tab === 'login' ? 'text-[#e9e4d8]' : 'text-[#8f8b80]'
          }`}
        >
          登 录
          {tab === 'login' && (
            <span className="absolute left-[30%] right-[30%] -bottom-0.5 h-1 bg-[#6b7cff]" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab('register')}
          className={`flex-1 pb-2.5 text-sm font-bold tracking-[3px] transition-colors relative cursor-pointer ${
            tab === 'register' ? 'text-[#e9e4d8]' : 'text-[#8f8b80]'
          }`}
        >
          注 册
          {tab === 'register' && (
            <span className="absolute left-[30%] right-[30%] -bottom-0.5 h-1 bg-[#6b7cff]" />
          )}
        </button>
      </div>

      {tab === 'login' ? (
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[9.5px] tracking-[3px] text-[#8f8b80] mb-1 font-mono">
              USERNAME · 用户名 / 学号
            </label>
            <input
              type="text"
              value={loginUser}
              onChange={e => setLoginUser(e.target.value)}
              placeholder="学号 (如 2612114501)"
              className="w-full bg-transparent border-b-2 border-[#e9e4d8] focus:border-[#6b7cff] py-2 px-1 text-base text-[#e9e4d8] font-editorial outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-[9.5px] tracking-[3px] text-[#8f8b80] mb-1 font-mono">
              PASSWORD · 密码
            </label>
            <input
              type="password"
              value={loginPw}
              onChange={e => setLoginPw(e.target.value)}
              placeholder="初始密码 123456"
              className="w-full bg-transparent border-b-2 border-[#e9e4d8] focus:border-[#6b7cff] py-2 px-1 text-base text-[#e9e4d8] font-editorial outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 py-3.5 bg-[#e9e4d8] hover:bg-[#6b7cff] text-[#1d1f24] hover:text-white font-bold text-sm tracking-[6px] transition-colors shadow-md cursor-pointer disabled:opacity-50"
          >
            {loading ? '正在验证...' : '进 入'}
          </button>

          <div className="text-center text-[#8f8b80] text-xs mt-6 leading-relaxed">
            学生账号为学号 · 初始密码 <b className="text-[#e9e4d8]">123456</b>
            <br />
            管理员 <b className="text-[#6b7cff]">admin / admin123</b>
          </div>

          <div className="pt-2 flex flex-wrap justify-center gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => { setLoginUser('2612114501'); setLoginPw('123456'); }}
              className="px-2 py-0.5 rounded border border-[#33363d] text-[#8f8b80] hover:text-[#e9e4d8] hover:border-[#6b7cff]"
            >
              学生1: 姜佳铭
            </button>
            <button
              type="button"
              onClick={() => { setLoginUser('2612114502'); setLoginPw('123456'); }}
              className="px-2 py-0.5 rounded border border-[#33363d] text-[#8f8b80] hover:text-[#e9e4d8] hover:border-[#6b7cff]"
            >
              学生2: 郑俊源
            </button>
            <button
              type="button"
              onClick={() => { setLoginUser('admin'); setLoginPw('admin123'); }}
              className="px-2 py-0.5 rounded border border-[#33363d] text-[#8f8b80] hover:text-[#e9e4d8] hover:border-[#6b7cff]"
            >
              管理员
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-[9.5px] tracking-[3px] text-[#8f8b80] mb-1 font-mono">
              USERNAME · 用户名 (2-16位)
            </label>
            <input
              type="text"
              value={regUser}
              onChange={e => setRegUser(e.target.value)}
              placeholder="请输入用户名或学号"
              className="w-full bg-transparent border-b-2 border-[#e9e4d8] focus:border-[#6b7cff] py-2 px-1 text-base text-[#e9e4d8] font-editorial outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-[9.5px] tracking-[3px] text-[#8f8b80] mb-1 font-mono">
              PASSWORD · 密码 (至少4位)
            </label>
            <input
              type="password"
              value={regPw}
              onChange={e => setRegPw(e.target.value)}
              placeholder="输入登录密码"
              className="w-full bg-transparent border-b-2 border-[#e9e4d8] focus:border-[#6b7cff] py-2 px-1 text-base text-[#e9e4d8] font-editorial outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-[9.5px] tracking-[3px] text-[#8f8b80] mb-1 font-mono">
              CONFIRM · 确认密码
            </label>
            <input
              type="password"
              value={regPw2}
              onChange={e => setRegPw2(e.target.value)}
              placeholder="再次输入密码"
              className="w-full bg-transparent border-b-2 border-[#e9e4d8] focus:border-[#6b7cff] py-2 px-1 text-base text-[#e9e4d8] font-editorial outline-none transition-colors"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-[#8f8b80] cursor-pointer py-1">
            <input
              type="checkbox"
              checked={regDemo}
              onChange={e => setRegDemo(e.target.checked)}
              className="accent-[#6b7cff] w-4 h-4"
            />
            <span>导入示例课表（可随时编辑或清空）</span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 py-3.5 bg-[#e9e4d8] hover:bg-[#6b7cff] text-[#1d1f24] hover:text-white font-bold text-sm tracking-[6px] transition-colors shadow-md cursor-pointer disabled:opacity-50"
          >
            {loading ? '正在注册...' : '注册并进入'}
          </button>
        </form>
      )}
    </div>
  );
};
