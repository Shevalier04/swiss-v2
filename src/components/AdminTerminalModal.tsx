import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { X, RefreshCw, Terminal as TerminalIcon, Trash2, BookOpen, Plus, Send, Download, Radio, Edit3, Check } from 'lucide-react';

interface AdminTerminalModalProps {
  onClose: () => void;
  toast: (msg: string) => void;
  onRefreshParent: () => void;
}

interface TermLine {
  text: string;
  type?: 'info' | 'err' | 'echo' | '';
}

export const AdminTerminalModal: React.FC<AdminTerminalModalProps> = ({
  onClose,
  toast,
  onRefreshParent,
}) => {
  const [command, setCommand] = useState('');
  const [output, setOutput] = useState<TermLine[]>([
    { text: 'SCHEDULE ADMIN TERMINAL v4.2 — 已以超级管理员身份连接', type: 'info' },
    { text: '输入 help 查看全部命令；下方管理面板可直接点按管理学生或作业库。', type: '' },
    { text: '', type: '' },
  ]);
  const [userList, setUserList] = useState<any[]>([]);
  const [hwPool, setHwPool] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingHw, setLoadingHw] = useState(false);
  const [panelTab, setPanelTab] = useState<'users' | 'hw'>('users');

  const [quickHwCourse, setQuickHwCourse] = useState('Web编程技术');
  const [quickHwTitle, setQuickHwTitle] = useState('');
  const [quickHwDue, setQuickHwDue] = useState('');

  // Admin student name management
  const [editingUname, setEditingUname] = useState<string | null>(null);
  const [editingNameVal, setEditingNameVal] = useState<string>('');

  const termEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadOverview();
    loadHwPool();
    setTimeout(() => inputRef.current?.focus(), 150);
  }, []);

  useEffect(() => {
    termEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  const loadOverview = async () => {
    setLoadingUsers(true);
    try {
      const data = await api.getAdminOverview();
      setUserList(data.users || []);
      setStats(data.stats);
    } catch (err: any) {
      toast(err.message || '获取数据失败');
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadHwPool = async () => {
    setLoadingHw(true);
    try {
      const data = await api.getConsoleHomeworkTemplates();
      setHwPool(data || []);
    } catch (e: any) {
    } finally {
      setLoadingHw(false);
    }
  };

  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = command.trim();
    if (!cmd) return;

    setOutput(prev => [...prev, { text: `> ${cmd}`, type: 'echo' }]);
    setCommand('');

    if (cmd.toLowerCase() === 'clear') {
      setOutput([]);
      return;
    }

    try {
      const res = await api.runTerminalCommand(cmd);
      if (res.clear) {
        setOutput([]);
      } else if (res.lines) {
        setOutput(prev => [...prev, ...res.lines as any]);
      }
      loadOverview();
      loadHwPool();
      onRefreshParent();
    } catch (err: any) {
      setOutput(prev => [...prev, { text: `错误: ${err.message}`, type: 'err' }]);
    }
  };

  const handleDeleteHwPoolItem = async (id: number, title: string) => {
    setHwPool(prev => prev.filter(item => Number(item.id) !== Number(id)));
    try {
      await api.deleteConsoleHomeworkTemplate(id);
      toast(`已从作业库删除：${title}`);
      setOutput(prev => [...prev, { text: `[控制台] 已删除作业库条目：${title}`, type: 'err' }]);
      loadHwPool();
      onRefreshParent();
    } catch (err: any) {
      toast('删除失败');
      loadHwPool();
    }
  };

  const handleClearHwPool = async () => {
    setHwPool([]);
    try {
      await api.clearConsoleHomeworkTemplates();
      toast('已清空控制台作业库');
      setOutput(prev => [...prev, { text: `[控制台] 已清空全部作业库`, type: 'err' }]);
      loadHwPool();
      onRefreshParent();
    } catch (err: any) {
      toast('清空失败');
      loadHwPool();
    }
  };

  const handlePublishToPool = async () => {
    if (!quickHwTitle.trim()) {
      toast('请输入作业内容');
      return;
    }
    try {
      await api.addConsoleHomeworkTemplate({
        course: quickHwCourse,
        title: quickHwTitle.trim(),
        due: quickHwDue || undefined,
      });
      toast(`已发布至官方作业池：${quickHwTitle}`);
      setOutput(prev => [
        ...prev,
        { text: `[官方作业池] 已发布：[${quickHwCourse}] ${quickHwTitle} (供学生自由勾选)`, type: 'info' },
      ]);
      setQuickHwTitle('');
      setQuickHwDue('');
      loadHwPool();
      onRefreshParent();
    } catch (err: any) {
      toast('发布失败：' + (err.message || '请检查权限'));
    }
  };

  const handleForcePushAll = async () => {
    if (!quickHwTitle.trim()) {
      toast('请输入作业内容');
      return;
    }
    const item = {
      course: quickHwCourse,
      title: quickHwTitle.trim(),
      due: quickHwDue || undefined,
    };
    try {
      // Also register in console pool for future student reference
      await api.addConsoleHomeworkTemplate(item);
      const summary = await api.pushHomeworkToAllStudents(item);
      toast(`已全员强制下发作业：[${item.course}] ${item.title}`);
      setOutput(prev => [
        ...prev,
        { text: `[全员下发] ${summary}`, type: 'info' },
      ]);
      setQuickHwTitle('');
      setQuickHwDue('');
      loadOverview();
      loadHwPool();
      onRefreshParent();
    } catch (err: any) {
      toast('全员下发失败：' + (err.message || '请检查权限'));
      setOutput(prev => [
        ...prev,
        { text: `[错误] 全员强制下发失败: ${err.message || err}`, type: 'err' },
      ]);
    }
  };

  const handlePushHwToAll = async (item: { course: string; title: string; due?: string }) => {
    try {
      const summary = await api.pushHomeworkToAllStudents(item);
      toast(`已全员推送作业：[${item.course}] ${item.title}`);
      setOutput(prev => [
        ...prev,
        { text: `[全员推送] ${summary}`, type: 'info' },
      ]);
      loadOverview();
      onRefreshParent();
    } catch (err: any) {
      toast('推送失败：' + (err.message || '请检查网络'));
    }
  };

  const handleSyncStudentHw = async (studentId = 'admin') => {
    try {
      const res = await api.syncUserHomeworkToConsolePool(studentId);
      toast(res.message || `已同步管理员 [${studentId}] 的作业到作业池`);
      setOutput(prev => [
        ...prev,
        { text: `[官方作业池] ${res.message}`, type: 'info' },
      ]);
      loadHwPool();
      onRefreshParent();
    } catch (err: any) {
      toast('同步作业失败：' + (err.message || '未知错误'));
      setOutput(prev => [
        ...prev,
        { text: `[错误] 同步学号 ${studentId} 作业失败: ${err.message}`, type: 'err' },
      ]);
    }
  };

  const handleBroadcastEntirePool = async () => {
    if (hwPool.length === 0) {
      toast('官方作业池当前为空，请先录入或从学号同步');
      return;
    }
    try {
      const summary = await api.pushHomeworkToAllStudents();
      toast(`已广播推送官方作业池给全员学生`);
      setOutput(prev => [
        ...prev,
        { text: `[全员广播] ${summary}`, type: 'info' },
      ]);
      loadOverview();
      onRefreshParent();
    } catch (err: any) {
      toast('全员广播失败: ' + (err.message || '未知错误'));
    }
  };

  const handleStartRename = (u: any) => {
    setEditingUname(u.username);
    setEditingNameVal(u.name || '');
  };

  const handleSaveRename = async (uname: string) => {
    const trimmed = editingNameVal.trim();
    if (!trimmed) {
      toast('真实姓名不能为空');
      return;
    }
    try {
      await api.updateStudentName(uname, trimmed);
      toast(`已更新账号 [${uname}] 真实姓名为：${trimmed}`);
      setOutput(prev => [
        ...prev,
        { text: `[控制台] 已将账号 ${uname} 真实姓名更正为：${trimmed}`, type: 'info' },
      ]);
      setUserList(prev => prev.map(u => u.username === uname ? { ...u, name: trimmed } : u));
      setEditingUname(null);
      onRefreshParent();
    } catch (err: any) {
      toast(err.message || '更新姓名失败');
    }
  };

  const handleToggleDisabled = async (uname: string) => {
    try {
      const res = await api.toggleUserDisabled(uname);
      toast(`已${res.disabled ? '禁用' : '启用'}账号：${uname}`);
      loadOverview();
      onRefreshParent();
    } catch (err: any) {
      toast(err.message || '操作失败');
    }
  };

  const handleResetPassword = async (uname: string) => {
    const defaultNewPass = '123456';
    try {
      await api.resetUserPassword(uname, defaultNewPass);
      toast(`已重置 ${uname} 的密码为初始密码：123456`);
      setOutput(prev => [
        ...prev,
        { text: `[控制台] 已将账号 ${uname} 密码重置为 123456`, type: 'info' },
      ]);
      loadOverview();
    } catch (err: any) {
      toast(err.message || '重置失败');
    }
  };

  const handleDeleteUser = async (uname: string) => {
    setUserList(prev => prev.filter(u => u.username !== uname));
    try {
      await api.deleteUser(uname);
      toast(`已删除账号：${uname}`);
      setOutput(prev => [
        ...prev,
        { text: `[控制台] 已删除账号及其数据：${uname}`, type: 'err' },
      ]);
      loadOverview();
      onRefreshParent();
    } catch (err: any) {
      toast(err.message || '删除失败');
      loadOverview();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0c0f14] text-[#d7ffe8] max-w-[540px] mx-auto select-text">
      {/* Top Bar */}
      <div className="bg-[#101216] px-4 py-2.5 flex items-center justify-between border-b border-[#1e2634] shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
          </div>
          <span className="text-xs text-[#9a968c] font-mono ml-2">
            admin@console:~/schedule
          </span>
        </div>
        <button
          onClick={onClose}
          className="px-2.5 py-1 bg-[#e9e4d8] hover:bg-white text-[#1d1f24] font-bold text-xs tracking-wider cursor-pointer"
        >
          退出
        </button>
      </div>

      {/* Terminal Output */}
      <div className="flex-1 overflow-y-auto p-3.5 font-mono text-xs leading-relaxed space-y-1 bg-[#090b0f] border-b-2 border-[#1e2634]">
        {output.map((line, idx) => (
          <div
            key={idx}
            className={`whitespace-pre-wrap break-all ${
              line.type === 'echo'
                ? 'text-[#5a6b80]'
                : line.type === 'err'
                ? 'text-[#ff8b8b]'
                : line.type === 'info'
                ? 'text-[#7db0ff]'
                : 'text-[#7ee2a8]'
            }`}
          >
            {line.text}
          </div>
        ))}
        <div ref={termEndRef} />
      </div>

      {/* Terminal Input Line */}
      <form
        onSubmit={handleCommandSubmit}
        className="flex items-center gap-2 px-3.5 py-2.5 bg-[#0c0f14] border-b-2 border-[#33363d] shrink-0"
      >
        <span className="text-[#7ee2a8] font-mono text-xs font-bold shrink-0">
          admin@console:~$
        </span>
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={e => setCommand(e.target.value)}
          placeholder="输入命令 (如 hw list, hw add 课名|作业|截止, users, help ...)"
          className="flex-1 bg-transparent border-none outline-none font-mono text-xs text-[#d7ffe8]"
        />
      </form>

      {/* Quick Command Pills */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#101217] border-b border-[#22252e] text-[10.5px] font-mono overflow-x-auto shrink-0 select-none">
        <span className="text-[#63605a] shrink-0">快捷:</span>
        <button
          type="button"
          onClick={() => {
            setCommand('hw list');
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="px-2 py-0.5 bg-[#1b2234] hover:bg-[#25304a] text-[#8ea4ff] rounded cursor-pointer shrink-0"
        >
          hw list (查看作业库)
        </button>
        <button
          type="button"
          onClick={() => {
            setCommand('hw del 1');
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="px-2 py-0.5 bg-[#341b20] hover:bg-[#4a252b] text-[#ff8e8e] rounded cursor-pointer shrink-0"
        >
          hw del (删除作业)
        </button>
        <button
          type="button"
          onClick={() => {
            setCommand('hw clear');
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="px-2 py-0.5 bg-[#341b20] hover:bg-[#4a252b] text-[#ff8e8e] rounded cursor-pointer shrink-0"
        >
          hw clear (清空作业库)
        </button>
        <button
          type="button"
          onClick={() => {
            setCommand('users');
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="px-2 py-0.5 bg-[#202228] hover:bg-[#2b2d35] text-[#c8c4b8] rounded cursor-pointer shrink-0"
        >
          users
        </button>
        <button
          type="button"
          onClick={() => {
            setCommand('stats');
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="px-2 py-0.5 bg-[#202228] hover:bg-[#2b2d35] text-[#c8c4b8] rounded cursor-pointer shrink-0"
        >
          stats
        </button>
        <button
          type="button"
          onClick={() => {
            setCommand('help');
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="px-2 py-0.5 bg-[#202228] hover:bg-[#2b2d35] text-[#c8c4b8] rounded cursor-pointer shrink-0"
        >
          help
        </button>
      </div>

      {/* Management Panel GUI */}
      <div className="h-72 overflow-y-auto p-3.5 bg-[#15171c] shrink-0 border-t border-[#1e2634]">
        {/* Panel Tabs */}
        <div className="flex items-center justify-between text-xs font-mono font-bold text-[#8f8b80] mb-2.5 pb-2 border-b border-[#252834]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPanelTab('users')}
              className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                panelTab === 'users' ? 'text-[#6b7cff]' : 'text-[#8f8b80] hover:text-[#e9e4d8]'
              }`}
            >
              <TerminalIcon className="w-3.5 h-3.5" />
              <span>全班学生账号 ({userList.length})</span>
            </button>

            <span className="text-[#3a3d48]">|</span>

            <button
              onClick={() => setPanelTab('hw')}
              className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                panelTab === 'hw' ? 'text-[#4ade80]' : 'text-[#8f8b80] hover:text-[#e9e4d8]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>控制台作业库管理 ({hwPool.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {panelTab === 'hw' && (
              <>
                <button
                  type="button"
                  onClick={() => handleSyncStudentHw('admin')}
                  className="flex items-center gap-1 text-[11px] text-[#4ade80] hover:underline cursor-pointer px-1.5 py-0.5 rounded bg-[#4ade80]/10 border border-[#4ade80]/30"
                  title="将管理员账号 (admin) 现有作业去重存入官方作业池"
                >
                  <Download className="w-3 h-3" />
                  同步管理员作业
                </button>
                {hwPool.length > 0 && (
                  <button
                    type="button"
                    onClick={handleBroadcastEntirePool}
                    className="flex items-center gap-1 text-[11px] text-[#8ea4ff] hover:underline cursor-pointer px-1.5 py-0.5 rounded bg-[#6b7cff]/10 border border-[#6b7cff]/30"
                    title="一键将作业池推送到所有学生个人表"
                  >
                    <Radio className="w-3 h-3" />
                    全员广播下发
                  </button>
                )}
                {hwPool.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearHwPool}
                    className="flex items-center gap-1 text-[11px] text-[#ff6b57] hover:underline cursor-pointer"
                    title="清空控制台作业库"
                  >
                    <Trash2 className="w-3 h-3" />
                    清空
                  </button>
                )}
              </>
            )}
            <button
              onClick={() => {
                loadOverview();
                loadHwPool();
              }}
              className="flex items-center gap-1 text-[11px] text-[#e9e4d8] hover:text-white px-2 py-0.5 border border-[#33363d] rounded cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${loadingUsers || loadingHw ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </div>

        {panelTab === 'users' ? (
          <div className="space-y-2 text-xs">
            {userList.map(u => (
              <div
                key={u.username}
                className="bg-[#202227] border border-[#2a2d34] p-2.5 rounded flex items-center justify-between gap-2 flex-wrap"
              >
                <div className="flex items-center gap-2 min-w-[130px]">
                  {editingUname === u.username ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={editingNameVal}
                        onChange={e => setEditingNameVal(e.target.value)}
                        placeholder="输入姓名"
                        className="bg-[#12141a] border border-[#6b7cff] text-xs text-[#e9e4d8] font-bold px-1.5 py-0.5 rounded outline-none w-24"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveRename(u.username);
                          if (e.key === 'Escape') setEditingUname(null);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveRename(u.username)}
                        className="p-1 bg-[#6b7cff] text-white rounded hover:bg-[#5868e6] cursor-pointer"
                        title="保存姓名"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingUname(null)}
                        className="p-1 bg-[#33363f] text-[#8f8b80] hover:text-[#e9e4d8] rounded cursor-pointer"
                        title="取消"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="font-bold text-[#e9e4d8]">{u.name}</span>
                      <span className="text-[10px] text-[#8f8b80] font-mono">{u.username}</span>
                    </>
                  )}
                  {u.role === 'admin' && (
                    <span className="text-[9px] px-1 bg-[#6b7cff] text-white font-bold rounded">
                      ADMIN
                    </span>
                  )}
                  {u.disabled && (
                    <span className="text-[9px] px-1 bg-[#ff5f57] text-white font-bold rounded">
                      已禁用
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-[#8f8b80] font-mono">
                  课:{u.courseCount} ｜ 作业:{u.pendingHw} ｜ 任务:{u.pendingTasks}
                </div>

                <div className="flex gap-1.5 ml-auto">
                  {u.role !== 'admin' && (
                    <>
                      <button
                        onClick={() => handleStartRename(u)}
                        className="px-2 py-0.5 text-[10px] font-bold border border-[#6b7cff]/50 text-[#8ea4ff] hover:bg-[#6b7cff] hover:text-white rounded cursor-pointer flex items-center gap-0.5"
                        title="修改此学生真实姓名(终端管理员专享权限)"
                      >
                        <Edit3 className="w-2.5 h-2.5" />
                        <span>改名</span>
                      </button>
                      <button
                        onClick={() => handleToggleDisabled(u.username)}
                        className="px-2 py-0.5 text-[10px] font-bold border border-[#33363d] hover:bg-[#33363d] text-[#e9e4d8] rounded cursor-pointer"
                      >
                        {u.disabled ? '启用' : '禁用'}
                      </button>
                      <button
                        onClick={() => handleResetPassword(u.username)}
                        className="px-2 py-0.5 text-[10px] font-bold border border-[#33363d] hover:bg-[#33363d] text-[#e9e4d8] rounded cursor-pointer"
                      >
                        重置密码
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.username)}
                        className="px-2 py-0.5 text-[10px] font-bold border border-[#ff5f57]/50 text-[#ff5f57] hover:bg-[#ff5f57] hover:text-white rounded cursor-pointer"
                      >
                        删除
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3 text-xs">
            {/* Quick Add Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handlePublishToPool();
              }}
              className="bg-[#1b1e26] border border-[#2a2d36] p-2.5 rounded flex items-center gap-2 flex-wrap"
            >
              <select
                value={quickHwCourse}
                onChange={e => setQuickHwCourse(e.target.value)}
                className="bg-[#12141a] border border-[#33363f] text-[#e9e4d8] text-xs px-2 py-1 rounded outline-none"
              >
                {['Web编程技术', '数据库概论', 'Java开发技术', '计算机网络', '软件工程导论', '其他'].map(
                  c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  )
                )}
              </select>
              <input
                type="text"
                value={quickHwTitle}
                onChange={e => setQuickHwTitle(e.target.value)}
                placeholder="作业内容 (如：第4章习题)"
                className="flex-1 min-w-[140px] bg-[#12141a] border border-[#33363f] text-[#e9e4d8] text-xs px-2 py-1 rounded outline-none"
              />
              <input
                type="datetime-local"
                value={quickHwDue}
                onChange={e => setQuickHwDue(e.target.value)}
                title="截止时间 (精确到小时)"
                className="bg-[#12141a] border border-[#33363f] text-[#e9e4d8] text-xs px-2 py-1 rounded outline-none"
              />
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    now.setHours(22, 0, 0, 0);
                    const iso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                    setQuickHwDue(iso);
                  }}
                  className="px-1.5 py-0.5 bg-[#171920] hover:bg-[#6b7cff]/20 text-[#8ea4ff] border border-[#33363f] rounded text-[10px] cursor-pointer"
                  title="设为今晚 22:00 截止"
                >
                  今晚22:00
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    now.setDate(now.getDate() + 1);
                    now.setHours(22, 0, 0, 0);
                    const iso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                    setQuickHwDue(iso);
                  }}
                  className="px-1.5 py-0.5 bg-[#171920] hover:bg-[#6b7cff]/20 text-[#8ea4ff] border border-[#33363f] rounded text-[10px] cursor-pointer"
                  title="设为明晚 22:00 截止"
                >
                  明晚22:00
                </button>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handlePublishToPool}
                  className="px-2.5 py-1 bg-[#4ade80] hover:bg-[#3ecc72] text-[#12141a] font-bold rounded text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-xs"
                  title="发布至官方作业池，供全班学生在客户端自由勾选导入"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>发布至官方作业池</span>
                </button>
                <button
                  type="button"
                  onClick={handleForcePushAll}
                  className="px-2.5 py-1 bg-[#6b7cff] hover:bg-[#5868e6] text-white font-bold rounded text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-xs"
                  title="一键全员强制下发该作业至所有学生课表，自动覆盖同名作业并保留已完成状态"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>一键全员强制下发</span>
                </button>
              </div>
            </form>

            {/* Homework Pool Items */}
            {hwPool.length === 0 ? (
              <div className="py-8 text-center text-[#8f8b80] border border-dashed border-[#2a2d36] rounded">
                官方作业库当前为空，可在上方表单录入或使用 hw add / hw push 命令
              </div>
            ) : (
              <div className="space-y-2">
                {hwPool.map((item, idx) => (
                  <div
                    key={item.id}
                    className="bg-[#202227] border border-[#2a2d34] p-2.5 rounded flex items-center justify-between gap-2 flex-wrap"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-[10px] text-[#4ade80] font-mono shrink-0">
                        #{idx + 1}
                      </span>
                      <span className="text-[10.5px] px-1.5 py-0.2 bg-[#2d3142] text-[#8ea4ff] font-bold rounded shrink-0">
                        {item.course}
                      </span>
                      <span className="font-bold text-[#e9e4d8] truncate">{item.title}</span>
                      <span className="text-[11px] text-[#8f8b80] font-mono shrink-0">
                        {item.due ? `截止: ${item.due}` : '无截止日期'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-[#63605a] font-mono hidden sm:inline">
                        by {item.creator || 'admin'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handlePushHwToAll(item)}
                        className="px-2 py-0.5 text-[10px] font-bold border border-[#6b7cff]/50 text-[#8ea4ff] hover:bg-[#6b7cff] hover:text-white rounded cursor-pointer flex items-center gap-1 transition-all active:scale-95"
                        title="一键下发并覆盖更新至全班学生课表"
                      >
                        <Send className="w-3 h-3" />
                        <span>全员推送</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteHwPoolItem(item.id, item.title)}
                        className="px-2 py-0.5 text-[10px] font-bold border border-[#ff5f57]/50 text-[#ff5f57] hover:bg-[#ff5f57] hover:text-white rounded cursor-pointer flex items-center gap-1 transition-colors"
                        title="从官方作业池中删除"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>删除</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
