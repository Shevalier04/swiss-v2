import React, { useState, useEffect } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Share2, Smartphone, QrCode, Copy, Check, X } from 'lucide-react';
import QRCode from 'qrcode';

export const PWAInstallBar: React.FC = () => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  useEffect(() => {
    if (showQRModal && currentUrl) {
      QRCode.toDataURL(currentUrl, {
        width: 240,
        margin: 1.5,
        color: {
          dark: '#1d1f24',
          light: '#ffffff',
        },
      }).then(url => {
        setQrCodeDataUrl(url);
      }).catch(err => {
        console.warn('QR generation error', err);
      });
    }
  }, [showQRModal, currentUrl]);

  const handleCopy = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isInstalled || dismissed) return null;

  return (
    <>
      <div className="bg-[#24262c] border-b border-[#33363d] px-3 py-2 flex items-center justify-between text-xs text-[#e9e4d8] shadow-md z-30">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#6b7cff]/20 text-[#6b7cff] flex items-center justify-center font-bold text-[11px] border border-[#6b7cff]/40">
            课
          </div>
          <div>
            <div className="font-semibold tracking-wide flex items-center gap-1.5">
              <span>掌上小程序</span>
              <span className="text-[10px] px-1 py-0.2 bg-[#6b7cff]/20 text-[#6b7cff] rounded border border-[#6b7cff]/30">PWA</span>
            </div>
            <div className="text-[10px] text-[#8f8b80]">安装到手机桌面 · 全屏离线秒开</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isInstallable && (
            <button
              onClick={install}
              className="px-2.5 py-1 bg-[#6b7cff] hover:bg-[#5b6cee] text-white rounded font-bold text-[11px] tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Download className="w-3 h-3" />
              安装
            </button>
          )}

          <button
            onClick={() => setShowQRModal(true)}
            className="px-2 py-1 bg-[#33363d] hover:bg-[#3d424c] text-[#e9e4d8] rounded font-medium text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
            title="手机扫码在手机打开"
          >
            <QrCode className="w-3.5 h-3.5 text-[#6b7cff]" />
            <span>扫码/下载</span>
          </button>

          <button
            onClick={() => setShowGuideModal(true)}
            className="px-2 py-1 bg-[#e9e4d8] text-[#1d1f24] hover:bg-white rounded font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Smartphone className="w-3 h-3" />
            <span>安装指引</span>
          </button>

          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-[#8f8b80] hover:text-[#e9e4d8] rounded transition-colors cursor-pointer"
            title="关闭提示"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showQRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-lg bg-[#24262c] border-2 border-[#e9e4d8] p-5 shadow-2xl text-[#e9e4d8] text-center">
            <div className="flex items-center justify-between pb-3 border-b border-[#33363d]">
              <h3 className="font-editorial text-lg font-bold tracking-wide">用手机扫码打开</h3>
              <button
                onClick={() => setShowQRModal(false)}
                className="text-[#8f8b80] hover:text-[#e9e4d8] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 flex flex-col items-center">
              <div className="p-3 bg-white rounded-lg shadow-inner inline-block">
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="课表小程序手机二维码"
                    className="w-44 h-44 object-contain"
                  />
                ) : (
                  <div className="w-44 h-44 flex flex-col items-center justify-center text-xs text-[#8f8b80] bg-gray-50 rounded">
                    <div className="w-6 h-6 border-2 border-[#6b7cff] border-t-transparent rounded-full animate-spin mb-2" />
                    <span>正在本地生成二维码...</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-[#8f8b80] mt-3">
                用手机微信、相机或浏览器扫描上方二维码
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-[#33363d]">
              <button
                onClick={handleCopy}
                className="w-full py-2 bg-[#33363d] hover:bg-[#3d424c] text-[#e9e4d8] font-bold text-xs tracking-wider rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#4ade80]" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? '链接已复制到剪贴板！' : '复制手机访问链接'}
              </button>

              <button
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = '/mobile.html';
                  a.download = '掌上课表-手机单文件版.html';
                  a.click();
                }}
                className="w-full py-2 bg-[#e9e4d8] hover:bg-white text-[#1d1f24] font-bold text-xs tracking-wider rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                下载手机单文件 HTML（免服务器）
              </button>

              <button
                onClick={() => {
                  setShowQRModal(false);
                  setShowGuideModal(true);
                }}
                className="w-full py-2 bg-[#6b7cff] hover:bg-[#5b6cee] text-white font-bold text-xs tracking-wider rounded transition-colors cursor-pointer"
              >
                查看手机主屏幕安装教程
              </button>
            </div>
          </div>
        </div>
      )}

      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-lg bg-[#24262c] border-2 border-[#e9e4d8] p-5 shadow-2xl text-[#e9e4d8] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#33363d]">
              <h3 className="font-editorial text-lg font-bold tracking-wide">如何下载安装到手机桌面</h3>
              <button
                onClick={() => setShowGuideModal(false)}
                className="text-[#8f8b80] hover:text-[#e9e4d8] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 space-y-4 text-xs leading-relaxed text-[#c8c4b8]">
              <div className="border border-[#33363d] rounded p-3 bg-[#1d1f24] space-y-2">
                <div className="font-bold text-[#e9e4d8] flex items-center gap-1.5 text-sm">
                  <span>🍎 苹果手机 (iPhone / iPad)</span>
                </div>
                <div className="space-y-1.5 pl-1">
                  <div>1. 用自带的 <strong>Safari 浏览器</strong> 打开课表链接。</div>
                  <div>
                    2. 点击底部中间的 <strong>分享图标</strong>
                    <Share2 className="inline w-3.5 h-3.5 mx-1 text-[#6b7cff]" />。
                  </div>
                  <div>3. 下滑选择 <strong>「添加到主屏幕」</strong>。</div>
                  <div>4. 点击右上角 <strong>「添加」</strong>，即可全屏无地址栏独立秒开！</div>
                </div>
              </div>

              <div className="border border-[#33363d] rounded p-3 bg-[#1d1f24] space-y-2">
                <div className="font-bold text-[#e9e4d8] flex items-center gap-1.5 text-sm">
                  <span>🤖 安卓手机 (华为/小米/OPPO/vivo等)</span>
                </div>
                <div className="space-y-1.5 pl-1">
                  <div>1. 使用自带浏览器或 <strong>Chrome 浏览器</strong> 打开链接。</div>
                  <div>2. 点击应用顶部的 <strong>「安装」</strong> 按钮，或点击浏览器右上角菜单 <strong>「⋮」</strong>。</div>
                  <div>3. 选择 <strong>「添加到主屏幕」</strong> 或 <strong>「安装应用」</strong>。</div>
                  <div>4. 手机桌面上即会生成独立的「掌上课表」App 图标。</div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleCopy}
                className="w-full py-2 bg-[#33363d] hover:bg-[#3d424c] text-[#e9e4d8] font-bold text-xs tracking-wider rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#4ade80]" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? '链接已复制！' : '复制网址发送到手机'}
              </button>
              <button
                onClick={() => setShowGuideModal(false)}
                className="w-full py-2.5 bg-[#e9e4d8] hover:bg-white text-[#1d1f24] font-bold text-xs tracking-widest rounded transition-colors cursor-pointer"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
