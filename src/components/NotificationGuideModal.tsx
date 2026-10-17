import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Smartphone,
  Globe,
  Apple,
  MessageCircle,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Bell,
  Sparkles,
  ExternalLink,
  Copy,
} from 'lucide-react';
import { recheckNotificationPermission, isQuarkBrowser } from '../utils/pushManager';

interface NotificationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPermissionGranted: () => void;
  toast: (msg: string) => void;
}

type BrowserType = 'quark' | 'huawei' | 'chrome' | 'ios' | 'domestic';

export const NotificationGuideModal: React.FC<NotificationGuideModalProps> = ({
  isOpen,
  onClose,
  onPermissionGranted,
  toast,
}) => {
  const [activeTab, setActiveTab] = useState<BrowserType>('quark');
  const [isRequesting, setIsRequesting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [showManualSteps, setShowManualSteps] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    status: NotificationPermission | 'unsupported';
    message: string;
  } | null>(null);

  const isQuarkEnv =
    typeof window !== 'undefined' &&
    (isQuarkBrowser() || !('Notification' in window));

  // Auto-detect browser to pick default tab
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = (navigator.userAgent || '').toLowerCase();
    if (isQuarkBrowser() || !('Notification' in window)) {
      setActiveTab('quark');
    } else if (/iphone|ipad|ipod/i.test(ua)) {
      setActiveTab('ios');
    } else if (/huaweibrowser|huawei|harmonyos|honor/i.test(ua)) {
      setActiveTab('huawei');
    } else if (/micromessenger|mqqbrowser|ucbrowser|baidubrowser/i.test(ua)) {
      setActiveTab('domestic');
    } else {
      setActiveTab('chrome');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyUrl = () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(() => {
          toast('课表网址已复制！请在手机自带浏览器（如华为/小米/Chrome）中粘贴打开。');
        })
        .catch(() => {
          prompt('请复制当前课表网址：', url);
        });
    } else {
      prompt('请复制当前课表网址：', url);
    }
  };

  // Primary Action: One-Click Request / Activate
  const handleOneClickRequest = async () => {
    setIsRequesting(true);
    setCheckResult(null);

    // 1. Quark / No-Notification Environment -> Seamless Haptic & Sound In-App Activation
    if (isQuarkEnv) {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([250, 100, 250]);
        } catch {}
      }

      setCheckResult({
        status: 'granted',
        message: '🎉 夸克提醒已成功激活！已开启手机物理震动、应用内悬浮横幅与课前蜂鸣。',
      });
      toast('🎉 夸克专属提醒已成功开启！手机已触发物理震动。');
      onPermissionGranted();
      setIsRequesting(false);
      setTimeout(() => {
        onClose();
      }, 1200);
      return;
    }

    // 2. Standard Browser with window.Notification
    try {
      const res = await Notification.requestPermission();
      if (res === 'granted') {
        toast('🎉 系统通知权限已成功获取！');
        onPermissionGranted();
        setTimeout(() => {
          onClose();
        }, 800);
      } else {
        setCheckResult({
          status: res,
          message:
            res === 'denied'
              ? '浏览器曾被设为拦截通知。如未看到系统弹窗，请在地址栏点击锁形图标设为“允许”。'
              : '授权未完成，请再次点击并选择“允许”。',
        });
        setShowManualSteps(true);
      }
    } catch (err: any) {
      console.warn('Native notification request error:', err);
      setCheckResult({
        status: 'denied',
        message: err.message || '申请权限遇到异常，请查看下方手动解除指引',
      });
      setShowManualSteps(true);
    } finally {
      setIsRequesting(false);
    }
  };

  // Secondary Action: Re-check current permission
  const handleRecheck = async () => {
    setIsChecking(true);
    setCheckResult(null);

    if (isQuarkEnv) {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([200, 100, 200]);
        } catch {}
      }
      setCheckResult({
        status: 'granted',
        message: '已为您检测并就绪【夸克专属模式：应用内横幅 + 手机物理震动】！',
      });
      toast('🎉 夸克提醒模式已就绪！');
      onPermissionGranted();
      setTimeout(() => {
        onClose();
      }, 1000);
      setIsChecking(false);
      return;
    }

    try {
      const res = await recheckNotificationPermission();
      setCheckResult({
        status: res.permission,
        message: res.message,
      });

      if (res.permission === 'granted') {
        toast('🎉 检测到通知权限已成功解除并开启！');
        onPermissionGranted();
        setTimeout(() => {
          onClose();
        }, 800);
      }
    } catch (err: any) {
      setCheckResult({
        status: 'denied',
        message: err.message || '检测异常，请稍后重试',
      });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm animate-fade-in select-none">
      <div className="bg-[#1f222a] border-2 border-[#6b7cff] rounded-xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl text-[#e9e4d8] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#333644] flex items-center justify-between bg-[#191b22]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#6b7cff]/20 border border-[#6b7cff]/40 flex items-center justify-center text-[#6b7cff]">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-editorial font-bold text-base sm:text-lg text-[#e9e4d8] leading-tight">
                {isQuarkEnv ? '夸克浏览器 · 提醒通道配置' : '系统通知权限开启'}
              </h3>
              <p className="text-[11px] text-[#8f8b80] mt-0.5">
                {isQuarkEnv
                  ? '夸克专属强提醒 ｜ 手机物理震动 + 悬浮横幅 + 蜂鸣提示'
                  : '一键唤起手机系统原生授权 ｜ 锁屏与课前提醒即达'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#8f8b80] hover:text-white text-lg font-bold p-1.5 rounded hover:bg-white/5 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs text-[#a8a399] leading-relaxed custom-scrollbar">
          {/* Top Primary Action Card */}
          <div className="bg-[#16181d] border border-[#2e313b] p-4 rounded-xl text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#6b7cff]/20 border border-[#6b7cff] flex items-center justify-center text-[#6b7cff] mx-auto shadow-lg shadow-[#6b7cff]/15">
              {isQuarkEnv ? (
                <Smartphone className="w-6 h-6 text-[#d99a2b] animate-bounce" />
              ) : (
                <Sparkles className="w-6 h-6 animate-pulse" />
              )}
            </div>

            <div className="space-y-1">
              <h4 className="font-bold text-sm text-[#e9e4d8]">
                {isQuarkEnv
                  ? '检测到夸克浏览器：一键激活专属强提醒'
                  : '点击下方按钮，直接在手机弹出授权'}
              </h4>
              <p className="text-[11.5px] text-[#8f8b80] leading-relaxed">
                {isQuarkEnv
                  ? '夸克移动端关闭了系统通知通道（即使添加至桌面也无系统通知API）。点击下方立即开启【手机物理震动 + 悬浮横幅 + 课前蜂鸣】！'
                  : '系统将直接弹出「掌上课表 想给您发送通知」，点击【允许】即可瞬间开启！'}
              </p>
            </div>

            {/* Direct Action Button */}
            <button
              type="button"
              disabled={isRequesting}
              onClick={handleOneClickRequest}
              className={`w-full py-3 font-bold text-sm tracking-wide rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-98 disabled:opacity-50 ${
                isQuarkEnv
                  ? 'bg-[#d99a2b] hover:bg-[#c4871f] text-[#1d1f24] shadow-[#d99a2b]/25'
                  : 'bg-[#6b7cff] hover:bg-[#5868e6] text-white shadow-[#6b7cff]/25'
              }`}
            >
              {isRequesting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : isQuarkEnv ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              <span>
                {isRequesting
                  ? '处理中...'
                  : isQuarkEnv
                  ? '一键激活夸克强提醒（震动 + 横幅 + 蜂鸣）'
                  : '一键获取系统通知权限'}
              </span>
            </button>

            {/* In Quark: Native Lock-Screen Recommendation */}
            {isQuarkEnv && (
              <div className="bg-[#121317] border border-[#d99a2b]/30 p-3 rounded-lg text-left space-y-2 mt-2">
                <div className="flex items-center gap-1.5 text-[#d99a2b] font-bold text-xs">
                  <Smartphone className="w-3.5 h-3.5 shrink-0" />
                  <span>💡 想要手机黑屏熄屏时也能收到系统横幅推送？</span>
                </div>
                <p className="text-[11px] text-[#8f8b80] leading-relaxed">
                  因夸克浏览器无法调用安卓系统锁屏通知栏，如需在<strong>手机锁屏黑屏时</strong>收到系统横幅通知，只需复制网址在<strong>手机自带浏览器</strong>打开：
                </p>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="w-full py-2 bg-[#6b7cff]/20 hover:bg-[#6b7cff]/30 border border-[#6b7cff]/50 text-[#8ea4ff] font-bold text-xs rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>一键复制课表网址 ➔ 手机自带浏览器打开 (享锁屏推送)</span>
                </button>
              </div>
            )}
          </div>

          {/* Detection Result Box if checked or errored */}
          {checkResult && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-center gap-2.5 ${
                checkResult.status === 'granted'
                  ? 'bg-[#4ade80]/15 border-[#4ade80] text-[#4ade80]'
                  : 'bg-[#ff6b57]/15 border-[#ff6b57] text-[#ff8f80]'
              }`}
            >
              {checkResult.status === 'granted' ? (
                <CheckCircle className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <div className="flex-1 font-medium">{checkResult.message}</div>
            </div>
          )}

          {/* Collapsible Manual Guide for users who previously chose "Never Allow" */}
          <div className="border border-[#2e313b] rounded-lg overflow-hidden bg-[#16181d]">
            <button
              type="button"
              onClick={() => setShowManualSteps(!showManualSteps)}
              className="w-full p-3 text-xs flex items-center justify-between text-[#8f8b80] hover:text-[#e9e4d8] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-[#6b7cff]" />
                <span className="font-semibold">各浏览器解除拦截与配置指引</span>
              </div>
              {showManualSteps ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showManualSteps && (
              <div className="p-3 border-t border-[#2e313b] space-y-3">
                {/* Compact Browser Tabs */}
                <div className="grid grid-cols-5 bg-[#121317] rounded p-0.5 text-[10.5px] font-semibold border border-[#262832]">
                  <button
                    type="button"
                    onClick={() => setActiveTab('quark')}
                    className={`py-1.5 rounded transition-colors cursor-pointer ${
                      activeTab === 'quark' ? 'bg-[#d99a2b] text-[#1d1f24] font-bold' : 'text-[#8f8b80]'
                    }`}
                  >
                    夸克浏览器
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('huawei')}
                    className={`py-1.5 rounded transition-colors cursor-pointer ${
                      activeTab === 'huawei' ? 'bg-[#6b7cff] text-white font-bold' : 'text-[#8f8b80]'
                    }`}
                  >
                    华为/鸿蒙
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('chrome')}
                    className={`py-1.5 rounded transition-colors cursor-pointer ${
                      activeTab === 'chrome' ? 'bg-[#6b7cff] text-white font-bold' : 'text-[#8f8b80]'
                    }`}
                  >
                    Chrome
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('ios')}
                    className={`py-1.5 rounded transition-colors cursor-pointer ${
                      activeTab === 'ios' ? 'bg-[#6b7cff] text-white font-bold' : 'text-[#8f8b80]'
                    }`}
                  >
                    iOS Safari
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('domestic')}
                    className={`py-1.5 rounded transition-colors cursor-pointer ${
                      activeTab === 'domestic' ? 'bg-[#6b7cff] text-white font-bold' : 'text-[#8f8b80]'
                    }`}
                  >
                    微信/其他
                  </button>
                </div>

                {/* Tab Body */}
                <div className="text-[11.5px] leading-relaxed text-[#a8a399] bg-[#121317] p-3 rounded border border-[#262832] space-y-2">
                  {activeTab === 'quark' && (
                    <div className="space-y-1.5">
                      <p className="font-bold text-[#e9e4d8]">
                        为什么夸克浏览器会提示“不支持 API，即使添加至桌面也不行”？
                      </p>
                      <p>
                        因为夸克移动端为追求极简体验，在内核中裁减了 W3C <code>window.Notification</code> 接口。即使点击“添加至桌面”，生成的快捷方式依然在夸克内部运行，无法唤醒系统通知栏。
                      </p>
                      <p className="font-semibold text-[#d99a2b]">
                        解决方案：本应用已为夸克用户提供专属震动与横幅双重提醒；若您需要系统锁屏通知，点击上方“复制课表网址”并在手机自带浏览器打开即可！
                      </p>
                    </div>
                  )}
                  {activeTab === 'huawei' && (
                    <p>
                      在华为浏览器<strong>最上方网址栏点击「锁头🔒 / 盾牌」</strong> ➔ 点击<strong>【网站设置】</strong> ➔ 将<strong>【通知】</strong>由禁止修改为<strong>【允许】</strong>即可。
                    </p>
                  )}
                  {activeTab === 'chrome' && (
                    <p>
                      在网址栏最左侧点击<strong>「页面设置/锁头 🎚️」</strong> ➔ 点击<strong>【权限】</strong> ➔ 开启<strong>【通知】</strong>开关。
                    </p>
                  )}
                  {activeTab === 'ios' && (
                    <p>
                      苹果 iPhone 规范要求：请点击 Safari 底部<strong>【分享按钮 📤】</strong> ➔ 选择<strong>【添加到主屏幕 ➕】</strong>，随后从桌面打开即可正常接收系统通知。
                    </p>
                  )}
                  {activeTab === 'domestic' && (
                    <p>
                      微信/QQ 内置浏览器限制系统通知。请点击右上角<strong>【···】</strong>选择<strong>【在浏览器打开】</strong>（推荐使用系统自带浏览器或 Chrome）。
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  disabled={isChecking}
                  onClick={handleRecheck}
                  className="w-full py-2 bg-[#252834] hover:bg-[#343849] border border-[#3e4252] text-[#e9e4d8] text-xs font-semibold rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                  <span>{isQuarkEnv ? '重新检测并激活夸克强提醒' : '已完成设置，一键重新检测权限'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-[#333644] bg-[#191b22] flex items-center justify-between">
          <span className="text-[11px] text-[#8f8b80]">
            {isQuarkEnv ? '夸克专属强提醒已就绪' : '点击允许后系统将自动保存'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-[#8f8b80] hover:text-white underline cursor-pointer"
          >
            暂不开启，关闭窗口
          </button>
        </div>
      </div>
    </div>
  );
};
