import React, { useRef, useState } from 'react';
import { User, RemindSettings } from '../types';
import { api } from '../services/api';
import {
  Terminal,
  RotateCcw,
  Download,
  Trash2,
  ChevronRight,
  ChevronDown,
  Info,
  FileUp,
  Database,
  Cloud,
  BookOpen,
  Edit3,
  Check,
  X,
} from 'lucide-react';

interface ProfileTabProps {
  user: User;
  remindSettings: RemindSettings;
  pendingHwCount: number;
  pendingTaskCount: number;
  onLogout: () => void;
  onOpenAdmin: () => void;
  onOpenDataManagement?: () => void;
  onSwitchTab: (tab: any) => void;
  onResetTemplate: () => void;
  onExportData: () => void;
  onClearData: () => void;
  onSelectPdfFile: (file: File) => void;
  onUpdateUser?: (updated: User) => void;
  onOpenDoctor?: () => void;
  toast: (msg: string) => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  user,
  remindSettings,
  pendingHwCount,
  pendingTaskCount,
  onLogout,
  onOpenAdmin,
  onOpenDataManagement,
  onSwitchTab,
  onResetTemplate,
  onExportData,
  onClearData,
  onSelectPdfFile,
  onUpdateUser,
  onOpenDoctor,
  toast,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDataPanel, setShowDataPanel] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState(user.name);

  const handleSaveName = () => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      toast('姓名不能为空');
      return;
    }
    const updated = api.updateProfileName(user.username, trimmed);
    if (onUpdateUser) onUpdateUser(updated);
    setIsEditingName(false);
    toast(`姓名已更新为：${trimmed}`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        toast('请选择 .pdf 格式的课表文件');
        return;
      }
      onSelectPdfFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Title */}
      <div className="border-b-[2.5px] border-[#e9e4d8] pb-2">
        <div className="font-editorial text-2xl sm:text-3xl font-extrabold tracking-wide text-[#e9e4d8]">
          我的
        </div>
        <div className="text-[9.5px] font-mono tracking-[3px] text-[#8f8b80] mt-0.5">
          PROFILE & SETTINGS
        </div>
      </div>

      {/* User Card */}
      <div className="flex items-center gap-3.5 border-2 border-[#e9e4d8] bg-[#26282e] p-4 text-[#e9e4d8] shadow-sm">
        <div className="w-13 h-13 bg-[#e9e4d8] text-[#1d1f24] font-editorial text-xl font-extrabold flex items-center justify-center shrink-0 tracking-wider">
          {user.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          {isEditingName && user.role === 'admin' ? (
            <div className="flex items-center gap-1.5 py-0.5">
              <input
                type="text"
                value={editingName}
                onChange={e => setEditingName(e.target.value)}
                placeholder="输入管理员名称"
                className="bg-[#181a1f] border border-[#6b7cff] text-sm text-[#e9e4d8] font-bold px-2 py-1 rounded outline-none w-36"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') setIsEditingName(false);
                }}
              />
              <button
                type="button"
                onClick={handleSaveName}
                className="p-1.5 bg-[#6b7cff] text-white rounded hover:bg-[#5868e6] cursor-pointer"
                title="保存姓名"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsEditingName(false)}
                className="p-1.5 bg-[#33363f] text-[#8f8b80] hover:text-[#e9e4d8] rounded cursor-pointer"
                title="取消"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="font-editorial text-xl font-extrabold truncate text-[#e9e4d8]">{user.name}</div>
              {user.role === 'admin' ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingName(user.name);
                    setIsEditingName(true);
                  }}
                  className="p-1 text-[#8f8b80] hover:text-[#6b7cff] hover:bg-[#6b7cff]/10 rounded transition-colors cursor-pointer"
                  title="管理员修改名称"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              ) : (
                <span className="text-[10px] text-[#4ade80] bg-[#4ade80]/10 border border-[#4ade80]/30 px-1.5 py-0.2 rounded font-mono">
                  已核验 · 终端管理员专管
                </span>
              )}
            </div>
          )}
          <div className="text-xs text-[#8f8b80] mt-0.5 truncate font-mono">
            {user.role === 'admin' ? '系统管理员 · ADMIN' : `学生学号 · ${user.username}`}
          </div>
        </div>
        <button
          onClick={onLogout}
          className="px-3 py-1.5 border-[1.5px] border-[#e9e4d8] text-xs font-bold tracking-wider hover:bg-[#e9e4d8] hover:text-[#1d1f24] transition-colors cursor-pointer shrink-0"
        >
          退出
        </button>
      </div>


      {/* Admin Terminal Entry */}
      {user.role === 'admin' && (
        <div
          onClick={onOpenAdmin}
          className="flex items-center gap-3 bg-[#101216] border border-[#6b7cff]/40 p-4 cursor-pointer hover:border-[#6b7cff] transition-all group"
        >
          <div className="w-9 h-9 rounded bg-[#6b7cff]/20 text-[#6b7cff] flex items-center justify-center shrink-0">
            <Terminal className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-[#e9e4d8] tracking-wide flex items-center gap-2">
              <span>后台终端 · TERMINAL</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-[#6b7cff] text-white font-mono font-bold rounded">
                ROOT
              </span>
            </div>
            <div className="text-xs text-[#8f8b80] mt-0.5">
              CLI 命令行 + 图形化管理全班 42 名学生与课表
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#8f8b80] group-hover:text-[#6b7cff] group-hover:translate-x-0.5 transition-all" />
        </div>
      )}

      {/* Section: Learning */}
      <div>
        <div className="text-[10px] font-bold tracking-[3px] text-[#8f8b80] mb-1 font-mono">
          LEARNING · 学习与日程
        </div>
        <div className="border-t-2 border-[#e9e4d8] divide-y divide-[#2a2d34] text-sm">
          <div
            onClick={() => onSwitchTab('hw')}
            className="flex items-center justify-between py-3.5 cursor-pointer hover:bg-white/[0.03] transition-colors"
          >
            <div>
              <div className="font-semibold text-[#e9e4d8]">全部作业</div>
              <div className="text-xs text-[#8f8b80] mt-0.5">
                支持倒计时并自动在课程表对应时段色块打标
              </div>
            </div>
            <div className="flex items-center gap-2">
              {pendingHwCount > 0 && (
                <span className="text-xs font-bold px-2 py-0.2 bg-[#ff6b57] text-white rounded">
                  {pendingHwCount}
                </span>
              )}
              <ChevronRight className="w-4 h-4 text-[#63605a]" />
            </div>
          </div>

          <div
            onClick={() => onSwitchTab('tasks')}
            className="flex items-center justify-between py-3.5 cursor-pointer hover:bg-white/[0.03] transition-colors"
          >
            <div>
              <div className="font-semibold text-[#e9e4d8]">个人任务</div>
              <div className="text-xs text-[#8f8b80] mt-0.5">随时记录并追踪个人待办事项</div>
            </div>
            <div className="flex items-center gap-2">
              {pendingTaskCount > 0 && (
                <span className="text-xs font-bold px-2 py-0.2 bg-[#6b7cff] text-white rounded">
                  {pendingTaskCount}
                </span>
              )}
              <ChevronRight className="w-4 h-4 text-[#63605a]" />
            </div>
          </div>

          <div
            onClick={() => onSwitchTab('week')}
            className="flex items-center justify-between py-3.5 cursor-pointer hover:bg-white/[0.03] transition-colors"
          >
            <div>
              <div className="font-semibold text-[#e9e4d8]">进入课程表</div>
              <div className="text-xs text-[#8f8b80] mt-0.5">
                查看全学期 1-25 周课表安排，支持自定义编辑
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#63605a]" />
          </div>
        </div>
      </div>

      {/* Section: Widget & Reminder */}
      <div>
        <div className="text-[10px] font-bold tracking-[3px] text-[#8f8b80] mb-1 font-mono">
          WIDGET & ALERTS · 桌面与提醒
        </div>
        <div className="border-t-2 border-[#e9e4d8] divide-y divide-[#2a2d34] text-sm">
          <div
            onClick={() => onSwitchTab('widget')}
            className="flex items-center justify-between py-3.5 cursor-pointer hover:bg-white/[0.03] transition-colors"
          >
            <div>
              <div className="font-semibold text-[#e9e4d8]">今日课程桌面小组件</div>
              <div className="text-xs text-[#8f8b80] mt-0.5">
                深色高颜值挂件 · 实时预览并导出高清 PNG
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#63605a]" />
          </div>

          <div
            onClick={() => onSwitchTab('widget')}
            className="flex items-center justify-between py-3.5 cursor-pointer hover:bg-white/[0.03] transition-colors"
          >
            <div>
              <div className="font-semibold text-[#e9e4d8]">手机系统日历同步</div>
              <div className="text-xs text-[#8f8b80] mt-0.5">
                一键添加/还原日历 · 桌面卡片自动更新与撤销文件恢复
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-bold px-2 py-0.2 rounded ${
                  (() => {
                    try {
                      const raw = localStorage.getItem(`cs_cal_sync_${user.username}`);
                      return raw && JSON.parse(raw)?.synced;
                    } catch (e) {
                      return false;
                    }
                  })()
                    ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                    : 'border border-[#8f8b80] text-[#8f8b80]'
                }`}
              >
                {(() => {
                  try {
                    const raw = localStorage.getItem(`cs_cal_sync_${user.username}`);
                    return raw && JSON.parse(raw)?.synced;
                  } catch (e) {
                    return false;
                  }
                })()
                  ? '已添加'
                  : '未添加'}
              </span>
              <ChevronRight className="w-4 h-4 text-[#63605a]" />
            </div>
          </div>

          <div
            onClick={() => onSwitchTab('remind')}
            className="flex items-center justify-between py-3.5 cursor-pointer hover:bg-white/[0.03] transition-colors"
          >
            <div>
              <div className="font-semibold text-[#e9e4d8]">上课提醒设置</div>
              <div className="text-xs text-[#8f8b80] mt-0.5">
                提前 {remindSettings.lead} 分钟 · 应用内卡片 + 系统通知 + 提示音
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-bold px-2 py-0.2 rounded ${
                  remindSettings.enabled
                    ? 'bg-[#6b7cff] text-white'
                    : 'border border-[#8f8b80] text-[#8f8b80]'
                }`}
              >
                {remindSettings.enabled ? '开' : '关'}
              </span>
              <ChevronRight className="w-4 h-4 text-[#63605a]" />
            </div>
          </div>

          {onOpenDoctor && (
            <div
              onClick={onOpenDoctor}
              className="flex items-center justify-between py-3.5 cursor-pointer hover:bg-white/[0.03] transition-colors"
            >
              <div>
                <div className="font-semibold text-[#e9e4d8] flex items-center gap-1.5">
                  <span>浏览器能力与环境诊断</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-[#6b7cff]/20 text-[#8ea4ff] font-bold rounded">
                    DOCTOR
                  </span>
                </div>
                <div className="text-xs text-[#8f8b80] mt-0.5">
                  自测麦克风收音、Web Audio 蜂鸣、系统通知与物理震动
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#63605a]" />
            </div>
          )}
        </div>
      </div>

      {/* Section: Data Management */}
      <div>
        <div className="text-[10px] font-bold tracking-[3px] text-[#8f8b80] mb-1 font-mono">
          DATA · 数据与云端管理
        </div>
        <div className="border-t-2 border-[#e9e4d8] divide-y divide-[#2a2d34] text-sm">
          {/* Unified Cloud Data Management Modal Entry (Only visible to admin) */}
          {user.role === 'admin' && onOpenDataManagement && (
            <div
              onClick={onOpenDataManagement}
              className="flex items-center justify-between py-3.5 px-3.5 my-1.5 cursor-pointer hover:bg-[#6b7cff]/15 transition-all bg-[#6b7cff]/10 rounded border border-[#6b7cff]/35 shadow-sm group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-[#6b7cff]/20 text-[#6b7cff] flex items-center justify-center shrink-0">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-[#e9e4d8] flex items-center gap-1.5">
                    <span>云端数据管理中心</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-[#6b7cff] text-white font-bold rounded">
                      仅管理员
                    </span>
                  </div>
                  <div className="text-xs text-[#8f8b80] mt-0.5">
                    预设示例填充 · 批量导入 · 备份导出 · 一键重置
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#6b7cff] group-hover:translate-x-0.5 transition-transform" />
            </div>
          )}

          {/* PDF Import Entry */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-between py-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <FileUp className="w-4 h-4 text-[#6b7cff]" />
              <div>
                <div className="font-semibold text-[#e9e4d8]">从教务系统 PDF 导入课表</div>
                <div className="text-xs text-[#8f8b80] mt-0.5">
                  智能解析教务处导出的横版/旋转 PDF 课表
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#63605a]" />
          </div>
          <input
            type="file"
            ref={fileInputRef}
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Collapsible Panel for Quick Local Operations */}
          <div>
            <div
              onClick={() => setShowDataPanel(!showDataPanel)}
              className="flex items-center justify-between py-2.5 cursor-pointer text-xs text-[#8f8b80] hover:text-[#e9e4d8] transition-colors select-none"
            >
              <span className="font-mono text-[11px] tracking-wider">
                {showDataPanel ? '收起快捷操作' : '展开更多快捷操作 (重置/导出/清空)'}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${showDataPanel ? 'rotate-180 text-[#6b7cff]' : ''}`}
              />
            </div>

            {showDataPanel && (
              <div className="pl-2 pb-2 space-y-1.5 border-t border-[#2a2d34]/60 pt-2 text-xs">
                <div
                  onClick={onResetTemplate}
                  className="flex items-center justify-between py-2 cursor-pointer hover:bg-white/[0.03] px-2 rounded transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <RotateCcw className="w-3.5 h-3.5 text-[#d99a2b]" />
                    <span className="text-[#e9e4d8]">恢复预置学期示例课表</span>
                  </div>
                  <span className="text-[10px] text-[#8f8b80] font-mono">恢复默认</span>
                </div>

                <div
                  onClick={onExportData}
                  className="flex items-center justify-between py-2 cursor-pointer hover:bg-white/[0.03] px-2 rounded transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Download className="w-3.5 h-3.5 text-[#4ade80]" />
                    <span className="text-[#e9e4d8]">导出课表数据备份 (JSON)</span>
                  </div>
                  <span className="text-[10px] text-[#8f8b80] font-mono">下载备份</span>
                </div>

                <div
                  onClick={onClearData}
                  className="flex items-center justify-between py-2 cursor-pointer hover:bg-white/[0.03] px-2 rounded transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Trash2 className="w-3.5 h-3.5 text-[#ff6b57]" />
                    <span className="text-[#ff6b57]">清空我的课表与数据</span>
                  </div>
                  <span className="text-[10px] text-[#ff6b57] font-mono">清除全部</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* About */}
      <div className="pt-2 text-center text-xs text-[#63605a] flex items-center justify-center gap-1">
        <Info className="w-3.5 h-3.5" />
        <span>掌上课表 · Swiss Editorial v4.2 手机小程序</span>
      </div>
    </div>
  );
};
