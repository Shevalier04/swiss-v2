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
} from 'lucide-react';
import { recheckNotificationPermission, NotificationCapability } from '../utils/pushManager';

interface NotificationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPermissionGranted: () => void;
  toast: (msg: string) => void;
}

type BrowserType = 'huawei' | 'chrome' | 'ios' | 'domestic';

export const NotificationGuideModal: React.FC<NotificationGuideModalProps> = ({
  isOpen,
  onClose,
  onPermissionGranted,
  toast,
}) => {
  const [activeTab, setActiveTab] = useState<BrowserType>('huawei');
  const [isRequesting, setIsRequesting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [showManualSteps, setShowManualSteps] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    status: NotificationPermission | 'unsupported';
    message: string;
  } | null>(null);

  // Auto-detect browser to pick default tab
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = (navigator.userAgent || '').toLowerCase();
    if (/iphone|ipad|ipod/i.test(ua)) {
      setActiveTab('ios');
    } else if (/huaweibrowser|huawei|harmonyos|honor/i.test(ua)) {
      setActiveTab('huawei');
    } else if (/micromessenger|mqqbrowser|ucbrowser|quark|baidubrowser/i.test(ua)) {
      setActiveTab('domestic');
    } else {
      setActiveTab('chrome');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Primary Action: One-Click Request Native Permission
  const handleOneClickRequest = async () => {
    setIsRequesting(true);
    setCheckResult(null);

    if (typeof window === 'undefined' || !('Notification' in window)) {
      setIsRequesting(false);
      setCheckResult({
        status: 'unsupported',
        message: '当前浏览器不支持系统通知，建议使用 Chrome / Edge 或将应用添加到主屏幕',
      });
      setShowManualSteps(true);
      return;
    }

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
                系统通知权限开启
              </h3>
              <p className="text-[11px] text-[#8f8b80] mt-0.5">
                一键唤起手机系统原生授权 ｜ 锁屏与课前提醒即达
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
          {/* Top Primary One-Click Card */}
          <div className="bg-[#16181d] border border-[#2e313b] p-4 rounded-xl text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#6b7cff]/20 border border-[#6b7cff] flex items-center justify-center text-[#6b7cff] mx-auto shadow-lg shadow-[#6b7cff]/15">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>

            <div className="space-y-1">
              <h4 className="font-bold text-sm text-[#e9e4d8]">
                点击下方按钮，直接在手机弹出授权
              </h4>
              <p className="text-[11.5px] text-[#8f8b80]">
                系统将直接弹出「掌上课表 想给您发送通知」，点击<strong>【允许】</strong>即可瞬间开启！
              </p>
            </div>

            {/* Direct One-Click Button */}
            <button
              type="button"
              disabled={isRequesting}
              onClick={handleOneClickRequest}
              className="w-full py-3 bg-[#6b7cff] hover:bg-[#5868e6] text-white font-bold text-sm tracking-wide rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#6b7cff]/25 active:scale-98 disabled:opacity-50"
            >
              {isRequesting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              <span>{isRequesting ? '正在唤起手机授权...' : '一键获取系统通知权限'}</span>
            </button>
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
                <span className="font-semibold">点击后没有弹出授权窗口？查看极简设置</span>
              </div>
              {showManualSteps ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showManualSteps && (
              <div className="p-3 border-t border-[#2e313b] space-y-3">
                {/* Compact Browser Tabs */}
                <div className="grid grid-cols-4 bg-[#121317] rounded p-0.5 text-[11px] font-semibold border border-[#262832]">
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
                    Chrome/Edge
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
                <div className="text-[11.5px] leading-relaxed text-[#a8a399] bg-[#121317] p-3 rounded border border-[#262832]">
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
                      微信/QQ 内置浏览器限制系统通知。请点击右上角<strong>【···】</strong>选择<strong>【在浏览器打开】</strong>（推荐使用 Chrome 或 Edge）。
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
                  <span>已完成设置，一键重新检测权限</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-[#333644] bg-[#191b22] flex items-center justify-between">
          <span className="text-[11px] text-[#8f8b80]">点击允许后系统将自动保存</span>
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
