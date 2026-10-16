import React, { useState, useEffect, useMemo } from 'react';
import { Course, Homework, User } from '../types';
import { api } from '../services/api';
import {
  X,
  CheckSquare,
  Square,
  DownloadCloud,
  Check,
  Search,
  RotateCcw,
  Calendar,
  AlertCircle,
  Loader2,
  Database,
  Radio,
  ChevronDown,
  ChevronUp,
  Trash2,
  Terminal,
  Code,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

export interface HomeworkTemplateItem {
  id: number;
  course: string;
  title: string;
  due?: string;
  creator?: string;
}

interface HomeworkImportModalProps {
  user?: User | null;
  courses: Course[];
  existingHomework: Homework[];
  onImport: (items: { course: string; title: string; due?: string }[]) => Promise<void>;
  onClose: () => void;
  toast: (msg: string) => void;
}

const D1_SQL_SCRIPTS = [
  {
    id: 'create_pool',
    title: '1. 创建 D1 全局官方作业池表 (homework_pool)',
    desc: '在 Cloudflare 控制台 D1 数据库执行建表语句',
    sql: `-- 1. 创建全局官方作业池表
CREATE TABLE IF NOT EXISTS homework_pool (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course TEXT NOT NULL,
  title TEXT NOT NULL,
  due TEXT,
  creator TEXT DEFAULT '管理员',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_homework_pool_course ON homework_pool(course);`,
  },
  {
    id: 'sync_admin',
    title: '2. 将管理员账号 (admin) 作业提取为全局官方作业池',
    desc: '将已有的管理员作业转入官方池，供全班学生自主勾选同步',
    sql: `-- 2. 将管理员账号 (admin) 的作业提取写入官方作业池（去重）
INSERT INTO homework_pool (course, title, due, creator)
SELECT course_name, title, deadline, 'admin'
FROM assignments
WHERE username = 'admin'
  AND (course_name, title) NOT IN (SELECT course, title FROM homework_pool);`,
  },
  {
    id: 'broadcast_all',
    title: '3. 从官方作业池一键广播下发给 D1 所有学生',
    desc: '向 assignments 表中所有学生批量复制当前官方池全部作业',
    sql: `-- 3. 广播下发：向所有已知学生的 assignments 表注入官方作业池作业
INSERT INTO assignments (username, course_name, title, deadline, completed)
SELECT DISTINCT u.username, p.course, p.title, p.due, 0
FROM (
  SELECT DISTINCT username FROM assignments WHERE username IS NOT NULL AND username != ''
  UNION
  SELECT 'admin'
) u
CROSS JOIN homework_pool p
WHERE NOT EXISTS (
  SELECT 1 FROM assignments ex
  WHERE ex.username = u.username
    AND ex.course_name = p.course
    AND ex.title = p.title
);`,
  },
  {
    id: 'clean_demo',
    title: '4. 彻底清除历史旧示范作业 (清理脏数据)',
    desc: '清理 assignments 和 homework_pool 中残留的测试示范作业',
    sql: `-- 4. 清理包含示范关键字的脏数据
DELETE FROM assignments 
WHERE title LIKE '%ER图%' 
   OR title LIKE '%Wireshark%' 
   OR title LIKE '%翻转课堂%' 
   OR title LIKE '%示例%' 
   OR title LIKE '%示范%';

DELETE FROM homework_pool 
WHERE title LIKE '%ER图%' 
   OR title LIKE '%Wireshark%' 
   OR title LIKE '%翻转课堂%' 
   OR title LIKE '%示例%' 
   OR title LIKE '%示范%';`,
  },
];

export const HomeworkImportModal: React.FC<HomeworkImportModalProps> = ({
  user,
  courses,
  existingHomework,
  onImport,
  onClose,
  toast,
}) => {
  const isAdmin = user?.role === 'admin' || user?.username === 'admin';

  const [templates, setTemplates] = useState<HomeworkTemplateItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all');

  // D1 Management Panel & SQL drawer state (Admin only)
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showSqlDrawer, setShowSqlDrawer] = useState(false);
  const [activeSqlTab, setActiveSqlTab] = useState(0);
  const [adminOperating, setAdminOperating] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const courseNames = useMemo(() => {
    const list = Array.from(new Set(courses.map(c => c.name))).filter(Boolean);
    return list.length ? list : ['Web编程技术', '数据库概论', 'Java开发技术', '计算机网络', '软件工程导论'];
  }, [courses]);

  // Normalized matching helper: course.trim().toLowerCase() and title.trim().toLowerCase()
  const isItemExisting = (course: string, title: string) => {
    const c = (course || '').trim().toLowerCase();
    const t = (title || '').trim().toLowerCase();
    if (!t) return false;
    return existingHomework.some(
      h => (h.course || '').trim().toLowerCase() === c && (h.title || '').trim().toLowerCase() === t
    );
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await api.getConsoleHomeworkTemplates();
      const list: HomeworkTemplateItem[] = Array.isArray(data) ? [...data] : [];
      setTemplates(list);
      setSelectedIds(new Set(list.map(t => t.id)));
    } catch (e: any) {
      toast('获取官方作业池失败，请检查网络或稍后重试');
      setTemplates([]);
      setSelectedIds(new Set());
    } finally {
      setLoading(false);
    }
  };

  const handleResetPresets = () => {
    loadTemplates();
    toast('已重新从服务器同步官方作业池');
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredTemplates = useMemo(() => {
    return templates.filter(item => {
      if (selectedCourseFilter !== 'all' && item.course !== selectedCourseFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return (
        item.course.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        (item.due && item.due.toLowerCase().includes(q))
      );
    });
  }, [templates, selectedCourseFilter, searchQuery]);

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredTemplates.map(t => t.id);
    const allFilteredSelected = filteredIds.every(id => selectedIds.has(id));

    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredIds.forEach(id => next.delete(id));
      } else {
        filteredIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const stats = useMemo(() => {
    let newCount = 0;
    let updatedCount = 0;
    templates.forEach(t => {
      if (selectedIds.has(t.id)) {
        if (isItemExisting(t.course, t.title)) {
          updatedCount++;
        } else {
          newCount++;
        }
      }
    });
    return { newCount, updatedCount, totalSelected: selectedIds.size };
  }, [templates, selectedIds, existingHomework]);

  const handleImport = async () => {
    const toImport = templates
      .filter(t => selectedIds.has(t.id))
      .map(t => ({ course: t.course, title: t.title, due: t.due }));

    if (toImport.length === 0) {
      toast('请勾选至少一项要导入的作业');
      return;
    }

    setImporting(true);
    try {
      await onImport(toImport);
      onClose();
    } catch (e: any) {
      toast(e.message || '导入作业失败');
    } finally {
      setImporting(false);
    }
  };

  // 1. One-click sync admin homework to D1 official pool (Admin only)
  const handleSyncAdminToPool = async () => {
    if (!isAdmin) {
      toast('仅管理员可执行作业下发与转存');
      return;
    }
    setAdminOperating(true);
    try {
      const res = await api.syncUserHomeworkToConsolePool('admin');
      toast(res.message || '已成功将管理员作业同步存入 D1 全局官方作业池');
      await loadTemplates();
    } catch (e: any) {
      toast(`同步失败: ${e.message}`);
    } finally {
      setAdminOperating(false);
    }
  };

  // 2. Broadcast push official pool to all students (Admin only)
  const handleBroadcastPushToAll = async () => {
    if (!isAdmin) {
      toast('仅管理员账号可操作全员下发作业');
      return;
    }
    if (!window.confirm('确定要将当前官方作业池中的作业一键下发推送给所有学生吗？')) {
      return;
    }
    setAdminOperating(true);
    try {
      const msg = await api.pushHomeworkToAllStudents();
      toast(msg || '已成功向全员推送官方作业池');
    } catch (e: any) {
      toast(`全员推送失败: ${e.message}`);
    } finally {
      setAdminOperating(false);
    }
  };

  // 3. Clear official pool (Admin only)
  const handleClearPool = async () => {
    if (!isAdmin) {
      toast('仅管理员可清空官方作业池');
      return;
    }
    if (!window.confirm('确定要清空官方作业池吗？清空后池内数据将为空白。')) {
      return;
    }
    setAdminOperating(true);
    try {
      await api.clearConsoleHomeworkTemplates();
      setTemplates([]);
      setSelectedIds(new Set());
      toast('官方作业池已清空');
    } catch (e: any) {
      toast(`清空失败: ${e.message}`);
    } finally {
      setAdminOperating(false);
    }
  };

  // 4. Delete single item from pool (Admin only)
  const handleDeletePoolItem = async (id: number) => {
    if (!isAdmin) return;
    if (!window.confirm('确定要从官方作业池移除此项作业吗？')) return;
    try {
      await api.deleteConsoleHomeworkTemplate(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast('已从官方作业池移除该条目');
    } catch (e: any) {
      toast(`删除失败: ${e.message}`);
    }
  };

  // Copy SQL script helper
  const handleCopySql = (sql: string, index: number) => {
    navigator.clipboard.writeText(sql);
    setCopiedIndex(index);
    toast('SQL 脚本已复制到剪贴板，可前往 Cloudflare D1 控制台粘贴执行');
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-2xl bg-[#1d1f24] border-2 border-[#e9e4d8] text-[#e9e4d8] shadow-2xl rounded-xs flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-[#e9e4d8] bg-[#24262c]">
          <div>
            <div className="flex items-center gap-2">
              <DownloadCloud className="w-5 h-5 text-[#6b7cff]" />
              <h3 className="font-editorial text-lg sm:text-xl font-bold tracking-wide">
                官方作业清单同步
              </h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#6b7cff]/20 text-[#6b7cff] font-mono font-bold">
                D1 全局作业池
              </span>
              {isAdmin && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold flex items-center gap-1 border border-emerald-500/30">
                  <ShieldCheck className="w-3 h-3" />
                  管理员下发权限
                </span>
              )}
            </div>
            <div className="text-[9.5px] font-mono tracking-[2px] text-[#8f8b80] mt-0.5">
              OFFICIAL POOL · {isAdmin ? '管理员发布与全员下发' : '全员自主同步 · 无示范假数据'}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowAdminPanel(!showAdminPanel)}
                className={`px-2.5 py-1 text-xs rounded border transition-colors flex items-center gap-1 cursor-pointer ${
                  showAdminPanel
                    ? 'bg-[#6b7cff] text-white border-[#6b7cff]'
                    : 'bg-[#181a1f] text-[#8f8b80] hover:text-[#e9e4d8] border-[#3a3d46]'
                }`}
                title="切换 D1 控制台与全员下发管理面板"
              >
                <Database className="w-3.5 h-3.5" />
                <span>下发管理/SQL</span>
                {showAdminPanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 border border-[#e9e4d8] hover:bg-[#e9e4d8] hover:text-[#1d1f24] flex items-center justify-center transition-colors cursor-pointer"
              title="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Collapsible D1 Management & SQL Toolbar (Only visible to admin) */}
        {isAdmin && showAdminPanel && (
          <div className="p-3 bg-[#181a20] border-b-2 border-[#33363f] space-y-2.5 animate-fade-in text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#e9e4d8] flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-[#4ade80]" />
                Cloudflare D1 全局作业池下发控制台
              </span>
              <button
                type="button"
                onClick={() => setShowSqlDrawer(!showSqlDrawer)}
                className="text-[#6b7cff] hover:underline flex items-center gap-1 cursor-pointer font-mono text-[11px]"
              >
                <Code className="w-3.5 h-3.5" />
                <span>{showSqlDrawer ? '隐藏 SQL 脚本' : '查看/复制 D1 执行脚本'}</span>
              </button>
            </div>

            {/* Quick Action Buttons for Admin */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                disabled={adminOperating}
                onClick={handleSyncAdminToPool}
                className="p-2 bg-[#232732] hover:bg-[#2b3040] text-left border border-[#3e4456] rounded cursor-pointer transition-all disabled:opacity-50 group"
              >
                <div className="font-bold text-[#e9e4d8] group-hover:text-[#6b7cff] flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-[#ff6b57]" />
                  <span>转存管理员(admin)作业</span>
                </div>
                <div className="text-[10px] text-[#8f8b80] mt-0.5">
                  将管理员账号作业提取写入 D1 homework_pool 官方池
                </div>
              </button>

              <button
                type="button"
                disabled={adminOperating || templates.length === 0}
                onClick={handleBroadcastPushToAll}
                className="p-2 bg-[#232732] hover:bg-[#2b3040] text-left border border-[#3e4456] rounded cursor-pointer transition-all disabled:opacity-50 group"
              >
                <div className="font-bold text-[#e9e4d8] group-hover:text-[#4ade80] flex items-center gap-1">
                  <Radio className="w-3.5 h-3.5 text-[#4ade80]" />
                  <span>一键广播下发给全员</span>
                </div>
                <div className="text-[10px] text-[#8f8b80] mt-0.5">
                  向 D1 全部学生批量推送官方池中所有作业
                </div>
              </button>

              <button
                type="button"
                disabled={adminOperating || templates.length === 0}
                onClick={handleClearPool}
                className="p-2 bg-[#232732] hover:bg-[#2b3040] text-left border border-[#3e4456] rounded cursor-pointer transition-all disabled:opacity-50 group"
              >
                <div className="font-bold text-[#e9e4d8] group-hover:text-[#ff6b57] flex items-center gap-1">
                  <Trash2 className="w-3.5 h-3.5 text-[#ff6b57]" />
                  <span>清空官方作业池</span>
                </div>
                <div className="text-[10px] text-[#8f8b80] mt-0.5">
                  清空 D1 homework_pool，保持空白状态
                </div>
              </button>
            </div>

            {/* Embedded SQL Viewer Drawer */}
            {showSqlDrawer && (
              <div className="mt-2.5 p-2.5 bg-[#121316] border border-[#2e323b] rounded space-y-2">
                <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] font-mono">
                  {D1_SQL_SCRIPTS.map((sc, idx) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setActiveSqlTab(idx)}
                      className={`px-2 py-1 rounded transition-colors whitespace-nowrap cursor-pointer ${
                        activeSqlTab === idx
                          ? 'bg-[#6b7cff] text-white font-bold'
                          : 'bg-[#1e2026] text-[#8f8b80] hover:text-[#e9e4d8]'
                      }`}
                    >
                      {sc.title.split('.')[0]}. {sc.title.split(' ')[1] || sc.title}
                    </button>
                  ))}
                </div>

                <div className="relative bg-[#0c0d0f] p-2.5 rounded border border-[#23262e] font-mono text-[11px] text-[#c9cbcf] overflow-x-auto">
                  <div className="text-[#8f8b80] text-[10px] mb-1.5 flex items-center justify-between">
                    <span>{D1_SQL_SCRIPTS[activeSqlTab].desc}</span>
                    <button
                      type="button"
                      onClick={() => handleCopySql(D1_SQL_SCRIPTS[activeSqlTab].sql, activeSqlTab)}
                      className="px-2 py-0.5 bg-[#252834] hover:bg-[#34384a] text-[#e9e4d8] border border-[#3e4456] rounded text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copiedIndex === activeSqlTab ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-[#4ade80]" />
                          <span className="text-[#4ade80]">已复制 SQL</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3 text-[#6b7cff]" />
                          <span>一键复制 SQL</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="text-emerald-400 leading-relaxed font-mono whitespace-pre-wrap select-all">
                    {D1_SQL_SCRIPTS[activeSqlTab].sql}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search, Filter & Quick-Select Toolbar */}
        <div className="p-3 bg-[#1e2026] border-b border-[#33363f] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜索课程名称或作业关键词..."
                className="w-full bg-[#141518] border border-[#3a3d46] rounded py-1.5 pl-8 pr-3 text-xs text-[#e9e4d8] placeholder:text-[#63605a] outline-none focus:border-[#6b7cff]"
              />
              <Search className="w-3.5 h-3.5 text-[#8f8b80] absolute left-2.5 top-1/2 -translate-y-1/2" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8f8b80] hover:text-[#e9e4d8] cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Course Filter Dropdown */}
            <select
              value={selectedCourseFilter}
              onChange={e => setSelectedCourseFilter(e.target.value)}
              className="bg-[#141518] border border-[#3a3d46] text-xs text-[#e9e4d8] py-1.5 px-2 rounded outline-none cursor-pointer max-w-[140px]"
            >
              <option value="all">全部课程 ({templates.length})</option>
              {courseNames.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              disabled={filteredTemplates.length === 0}
              className="px-2.5 py-1.5 bg-[#252834] hover:bg-[#303444] text-[#e9e4d8] border border-[#3e4456] rounded text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40 transition-colors"
            >
              {filteredTemplates.length > 0 &&
              filteredTemplates.every(t => selectedIds.has(t.id)) ? (
                <>
                  <Square className="w-3.5 h-3.5 text-[#8f8b80]" />
                  <span>取消全选</span>
                </>
              ) : (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-[#6b7cff]" />
                  <span>全选过滤项</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleResetPresets}
              className="p-1.5 bg-[#252834] hover:bg-[#303444] text-[#8f8b80] hover:text-[#e9e4d8] border border-[#3e4456] rounded cursor-pointer transition-colors"
              title="重新从服务器拉取官方池"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Assignment Checklist Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-xs text-[#8f8b80] space-y-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#6b7cff]" />
              <span>正在从 D1 官方作业池拉取作业列表...</span>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#8f8b80] space-y-3">
              <AlertCircle className="w-6 h-6 text-[#8f8b80] mx-auto opacity-50" />
              <div className="text-sm font-semibold text-[#c8c5bc]">
                官方作业池当前暂无作业
              </div>

              {isAdmin ? (
                <>
                  <p className="text-xs text-[#8f8b80] max-w-md mx-auto leading-relaxed">
                    当前 D1 官方作业池保持纯净空白。作为管理员，您可以点击下方按钮，将管理员账号 (admin) 录入的作业一键转存至官方作业池，并可一键广播下发给全员。
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      disabled={adminOperating}
                      onClick={handleSyncAdminToPool}
                      className="px-3.5 py-1.5 bg-[#6b7cff] hover:bg-[#5868e6] text-white rounded font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>将管理员 (admin) 作业转存入官方池</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowAdminPanel(true);
                        setShowSqlDrawer(true);
                      }}
                      className="px-3 py-1.5 bg-[#252834] hover:bg-[#303444] text-[#e9e4d8] border border-[#3a3e50] rounded text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Code className="w-3.5 h-3.5 text-[#6b7cff]" />
                      <span>查看 D1 SQL 脚本</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleResetPresets}
                      className="px-3 py-1.5 bg-[#1f2229] hover:bg-[#282c35] text-[#8f8b80] hover:text-[#e9e4d8] rounded text-xs flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>重新刷新</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-[#8f8b80] max-w-md mx-auto leading-relaxed">
                    管理员或教师尚未向全员下发新的课程作业任务。请等待任课教师或管理员发布后，点击下方按钮刷新同步。
                  </p>
                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      onClick={handleResetPresets}
                      className="px-4 py-2 bg-[#252834] hover:bg-[#303444] text-[#e9e4d8] border border-[#3a3e50] rounded text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[#6b7cff]" />
                      <span>刷新官方作业池</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTemplates.map(item => {
                const isSelected = selectedIds.has(item.id);
                const existing = isItemExisting(item.course, item.title);

                return (
                  <div
                    key={item.id}
                    onClick={() => toggleSelect(item.id)}
                    className={`p-3 rounded border transition-all cursor-pointer flex items-start gap-3 select-none ${
                      isSelected
                        ? 'bg-[#222530] border-[#6b7cff]/80 shadow-xs'
                        : 'bg-[#191b20] border-[#2f323c] opacity-75 hover:opacity-100 hover:border-[#444857]'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-[#6b7cff]" />
                      ) : (
                        <Square className="w-4 h-4 text-[#63605a]" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-xs text-[#e9e4d8] bg-[#2a2d38] px-2 py-0.5 rounded border border-[#3a3d4a]">
                          {item.course}
                        </span>

                        {existing ? (
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/15 text-amber-300 border border-amber-500/40 rounded font-mono font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            已存在 · 勾选将覆盖更新
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-700/40 text-slate-300 border border-slate-600/50 rounded font-mono font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            未导入
                          </span>
                        )}

                        {item.due && (
                          <span className="text-[10px] font-mono text-[#8f8b80] flex items-center gap-1 ml-auto">
                            <Calendar className="w-3 h-3 text-[#6b7cff]" />
                            <span>截止: {item.due}</span>
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-semibold text-[#e9e4d8] break-words">
                        {item.title}
                      </div>

                      <div className="flex items-center justify-between mt-1 text-[10px] font-mono text-[#63605a]">
                        <span>发布源: {item.creator || '管理员'}</span>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              handleDeletePoolItem(item.id);
                            }}
                            className="p-1 text-[#8f8b80] hover:text-[#ff6b57] hover:bg-[#ff6b57]/15 rounded transition-colors cursor-pointer"
                            title="从官方作业池移除此条目 (管理员)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Summary & Action Buttons */}
        <div className="border-t-2 border-[#e9e4d8] p-3 sm:p-4 bg-[#24262c] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-[#8f8b80] flex items-center gap-2 flex-wrap">
            <span>
              已选 <strong className="text-[#e9e4d8]">{stats.totalSelected}</strong> 项
            </span>
            <span>·</span>
            <span>
              新增 <strong className="text-emerald-400">{stats.newCount}</strong>
            </span>
            <span>·</span>
            <span>
              覆盖更新 <strong className="text-amber-400">{stats.updatedCount}</strong>
            </span>
            <span className="text-[11px] text-[#63605a] hidden sm:inline">
              （更新将保留您已完成的打勾状态）
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-1.5 border border-[#444] hover:bg-[#333] text-[#e9e4d8] text-xs rounded cursor-pointer transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              disabled={importing || stats.totalSelected === 0}
              onClick={handleImport}
              className="flex-1 sm:flex-initial px-5 py-1.5 bg-[#6b7cff] hover:bg-[#5868e6] disabled:opacity-40 text-white font-bold text-xs rounded transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
            >
              {importing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>正在同步导入...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>导入选中作业 ({stats.totalSelected})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
