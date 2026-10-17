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
  ExternalLink,
  ChevronRight,
  Info,
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
  const [isChecking, setIsChecking] = useState(false);
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
        }, 1200);
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
      <div className="bg-[#1f222a] border-2 border-[#ff6b57] rounded-xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl text-[#e9e4d8] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#333644] flex items-center justify-between bg-[#191b22]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#ff6b57]/20 border border-[#ff6b57]/40 flex items-center justify-center text-[#ff6b57]">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-editorial font-bold text-base sm:text-lg text-[#e9e4d8] leading-tight">
                手机浏览器通知拦截解除指引
              </h3>
              <p className="text-[11px] text-[#8f8b80] mt-0.5">
                检测到通知权限处于【被拒绝 / 拦截】状态，请依指引解除
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

        {/* Tab Navigation */}
        <div className="grid grid-cols-4 bg-[#16181e] border-b border-[#2e313d] text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('huawei')}
            className={`py-3 px-1 text-center flex flex-col sm:flex-row items-center justify-center gap-1 transition-all cursor-pointer border-b-2 ${
              activeTab === 'huawei'
                ? 'border-[#ff6b57] text-[#ff6b57] bg-[#222530] font-bold'
                : 'border-transparent text-[#8f8b80] hover:text-[#e9e4d8]'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>华为/鸿蒙</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('chrome')}
            className={`py-3 px-1 text-center flex flex-col sm:flex-row items-center justify-center gap-1 transition-all cursor-pointer border-b-2 ${
              activeTab === 'chrome'
                ? 'border-[#ff6b57] text-[#ff6b57] bg-[#222530] font-bold'
                : 'border-transparent text-[#8f8b80] hover:text-[#e9e4d8]'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Chrome/Edge</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ios')}
            className={`py-3 px-1 text-center flex flex-col sm:flex-row items-center justify-center gap-1 transition-all cursor-pointer border-b-2 ${
              activeTab === 'ios'
                ? 'border-[#ff6b57] text-[#ff6b57] bg-[#222530] font-bold'
                : 'border-transparent text-[#8f8b80] hover:text-[#e9e4d8]'
            }`}
          >
            <Apple className="w-3.5 h-3.5" />
            <span>iOS Safari</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('domestic')}
            className={`py-3 px-1 text-center flex flex-col sm:flex-row items-center justify-center gap-1 transition-all cursor-pointer border-b-2 ${
              activeTab === 'domestic'
                ? 'border-[#ff6b57] text-[#ff6b57] bg-[#222530] font-bold'
                : 'border-transparent text-[#8f8b80] hover:text-[#e9e4d8]'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>微信/其他</span>
          </button>
        </div>

        {/* Tab Content (Scrollable) */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs text-[#a8a399] leading-relaxed">
          {activeTab === 'huawei' && (
            <div className="space-y-3">
              <div className="bg-[#16181d] p-3.5 rounded-lg border border-[#2e313b] space-y-2">
                <div className="font-bold text-[#e9e4d8] flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#ff6b57] text-white text-[11px] font-bold flex items-center justify-center">
                    1
                  </span>
                  <span>最快方式：点击地址栏「锁头 🔒」或「盾牌」图标</span>
                </div>
                <p className="text-[#8f8b80] pl-7 text-[11.5px]">
                  在华为浏览器<strong>最上方的网址栏左侧或右侧</strong>，轻触小锁形图标 ➔ 选择<strong>【网站设置】</strong>或<strong>【权限管理】</strong> ➔ 找到<strong>【通知】</strong>，将其从“禁止/询问”更改为<strong>【允许】</strong>。
                </p>
              </div>

              <div className="bg-[#16181d] p-3.5 rounded-lg border border-[#2e313b] space-y-2">
                <div className="font-bold text-[#e9e4d8] flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#6b7cff] text-white text-[11px] font-bold flex items-center justify-center">
                    2
                  </span>
                  <span>备用方式：手机系统设置 ➔ 开启华为浏览器通知</span>
                </div>
                <p className="text-[#8f8b80] pl-7 text-[11.5px]">
                  打开手机<strong>【设置】</strong> ➔ <strong>【应用和服务】</strong> ➔ <strong>【应用管理】</strong> ➔ 找到<strong>“华为浏览器”</strong> ➔ 点击<strong>【通知管理】</strong> ➔ 开启<strong>【允许通知】</strong>，并勾选<strong>【横幅通知】</strong>与<strong>【锁屏通知】</strong>。
                </p>
              </div>

              <div className="bg-[#16181d] p-3.5 rounded-lg border border-[#2e313b] space-y-2">
                <div className="font-bold text-[#e9e4d8] flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#4ade80] text-[#1d1f24] text-[11px] font-bold flex items-center justify-center">
                    3
                  </span>
                  <span>推荐终极体验：点击菜单「添加到桌面」</span>
                </div>
                <p className="text-[#8f8b80] pl-7 text-[11.5px]">
                  点击华为浏览器底部三道杠菜单 ➔ 选择<strong>【添加到桌面】</strong>。添加到桌面后即拥有专属独立 App 容器，通知常驻且不容易被系统省电机制杀掉。
                </p>
              </div>
            </div>
          )}

          {activeTab === 'chrome' && (
            <div className="space-y-3">
              <div className="bg-[#16181d] p-3.5 rounded-lg border border-[#2e313b] space-y-2">
                <div className="font-bold text-[#e9e4d8] flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#ff6b57] text-white text-[11px] font-bold flex items-center justify-center">
                    1
                  </span>
                  <span>点击地址栏左侧「页面设置 🎚️」或「锁头 🔒」</span>
                </div>
                <p className="text-[#8f8b80] pl-7 text-[11.5px]">
                  在浏览器顶部地址栏最左侧，点击小调节器/锁头图标 ➔ 点击<strong>【权限 (Permissions)】</strong> ➔ 找到<strong>【通知】</strong>并将开关打开为<strong>【允许】</strong>。
                </p>
              </div>

              <div className="bg-[#16181d] p-3.5 rounded-lg border border-[#2e313b] space-y-2">
                <div className="font-bold text-[#e9e4d8] flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#6b7cff] text-white text-[11px] font-bold flex items-center justify-center">
                    2
                  </span>
                  <span>进入浏览器【设置 ➔ 网站设置 ➔ 通知】</span>
                </div>
                <p className="text-[#8f8b80] pl-7 text-[11.5px]">
                  点击右上角<strong>【三个点】菜单</strong> ➔ <strong>【设置】</strong> ➔ 找到<strong>【网站设置】</strong> ➔ <strong>【通知】</strong> ➔ 在“已禁止”列表中找到当前网站，点击进入切换为<strong>【允许】</strong>。
                </p>
              </div>

              <div className="bg-[#16181d] p-3.5 rounded-lg border border-[#2e313b] space-y-2">
                <div className="font-bold text-[#e9e4d8] flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#4ade80] text-[#1d1f24] text-[11px] font-bold flex items-center justify-center">
                    3
                  </span>
                  <span>确认手机安卓系统未关闭 Chrome/Edge 通知</span>
                </div>
                <p className="text-[#8f8b80] pl-7 text-[11.5px]">
                  长按手机桌面的 Chrome 或 Edge 图标 ➔ 点击<strong>【应用信息 ℹ️】</strong> ➔ <strong>【通知管理】</strong> ➔ 确保<strong>“允许通知”</strong>处于开启状态。
                </p>
              </div>
            </div>
          )}

          {activeTab === 'ios' && (
            <div className="space-y-3">
              <div className="p-3 bg-[#6b7cff]/10 border border-[#6b7cff]/40 rounded-lg text-[#8ea4ff] text-[11px] flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  苹果公司 iOS 规范要求：Web 网页通知<strong>必须先将网页「添加到主屏幕」</strong>，才能在系统锁屏和通知中心接收推送通知（需 iOS 16.4 及以上）。
                </span>
              </div>

              <div className="bg-[#16181d] p-3.5 rounded-lg border border-[#2e313b] space-y-2">
                <div className="font-bold text-[#e9e4d8] flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#ff6b57] text-white text-[11px] font-bold flex items-center justify-center">
                    1
                  </span>
                  <span>点击 Safari 底部居中的「分享按钮 📤」</span>
                </div>
                <p className="text-[#8f8b80] pl-7 text-[11.5px]">
                  在 iPhone / iPad 的 Safari 浏览器底部栏中间，点击向上箭头的<strong>【分享】</strong>图标。
                </p>
              </div>

              <div className="bg-[#16181d] p-3.5 rounded-lg border border-[#2e313b] space-y-2">
                <div className="font-bold text-[#e9e4d8] flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#6b7cff] text-white text-[11px] font-bold flex items-center justify-center">
                    2
                  </span>
                  <span>向下滑动选择「添加到主屏幕 ➕」</span>
                </div>
                <p className="text-[#8f8b80] pl-7 text-[11.5px]">
                  在弹出菜单中向下滚动，选择<strong>【添加到主屏幕】</strong>，右上角点击<strong>【添加】</strong>。
                </p>
              </div>

              <div className="bg-[#16181d] p-3.5 rounded-lg border border-[#2e313b] space-y-2">
                <div className="font-bold text-[#e9e4d8] flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#4ade80] text-[#1d1f24] text-[11px] font-bold flex items-center justify-center">
                    3
                  </span>
                  <span>从桌面打开「掌上课表」App 开启通知</span>
                </div>
                <p className="text-[#8f8b80] pl-7 text-[11.5px]">
                  回到手机桌面，点击刚刚添加的<strong>“掌上课表”</strong>图标打开。进入本提醒页面后点击开启，iOS 将自动弹出<strong>“掌上课表 想给您发送通知”</strong>，点击【允许】即可！
                </p>
              </div>
            </div>
          )}

          {activeTab === 'domestic' && (
            <div className="space-y-3">
              <div className="p-3 bg-[#ff6b57]/10 border border-[#ff6b57]/40 rounded-lg text-[#ff8f80] text-[11px] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>微信与 QQ 内置浏览器受平台限制，无法直接弹出系统级锁屏通知！</strong>建议按照下方指引跳转至独立浏览器打开。
                </span>
              </div>

              <div className="bg-[#16181d] p-3.5 rounded-lg border border-[#2e313b] space-y-2">
                <div className="font-bold text-[#e9e4d8] flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#ff6b57] text-white text-[11px] font-bold flex items-center justify-center">
                    1
                  </span>
                  <span>微信 / QQ 中：选择在默认浏览器打开</span>
                </div>
                <p className="text-[#8f8b80] pl-7 text-[11.5px]">
                  点击右上角<strong>【···】</strong>三个点 ➔ 选择<strong>【在浏览器打开】</strong>（推荐选择手机内置浏览器、Chrome 或 Edge）。
                </p>
              </div>

              <div className="bg-[#16181d] p-3.5 rounded-lg border border-[#2e313b] space-y-2">
                <div className="font-bold text-[#e9e4d8] flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#6b7cff] text-white text-[11px] font-bold flex items-center justify-center">
                    2
                  </span>
                  <span>小米 / OPPO / vivo / 夸克 / UC 浏览器</span>
                </div>
                <p className="text-[#8f8b80] pl-7 text-[11.5px]">
                  在地址栏左侧或底部菜单中点击【设置】/【网站权限】 ➔ 找到<strong>【通知】</strong>权限更改为【允许】。如提示被手机管家拦截，可在手机【设置 ➔ 通知与状态栏】中开启该浏览器的通知权限。
                </p>
              </div>
            </div>
          )}

          {/* Detection Result Box if checked */}
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
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[#333644] bg-[#191b22] space-y-2.5">
          <button
            type="button"
            disabled={isChecking}
            onClick={handleRecheck}
            className="w-full py-3 bg-[#ff6b57] hover:bg-[#e05643] text-white font-bold text-xs sm:text-sm tracking-wide rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#ff6b57]/20 disabled:opacity-60"
          >
            {isChecking ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span>
              {isChecking ? '正在重新检测浏览器权限...' : '已完成设置，一键重新检测权限'}
            </span>
          </button>

          <div className="flex items-center justify-between text-[11px] text-[#8f8b80] px-1">
            <span>操作完成后点击上方按钮重新验证</span>
            <button
              type="button"
              onClick={onClose}
              className="hover:text-white underline cursor-pointer"
            >
              暂不设置，关闭窗口
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
