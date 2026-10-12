import React, { useRef } from 'react';
import { User, RemindSettings } from '../types';
import {
  Terminal,
  RotateCcw,
  Download,
  Trash2,
  ChevronRight,
  Info,
  FileUp,
  FolderArchive,
} from 'lucide-react';

interface ProfileTabProps {
  user: User;
  remindSettings: RemindSettings;
  pendingHwCount: number;
  pendingTaskCount: number;
  onLogout: () => void;
  onOpenAdmin: () => void;
  onSwitchTab: (tab: any) => void;
  onResetTemplate: () => void;
  onExportData: () => void;
  onClearData: () => void;
  onSelectPdfFile: (file: File) => void;
  toast: (msg: string) => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  user,
  remindSettings,
  pendingHwCount,
  pendingTaskCount,
  onLogout,
  onOpenAdmin,
  onSwitchTab,
  onResetTemplate,
  onExportData,
  onClearData,
  onSelectPdfFile,
  toast,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          <div className="font-editorial text-xl font-extrabold truncate">{user.name}</div>
          <div className="text-xs text-[#8f8b80] mt-0.5 truncate font-mono">
            {user.role === 'admin' ? '系统管理员 · ADMIN' : `学生 · ${user.username}`}
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
        </div>
      </div>

      {/* Section: Data Management */}
      <div>
        <div className="text-[10px] font-bold tracking-[3px] text-[#8f8b80] mb-1 font-mono">
          DATA · 数据导入与备份
        </div>
        <div className="border-t-2 border-[#e9e4d8] divide-y divide-[#2a2d34] text-sm">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-between py-3.5 cursor-pointer hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <FileUp className="w-4 h-4 text-[#6b7cff]" />
              <div>
                <div className="font-semibold text-[#e9e4d8]">从教务系统 PDF 导入课表</div>
                <div className="text-xs text-[#8f8b80] mt-0.5">
                  智能解析横版或旋转排版教务处导出的 PDF 课表
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

          <div
            onClick={onResetTemplate}
            className="flex items-center justify-between py-3.5 cursor-pointer hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <RotateCcw className="w-4 h-4 text-[#d99a2b]" />
              <div>
                <div className="font-semibold text-[#e9e4d8]">恢复预置学期课表</div>
                <div className="text-xs text-[#8f8b80] mt-0.5">
                  重置恢复为 2026-2027-1 标准班级课表
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#63605a]" />
          </div>

          <div
            onClick={onExportData}
            className="flex items-center justify-between py-3.5 cursor-pointer hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Download className="w-4 h-4 text-[#4ade80]" />
              <div>
                <div className="font-semibold text-[#e9e4d8]">导出课表数据备份 (JSON)</div>
                <div className="text-xs text-[#8f8b80] mt-0.5">备份包含课程、作业和任务的数据</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#63605a]" />
          </div>

          <div
            onClick={() => {
              const a = document.createElement('a');
              a.href = '/course-schedule-github.zip';
              a.download = 'course-schedule-github.zip';
              a.click();
              toast('已开始下载 GitHub 源码包 (ZIP)，可直接上传或推送到 GitHub 储存！');
            }}
            className="flex items-center justify-between py-3.5 cursor-pointer hover:bg-white/[0.03] transition-colors bg-[#232733] border border-[#6b7cff]/30 px-3 rounded mt-1"
          >
            <div className="flex items-center gap-2.5">
              <FolderArchive className="w-4 h-4 text-[#6b7cff]" />
              <div>
                <div className="font-semibold text-[#e9e4d8] flex items-center gap-1.5">
                  <span>导出 GitHub 仓库源码包 (ZIP)</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-[#6b7cff] text-white font-bold rounded">GitHub 储存</span>
                </div>
                <div className="text-xs text-[#8f8b80] mt-0.5">含 README、工作流及完整源码，可一键上传至 GitHub 仓库</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#6b7cff]" />
          </div>

          <div
            onClick={() => {
              const a = document.createElement('a');
              a.href = '/mobile.html';
              a.download = '掌上课表-手机版.html';
              a.click();
              toast('已开始下载手机离线单文件 HTML，发送到微信/QQ点开即可使用！');
            }}
            className="flex items-center justify-between py-3.5 cursor-pointer hover:bg-white/[0.03] transition-colors bg-[#6b7cff]/10 px-2 rounded"
          >
            <div className="flex items-center gap-2.5">
              <Download className="w-4 h-4 text-[#6b7cff]" />
              <div>
                <div className="font-semibold text-[#e9e4d8] flex items-center gap-1.5">
                  <span>下载手机离线单文件 HTML</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-[#6b7cff] text-white font-bold rounded">推荐</span>
                </div>
                <div className="text-xs text-[#8f8b80] mt-0.5">免服务器！发到微信/手机浏览器直接点开永久用</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#6b7cff]" />
          </div>

          <div
            onClick={onClearData}
            className="flex items-center justify-between py-3.5 cursor-pointer hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Trash2 className="w-4 h-4 text-[#ff6b57]" />
              <div>
                <div className="font-semibold text-[#ff6b57]">清空我的课表与数据</div>
                <div className="text-xs text-[#8f8b80] mt-0.5">清空当前账户的所有课程和事项</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#63605a]" />
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
