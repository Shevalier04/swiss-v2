import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  Smartphone,
  ShieldAlert,
  Calendar,
  Copy,
  Check,
  RefreshCw,
  Bell,
  Clock,
  Sparkles,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  X,
  Radio,
  Sliders,
  BatteryCharging,
} from 'lucide-react';
import {
  isQuarkBrowser,
  detectNotificationCapability,
  scheduleDelayedLockScreenTest,
} from '../utils/pushManager';
import { Course, Homework } from '../types';
import { downloadCalendarFile } from '../utils/calendarExport';

interface LockScreenTroubleshootModalProps {
  isOpen: boolean;
  onClose: () => void;
  toast: (msg: string) => void;
  studentName?: string;
  courses?: Course[];
  homework?: Homework[];
}

export const LockScreenTroubleshootModal: React.FC<LockScreenTroubleshootModalProps> = ({
  isOpen,
  onClose,
  toast,
  studentName = '同学',
  courses = [],
  homework = [],
}) => {
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const [deviceInfo, setDeviceInfo] = useState<{
    browserName: string;
    isQuark: boolean;
    isHuawei: boolean;
    isXiaomi: boolean;
    isApple: boolean;
    hasNotification: boolean;
    permission: string;
  }>({
    browserName: '检测中...',
    isQuark: false,
    isHuawei: false,
    isXiaomi: false,
    isApple: false,
    hasNotification: false,
    permission: 'unknown',
  });

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const ua = (navigator.userAgent || '').toLowerCase();
    const isQuark = isQuarkBrowser();
    const isHuawei = /huaweibrowser|huawei|harmonyos|honor/i.test(ua);
    const isXiaomi = /xiaomi|miui|redmi/i.test(ua);
    const isApple = /iphone|ipad|ipod|macintosh/i.test(ua);
    const hasNotification = 'Notification' in window;
    const permission = hasNotification ? Notification.permission : 'unsupported';

    let browserName = '常规手机浏览器';
    if (isQuark) browserName = '夸克浏览器 (Quark)';
    else if (isHuawei) browserName = '华为/鸿蒙自带浏览器 (Huawei Browser)';
    else if (isXiaomi) browserName = '小米/MIUI 自带浏览器';
    else if (/micromessenger/i.test(ua)) browserName = '微信内置浏览器';
    else if (isApple && /safari/i.test(ua)) browserName = '苹果 Safari 浏览器';
    else if (/chrome/i.test(ua)) browserName = 'Chrome 浏览器';
    else if (/edg/i.test(ua)) browserName = 'Edge 浏览器';

    setDeviceInfo({
      browserName,
      isQuark,
      isHuawei,
      isXiaomi,
      isApple,
      hasNotification,
      permission,
    });
    setTestResult(null);
  }, [isOpen]);

  if (!isOpen) return null;

  // 1. One-click copy URL
  const handleCopyUrl = () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(() => {
          setCopied(true);
          toast('课表网址已成功复制！请在手机自带浏览器（如华为/小米）打开开启系统推送。');
          setTimeout(() => setCopied(false), 2500);
        })
        .catch(() => {
          prompt('请复制当前课表网址并在手机自带浏览器打开：', url);
        });
    } else {
      prompt('请复制当前课表网址并在手机自带浏览器打开：', url);
    }
  };

  // 2. Export to native system calendar
  const handleExportCalendar = () => {
    try {
      downloadCalendarFile(studentName, courses, homework);
      toast('已下载 .ics 课表日历文件！点击打开即可添加到系统日历并开启锁屏响铃。');
    } catch {
      toast('导出日历失败，请刷新页面重试');
    }
  };

  // 3. 5-Second Delay Lock Screen Test
  const handleStartLockScreenTest = async () => {
    if (isTesting) return;
    setIsTesting(true);
    setTestResult(null);

    const seconds = 5;
    setCountdown(seconds);

    const res = await scheduleDelayedLockScreenTest(seconds);
    toast(res.message);

    let current = seconds;
    const timer = setInterval(() => {
      current -= 1;
      if (current > 0) {
        setCountdown(current);
      } else {
        clearInterval(timer);
        setCountdown(null);
        setIsTesting(false);
        setTestResult(
          deviceInfo.isQuark
            ? '已触发物理震动！因夸克内核限制，无法展示锁屏横幅。如需锁屏横幅，请切换手机自带浏览器或导入系统日历。'
            : '测试通知已发出！若手机黑屏锁屏时未亮屏或未展示横幅，请检查下方【手机系统锁屏通知权限】与【电池休眠设置】。'
        );
      }
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-[#1a1c23] border-2 border-[#ff7043] rounded-xl max-w-xl w-full flex flex-col shadow-2xl text-[#e9e4d8] overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#2d303a] flex items-center justify-between bg-[#15171d] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#ff7043]/20 border border-[#ff7043]/40 flex items-center justify-center text-[#ff7043]">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-editorial font-bold text-base sm:text-lg text-[#e9e4d8] leading-tight flex items-center gap-2">
                <span>为什么还是无法发送锁屏信息？</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#ff7043]/20 text-[#ff8a65]">
                  DIAGNOSTIC
                </span>
              </h3>
              <p className="text-[11px] text-[#8f8b80] mt-0.5">
                深层技术根源剖析 ｜ 4大系统卡点 ｜ 终极100%锁屏响铃方案
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-[#282a35] text-[#8f8b80] hover:text-[#e9e4d8] cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs leading-relaxed custom-scrollbar flex-1">
          {/* Current Browser Verdict Banner */}
          <div className="bg-[#14151a] border border-[#2e313d] rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#242630] pb-3">
              <div>
                <div className="text-[11px] text-[#8f8b80]">当前运行浏览器与设备：</div>
                <div className="font-bold text-sm text-[#e9e4d8] mt-0.5 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[#ff7043]" />
                  <span>{deviceInfo.browserName}</span>
                </div>
              </div>

              {deviceInfo.isQuark ? (
                <span className="px-2.5 py-1 rounded bg-[#ff5722]/20 border border-[#ff5722]/40 text-[#ff8a65] font-bold text-xs flex items-center gap-1.5 self-start sm:self-auto">
                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>夸克内核完全无锁屏通知能力</span>
                </span>
              ) : deviceInfo.permission === 'granted' ? (
                <span className="px-2.5 py-1 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold text-xs flex items-center gap-1.5 self-start sm:self-auto">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>网页已获授权 · 需排查系统级锁屏</span>
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded bg-[#d99a2b]/20 border border-[#d99a2b]/40 text-[#f5ba42] font-bold text-xs flex items-center gap-1.5 self-start sm:self-auto">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>通知权限未完成允许</span>
                </span>
              )}
            </div>

            {/* Quick Diagnostic Summary */}
            <div className="text-[11.5px] leading-relaxed text-[#c7c2b5]">
              {deviceInfo.isQuark ? (
                <div className="space-y-1.5 text-[#ffab91] bg-[#ff5722]/10 p-3 rounded-lg border border-[#ff5722]/30">
                  <div className="font-bold flex items-center gap-1.5 text-[#ff8a65]">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>核心阻断原因：夸克浏览器彻底封锁了系统锁屏通知栏</span>
                  </div>
                  <p className="text-[#d8d2c4]">
                    夸克移动端为极简省流设计，在底层<strong>完全移除了 W3C 标准的 Notification API 与 Web Push 接口</strong>（即使添加至手机桌面也依然受此限制）。网页应用受安卓沙箱隔离，<strong>绝无可能绕过浏览器直接唤醒安卓系统锁屏</strong>。
                  </p>
                  <p className="text-[#a8a399] pt-1">
                    👉 <strong>当前应对方案</strong>：系统已为您自动降级开启<strong>【应用内悬浮横幅 + 手机物理震动 + 提示蜂鸣】</strong>；如需真正的黑屏锁屏横幅通知，请使用下方的自带浏览器切换或系统日历方案。
                  </p>
                </div>
              ) : (
                <div className="space-y-1 text-[#a8a399]">
                  <p>
                    为什么手机息屏时收不到？在支持通知的浏览器中，无法在锁屏收到消息通常是因为<strong>手机操作系统的二次拦截</strong>（国产系统默认禁止浏览器在锁屏显示内容）或<strong>电池休眠杀后台</strong>。请根据下方指引快速排查。
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Interactive Delayed Lock Screen Test Tool */}
          <div className="bg-[#14151a] border border-[#2e313d] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#ff7043]" />
                <h4 className="font-bold text-sm text-[#e9e4d8]">真机锁屏即时测试工具</h4>
              </div>
              <span className="text-[10.5px] font-mono px-2 py-0.5 rounded bg-white/5 text-[#8f8b80]">
                5秒延时测试
              </span>
            </div>

            <p className="text-[11px] text-[#8f8b80]">
              点击下方按钮后，手机将在 5 秒后发送带震动的系统测试通知。<strong>请在点击后立即按下手机电源键锁屏</strong>，直接亲眼检验手机锁屏是否亮屏或弹出横幅！
            </p>

            <button
              type="button"
              disabled={isTesting}
              onClick={handleStartLockScreenTest}
              className={`w-full py-2.5 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                isTesting
                  ? 'bg-[#ff7043] text-white animate-pulse'
                  : 'bg-[#292c37] hover:bg-[#343846] border border-[#ff7043]/50 text-[#ff8a65] hover:text-white'
              }`}
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    倒计时 {countdown} 秒中！👉 请立即按手机电源键锁屏熄屏！
                  </span>
                </>
              ) : (
                <>
                  <Bell className="w-3.5 h-3.5" />
                  <span>启动 5 秒延时测试（点击后立即按电源键锁屏）</span>
                </>
              )}
            </button>

            {testResult && (
              <div className="p-2.5 rounded-lg bg-[#1f222d] border border-[#373b4d] text-[11px] text-[#e0dbcd] leading-relaxed">
                {testResult}
              </div>
            )}
          </div>

          {/* The 4 Major OS Reasons Explained */}
          <div className="space-y-2.5">
            <div className="font-editorial font-bold text-sm text-[#e9e4d8] flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-[#ff7043]" />
              <span>无法发送锁屏信息的 4 大系统级核心卡点</span>
            </div>

            {/* Point 1: Quark / Domestic Browser Core */}
            <div className="bg-[#15171e] border border-[#272a34] rounded-lg p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#e9e4d8] flex items-center gap-1.5 text-xs">
                  <span className="w-4 h-4 rounded-full bg-[#ff7043]/20 text-[#ff7043] text-[10px] flex items-center justify-center font-mono">
                    1
                  </span>
                  <span>第三方浏览器（夸克/UC/微信）内核精简封锁</span>
                </span>
                <span className="text-[10px] text-[#ff7043] font-bold">接口级缺失</span>
              </div>
              <p className="text-[11px] text-[#8f8b80] leading-relaxed">
                夸克、微信等软件内置浏览器没有与安卓系统的 NotificationManager 建立原生通道。网页在这些浏览器里运行时，即便网页代码发送了通知，浏览器也会直接丢弃，根本无法触达手机通知栏。
              </p>
            </div>

            {/* Point 2: System-level Lock Screen Permission (Huawei/Xiaomi/Oppo/Vivo) */}
            <div className="bg-[#15171e] border border-[#272a34] rounded-lg p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#e9e4d8] flex items-center gap-1.5 text-xs">
                  <span className="w-4 h-4 rounded-full bg-[#ff7043]/20 text-[#ff7043] text-[10px] flex items-center justify-center font-mono">
                    2
                  </span>
                  <span>手机系统【锁屏通知】被默认禁止或隐藏（最常见！）</span>
                </span>
                <span className="text-[10px] text-[#eab308] font-bold">系统权限分级</span>
              </div>
              <p className="text-[11px] text-[#8f8b80] leading-relaxed">
                在华为（HarmonyOS）、小米（HyperOS/MIUI）、OPPO、vivo 中，在网页里点击“允许通知”只代表允许了通知中心显示。<strong>国产手机系统默认将浏览器的“锁屏显示”设为关闭或隐藏详情</strong>！
              </p>
              <div className="bg-[#101116] p-2 rounded text-[10.5px] text-[#4ade80] space-y-0.5">
                <div className="font-bold">华为/自带浏览器开启步骤：</div>
                <div>
                  手机【设置】➔【通知和状态栏】（或应用管理 ➔ 浏览器 ➔ 通知管理）➔ 开启<strong>【允许在锁屏上显示】</strong>与<strong>【横幅通知】</strong>。
                </div>
              </div>
            </div>

            {/* Point 3: Battery Optimization Kills Background */}
            <div className="bg-[#15171e] border border-[#272a34] rounded-lg p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#e9e4d8] flex items-center gap-1.5 text-xs">
                  <span className="w-4 h-4 rounded-full bg-[#ff7043]/20 text-[#ff7043] text-[10px] flex items-center justify-center font-mono">
                    3
                  </span>
                  <span>手机锁屏深度休眠清理后台进程（省电策略）</span>
                </span>
                <span className="text-[10px] text-[#60a5fa] font-bold">进程休眠</span>
              </div>
              <p className="text-[11px] text-[#8f8b80] leading-relaxed">
                手机熄屏数分钟后，系统省电机制会自动杀掉后台网页与 Service Worker。若手机切断了后台，本机的定时唤醒便无法执行。
              </p>
              <div className="bg-[#101116] p-2 rounded text-[10.5px] text-[#60a5fa] space-y-0.5">
                <div className="font-bold">解除休眠保活方法：</div>
                <div>
                  手机【设置】➔【电池】➔【耗电排行/应用启动管理】➔ 将浏览器设为<strong>【允许后台活动】</strong>。
                </div>
              </div>
            </div>

            {/* Point 4: Network Barrier for FCM */}
            <div className="bg-[#15171e] border border-[#272a34] rounded-lg p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#e9e4d8] flex items-center gap-1.5 text-xs">
                  <span className="w-4 h-4 rounded-full bg-[#ff7043]/20 text-[#ff7043] text-[10px] flex items-center justify-center font-mono">
                    4
                  </span>
                  <span>Web Push 云端离线推送在中国大陆网络受限</span>
                </span>
                <span className="text-[10px] text-[#a78bfa] font-bold">网络长连接</span>
              </div>
              <p className="text-[11px] text-[#8f8b80] leading-relaxed">
                W3C Web Push 规范中，Chrome 等内核依赖 Google FCM 服务器（fcm.googleapis.com）。在没有 Google 框架或国内网络直连受阻时，云端离线推送通知包无法送达手机。
              </p>
            </div>
          </div>

          {/* Ultimate 100% Solutions: System Calendar & Switch Browser */}
          <div className="bg-gradient-to-br from-[#1b1e2a] to-[#161822] border-2 border-[#4ade80]/60 rounded-xl p-4 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#4ade80]" />
                <h4 className="font-bold text-sm text-[#e9e4d8]">
                  终极 100% 锁屏响铃解决方案（强烈推荐）
                </h4>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#4ade80]/20 text-[#4ade80] font-bold">
                系统最高优先级
              </span>
            </div>

            <p className="text-[11.5px] text-[#a8a399] leading-relaxed">
              受制于浏览器后台休眠？<strong>一键同步至手机系统日历</strong>是解决锁屏通知的杀手级方案！手机系统日历由安卓/iOS系统内核常驻运行，<strong>零依赖网络与网页后台</strong>，开课前 15 分钟直接在锁屏界面响铃+全屏弹窗！
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {/* Option A: System Calendar */}
              <button
                type="button"
                onClick={handleExportCalendar}
                className="py-2.5 px-3 bg-[#4ade80] hover:bg-[#3ec972] text-[#131418] font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-[#4ade80]/20 active:scale-98"
              >
                <Calendar className="w-4 h-4" />
                <span>一键导入系统日历 (享100%锁屏响铃)</span>
              </button>

              {/* Option B: Copy URL for Native Browser */}
              <button
                type="button"
                onClick={handleCopyUrl}
                className="py-2.5 px-3 bg-[#262936] hover:bg-[#323646] border border-[#6b7cff]/50 text-[#8ea4ff] font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? '已复制课表网址！' : '复制网址 ➔ 手机自带浏览器打开'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[#2d303a] bg-[#15171d] flex items-center justify-between shrink-0">
          <div className="text-[11px] text-[#8f8b80] flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-[#ff7043]" />
            <span>推荐夸克用户导入系统日历，彻底摆脱通知栏限制</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-4 bg-[#2b2d38] hover:bg-[#383b49] text-[#e9e4d8] font-bold text-xs rounded transition-colors cursor-pointer"
          >
            了解并关闭
          </button>
        </div>
      </div>
    </div>
  );
};
