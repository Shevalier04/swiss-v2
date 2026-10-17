import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Globe,
  Mic,
  Volume2,
  Bell,
  Radio,
  Vibrate,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  Info,
  Sparkles,
  Activity,
  Play,
  X,
} from 'lucide-react';
import { playReminderBeep } from '../utils/audio';
import { isQuarkBrowser } from '../utils/pushManager';

interface BrowserDoctorModalProps {
  isOpen: boolean;
  onClose: () => void;
  toast: (msg: string) => void;
}

interface ApiDiagnosis {
  id: string;
  name: string;
  category: 'audio' | 'notification' | 'system';
  supported: boolean;
  permission?: 'granted' | 'denied' | 'default' | 'unsupported';
  description: string;
  statusText: string;
  statusLevel: 'success' | 'warning' | 'error';
  fixTip?: string;
  testActionName?: string;
}

export const BrowserDoctorModal: React.FC<BrowserDoctorModalProps> = ({
  isOpen,
  onClose,
  toast,
}) => {
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Active testing states
  const [micTesting, setMicTesting] = useState(false);
  const [micVolume, setMicVolume] = useState<number>(0);
  const [micTestResult, setMicTestResult] = useState<string | null>(null);
  const [audioTesting, setAudioTesting] = useState(false);
  const [vibrateTesting, setVibrateTesting] = useState(false);

  // Diagnostics state
  const [browserInfo, setBrowserInfo] = useState<{
    name: string;
    isQuark: boolean;
    isHuawei: boolean;
    isChrome: boolean;
    isSafari: boolean;
    isWeChat: boolean;
    isMobile: boolean;
    isSecure: boolean;
    userAgent: string;
  }>({
    name: '检测中...',
    isQuark: false,
    isHuawei: false,
    isChrome: false,
    isSafari: false,
    isWeChat: false,
    isMobile: false,
    isSecure: true,
    userAgent: '',
  });

  const [diagnostics, setDiagnostics] = useState<ApiDiagnosis[]>([]);

  // Run comprehensive diagnosis
  const runDiagnosis = () => {
    if (typeof window === 'undefined') return;

    setIsRefreshing(true);
    const ua = (navigator.userAgent || '').toLowerCase();
    const isMobile = /mobile|android|iphone|ipad|phone/i.test(ua);
    const isQuark = isQuarkBrowser();
    const isHuawei = /huaweibrowser|huawei|harmonyos|honor/i.test(ua);
    const isChrome = /chrome|crios/i.test(ua) && !isQuark && !/edg/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/chrome|crios|android/i.test(ua);
    const isWeChat = /micromessenger/i.test(ua);
    const isSecure = window.isSecureContext ?? (window.location.protocol === 'https:' || window.location.hostname === 'localhost');

    let browserName = '标准浏览器';
    if (isQuark) browserName = '夸克浏览器 (Quark Mobile)';
    else if (isHuawei) browserName = '华为/鸿蒙自带浏览器 (Huawei Browser)';
    else if (isWeChat) browserName = '微信内置 Webview';
    else if (/mqqbrowser/i.test(ua)) browserName = 'QQ 手机浏览器';
    else if (/ucbrowser/i.test(ua)) browserName = 'UC 手机浏览器';
    else if (/edg/i.test(ua)) browserName = 'Microsoft Edge';
    else if (isChrome) browserName = 'Google Chrome';
    else if (isSafari) browserName = 'iOS Safari 浏览器';

    setBrowserInfo({
      name: browserName,
      isQuark,
      isHuawei,
      isChrome,
      isSafari,
      isWeChat,
      isMobile,
      isSecure,
      userAgent: navigator.userAgent,
    });

    const items: ApiDiagnosis[] = [];

    // 1. getUserMedia (麦克风音源采集)
    const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    items.push({
      id: 'get_user_media',
      name: '麦克风音频采集 (getUserMedia)',
      category: 'audio',
      supported: hasGetUserMedia,
      description: 'AI 语音添加作业、日程与语音备忘录的基础录音通道',
      statusText: hasGetUserMedia ? '支持录音采集 ✓' : '接口受限或未开放 ✕',
      statusLevel: hasGetUserMedia ? 'success' : 'error',
      fixTip: !isSecure
        ? '因安全规范，移动端必须在 HTTPS 安全网址下才能开放麦克风'
        : '请在手机浏览器地址栏点击锁头/设置图标，将麦克风设为允许',
      testActionName: '测试麦克风收音',
    });

    // 2. Web Audio API (AudioContext)
    const hasAudioContext = typeof window !== 'undefined' && !!(window.AudioContext || (window as any).webkitAudioContext);
    items.push({
      id: 'web_audio_api',
      name: 'Web Audio API 音频引擎',
      category: 'audio',
      supported: hasAudioContext,
      description: '提供 16kHz 无损音频编码、音波频谱可视化与课前提示蜂鸣',
      statusText: hasAudioContext ? '完整支持 ✓' : '当前内核未搭载 ✕',
      statusLevel: hasAudioContext ? 'success' : 'error',
      fixTip: '若该接口缺失，部分降噪与声波频谱可能无法渲染，建议切换标准浏览器',
      testActionName: '试听提示蜂鸣音',
    });

    // 3. W3C Notification API (系统通知栏)
    const hasNotification = typeof window !== 'undefined' && 'Notification' in window;
    const notifPerm: NotificationPermission | 'unsupported' = hasNotification ? Notification.permission : 'unsupported';
    items.push({
      id: 'notification_api',
      name: 'W3C 系统通知 (Notification API)',
      category: 'notification',
      supported: hasNotification,
      permission: notifPerm,
      description: '课前 10 分钟在手机系统通知栏弹出横幅与声音',
      statusText: !hasNotification
        ? isQuark
          ? '夸克内核已精简（自动降级为应用内强提醒+震动）'
          : '当前浏览器不支持原生系统通知'
        : notifPerm === 'granted'
        ? '已授权允许系统通知 ✓'
        : notifPerm === 'denied'
        ? '通知已被浏览器设为拦截 ✕'
        : '待授权 (需在弹窗中允许)',
      statusLevel: !hasNotification
        ? isQuark
          ? 'warning'
          : 'error'
        : notifPerm === 'granted'
        ? 'success'
        : notifPerm === 'denied'
        ? 'error'
        : 'warning',
      fixTip: isQuark
        ? '夸克浏览器移除了系统通知栏接口；如需息屏锁屏横幅通知，建议使用手机自带浏览器'
        : notifPerm === 'denied'
        ? '在浏览器网址栏点击锁形图标 ➔ 权限 ➔ 将通知改为“允许”'
        : undefined,
      testActionName: '测试通知或震动',
    });

    // 4. Web Push & Service Worker (锁屏离线推送)
    const hasSW = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
    const hasPush = typeof window !== 'undefined' && 'PushManager' in window && hasSW;
    items.push({
      id: 'push_manager',
      name: 'Web Push 离线推送 (PushManager)',
      category: 'notification',
      supported: hasPush,
      description: '手机完全黑屏休眠/切到后台时，由云端直接唤醒手机弹出提醒',
      statusText: hasPush
        ? '支持锁屏云端唤醒推送 ✓'
        : isHuawei
        ? '华为/鸿蒙设备（推荐本地守护与保活）'
        : '当前环境不支持 Web Push',
      statusLevel: hasPush ? 'success' : 'warning',
      fixTip: '手机自带浏览器（华为、小米、Chrome）支持完整的 Web Push 离线推送通道',
    });

    // 5. Vibration API (物理震动)
    const hasVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;
    items.push({
      id: 'vibration_api',
      name: '手机物理震动 (Vibrate API)',
      category: 'system',
      supported: hasVibrate,
      description: '提醒到达时触发手机马达物理震动反馈',
      statusText: hasVibrate ? '支持物理震动反馈 ✓' : '设备或浏览器不支持震动',
      statusLevel: hasVibrate ? 'success' : 'warning',
      testActionName: '测试手机物理震动',
    });

    // 6. Secure Context (HTTPS)
    items.push({
      id: 'secure_context',
      name: 'HTTPS 安全运行环境 (Secure Context)',
      category: 'system',
      supported: isSecure,
      description: 'W3C 规范要求：麦克风、通知、PWA 必须在 HTTPS 环境下运行',
      statusText: isSecure ? '安全加密运行环境 (HTTPS) ✓' : '非安全环境 (HTTP) ✕',
      statusLevel: isSecure ? 'success' : 'error',
      fixTip: !isSecure ? '请务必通过 https:// 开头的网址访问，否则浏览器将强制封锁麦克风与通知权限' : undefined,
    });

    setDiagnostics(items);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 400);
  };

  useEffect(() => {
    if (isOpen) {
      runDiagnosis();
      setMicTestResult(null);
      setMicVolume(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Action: Copy Current URL
  const handleCopyUrl = () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(() => {
          setCopied(true);
          toast('课表网址已成功复制到剪贴板！');
          setTimeout(() => setCopied(false), 2500);
        })
        .catch(() => {
          prompt('请复制当前课表网址并在手机自带浏览器打开：', url);
        });
    } else {
      prompt('请复制当前课表网址并在手机自带浏览器打开：', url);
    }
  };

  // Action: Test Microphone live soundwave
  const handleTestMic = async () => {
    if (micTesting) return;
    setMicTesting(true);
    setMicTestResult(null);
    setMicVolume(0);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('当前浏览器未开放麦克风接口');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let maxVol = 0;
      let count = 0;

      const interval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = Math.round(sum / dataArray.length);
        setMicVolume(avg);
        if (avg > maxVol) maxVol = avg;
        count++;

        if (count >= 30) {
          clearInterval(interval);
          stream.getTracks().forEach(t => t.stop());
          ctx.close().catch(() => {});
          setMicTesting(false);
          if (maxVol > 3) {
            setMicTestResult(`测试成功！麦克风灵敏感应到环境音量（峰值: ${maxVol}），语音功能可正常运行！`);
            toast('麦克风测试成功，收音正常！');
          } else {
            setMicTestResult('未检测到明显发音，请尝试说话或将嘴唇靠近手机底部麦克风。');
          }
        }
      }, 100);
    } catch (err: any) {
      setMicTesting(false);
      setMicTestResult(`麦克风测试失败: ${err.message || '权限被拦截或设备不可用'}`);
      toast('麦克风权限被拦截或未开放');
    }
  };

  // Action: Test Web Audio Playback
  const handleTestAudio = () => {
    setAudioTesting(true);
    playReminderBeep();
    toast('已播放 Web Audio 测试蜂鸣！如听到清脆提示音，说明音频引擎正常。');
    setTimeout(() => setAudioTesting(false), 800);
  };

  // Action: Test Vibration
  const handleTestVibrate = () => {
    setVibrateTesting(true);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([200, 100, 200, 100, 300]);
        toast('手机已触发物理震动反馈！');
      } catch {
        toast('震动调用异常，请确认手机未开启静音免打扰');
      }
    } else {
      toast('当前浏览器或硬件不支持物理震动 API');
    }
    setTimeout(() => setVibrateTesting(false), 1000);
  };

  // Compute Overall Rating
  const audioOk = diagnostics.find(d => d.id === 'get_user_media')?.supported;
  const webAudioOk = diagnostics.find(d => d.id === 'web_audio_api')?.supported;
  const notifOk = diagnostics.find(d => d.id === 'notification_api')?.supported;

  const isFullSupported = audioOk && webAudioOk && notifOk;
  const isPartiallyRestricted = browserInfo.isQuark || !notifOk || !audioOk;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-[#1b1d24] border-2 border-[#6b7cff] rounded-xl max-w-xl w-full flex flex-col shadow-2xl text-[#e9e4d8] overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#2d303a] flex items-center justify-between bg-[#15171e] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#6b7cff]/20 border border-[#6b7cff]/40 flex items-center justify-center text-[#6b7cff]">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-editorial font-bold text-base sm:text-lg text-[#e9e4d8] leading-tight flex items-center gap-2">
                <span>浏览器兼容性与能力诊断</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#6b7cff]/20 text-[#8ea4ff]">
                  DOCTOR
                </span>
              </h3>
              <p className="text-[11px] text-[#8f8b80] mt-0.5">
                实时检测 Web Audio、麦克风与 Notification 接口就绪状态
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
          {/* Top Overall Verdict Card */}
          <div className="bg-[#16181f] border border-[#2e313d] rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#262832] pb-3">
              <div>
                <div className="text-[11px] text-[#8f8b80]">当前运行浏览器：</div>
                <div className="font-bold text-sm text-[#e9e4d8] mt-0.5 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[#6b7cff]" />
                  <span>{browserInfo.name}</span>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                {isFullSupported ? (
                  <span className="px-2.5 py-1 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>满分兼容标准内核</span>
                  </span>
                ) : isPartiallyRestricted ? (
                  <span className="px-2.5 py-1 rounded bg-[#d99a2b]/20 border border-[#d99a2b]/40 text-[#f5ba42] font-bold text-xs flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>部分内核功能受限</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded bg-[#ff6b57]/20 border border-[#ff6b57]/40 text-[#ff8f80] font-bold text-xs flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>严重受限内核</span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={runDiagnosis}
                  disabled={isRefreshing}
                  className="px-2.5 py-1 rounded bg-[#242732] hover:bg-[#303444] border border-[#3e4254] text-[#e9e4d8] text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  title="重新全项检测"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">重新检测</span>
                </button>
              </div>
            </div>

            {/* Browser Specific Tips */}
            {browserInfo.isQuark && (
              <div className="bg-[#d99a2b]/10 border border-[#d99a2b]/30 p-2.5 rounded-lg text-[11.5px] text-[#e0b769] space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Info className="w-4 h-4 shrink-0 text-[#d99a2b]" />
                  <span>夸克浏览器诊断分析：</span>
                </div>
                <p className="text-[#a8a399] leading-relaxed">
                  检测到您使用的是<strong>夸克浏览器</strong>。夸克内核支持 Web Audio 蜂鸣与基础录音，但<strong>屏蔽了 W3C 原生系统通知栏接口</strong>。本应用已为您自动降级开启【应用内悬浮横幅 + 手机物理震动】。若您需要<strong>息屏锁屏离线推送</strong>或更稳定的语音输入，推荐复制网址切换至手机自带浏览器。
                </p>
              </div>
            )}

            {browserInfo.isWeChat && (
              <div className="bg-[#ff6b57]/10 border border-[#ff6b57]/30 p-2.5 rounded-lg text-[11.5px] text-[#ff8f80] space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-[#ff6b57]" />
                  <span>微信内置浏览器受限警示：</span>
                </div>
                <p className="text-[#a8a399] leading-relaxed">
                  微信内置 Webview 限制了网页麦克风与系统通知权限。请点击右上角<strong>【···】</strong>并选择<strong>【在浏览器打开】</strong>。
                </p>
              </div>
            )}

            {/* One-Click Copy Current URL Feature */}
            <div className="pt-1">
              <div className="bg-[#1c202a] border border-[#373b4a] rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="space-y-0.5">
                  <div className="font-bold text-[#e9e4d8] flex items-center gap-1.5 text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-[#6b7cff]" />
                    <span>推荐切换到标准浏览器内核</span>
                  </div>
                  <div className="text-[11px] text-[#8f8b80]">
                    支持完整语音识别、Web Audio 与锁屏推送（华为/小米自带浏览器、Chrome、Edge、Safari）
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className={`py-2 px-3.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shrink-0 ${
                    copied
                      ? 'bg-emerald-500 text-white'
                      : 'bg-[#6b7cff] hover:bg-[#5868e6] text-white shadow-[#6b7cff]/20'
                  }`}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? '已复制网址！' : '一键复制当前网址'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Microphone & Audio Test Area */}
          <div className="bg-[#16181f] border border-[#2e313b] rounded-xl p-4 space-y-3">
            <div className="font-editorial font-bold text-sm text-[#e9e4d8] flex items-center gap-2">
              <Mic className="w-4 h-4 text-[#6b7cff]" />
              <span>核心多媒体 API 实测工具</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Mic Test Button */}
              <button
                type="button"
                onClick={handleTestMic}
                disabled={micTesting}
                className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  micTesting
                    ? 'bg-red-500/15 border-red-500 text-red-300'
                    : 'bg-[#1e2028] border-[#313442] hover:border-[#6b7cff] text-[#e9e4d8]'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-xs flex items-center gap-1">
                    <Mic className="w-3.5 h-3.5 text-[#6b7cff]" />
                    麦克风收音实测
                  </span>
                  {micTesting && <Activity className="w-3.5 h-3.5 text-red-400 animate-pulse" />}
                </div>
                <div className="text-[10.5px] text-[#8f8b80] mt-1.5">
                  {micTesting ? `实时音量: ${micVolume}` : '实录 3 秒声波检测'}
                </div>
              </button>

              {/* Web Audio Test Button */}
              <button
                type="button"
                onClick={handleTestAudio}
                disabled={audioTesting}
                className="p-3 rounded-lg border border-[#313442] hover:border-[#6b7cff] bg-[#1e2028] text-left flex flex-col justify-between transition-all cursor-pointer text-[#e9e4d8]"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-xs flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5 text-[#4ade80]" />
                    Web Audio 发声实测
                  </span>
                  <Play className="w-3 h-3 text-[#4ade80]" />
                </div>
                <div className="text-[10.5px] text-[#8f8b80] mt-1.5">
                  播放课前清脆蜂鸣
                </div>
              </button>

              {/* Vibration Test Button */}
              <button
                type="button"
                onClick={handleTestVibrate}
                disabled={vibrateTesting}
                className="p-3 rounded-lg border border-[#313442] hover:border-[#d99a2b] bg-[#1e2028] text-left flex flex-col justify-between transition-all cursor-pointer text-[#e9e4d8]"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-xs flex items-center gap-1">
                    <Smartphone className="w-3.5 h-3.5 text-[#d99a2b]" />
                    手机物理震动实测
                  </span>
                  <Vibrate className="w-3 h-3 text-[#d99a2b]" />
                </div>
                <div className="text-[10.5px] text-[#8f8b80] mt-1.5">
                  触发马达脉冲震动
                </div>
              </button>
            </div>

            {/* Mic Live Feedback Result */}
            {micTestResult && (
              <div
                className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                  micTestResult.includes('成功')
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                    : 'bg-[#ff6b57]/10 border-[#ff6b57]/40 text-[#ff8f80]'
                }`}
              >
                {micTestResult.includes('成功') ? (
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-[#ff6b57] mt-0.5" />
                )}
                <div className="flex-1 leading-relaxed">{micTestResult}</div>
              </div>
            )}
          </div>

          {/* Diagnostic API Breakdown List */}
          <div className="space-y-2">
            <div className="font-editorial font-bold text-sm text-[#e9e4d8] flex items-center justify-between">
              <span>全项 API 接口就绪状态清单</span>
              <span className="text-[11px] text-[#8f8b80] font-normal">
                共 {diagnostics.length} 项标准接口
              </span>
            </div>

            <div className="divide-y divide-[#282b35] border border-[#2e313b] rounded-xl overflow-hidden bg-[#16181f]">
              {diagnostics.map(item => (
                <div key={item.id} className="p-3.5 space-y-1.5 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="font-bold text-[#e9e4d8] text-xs flex items-center gap-2">
                        <span>{item.name}</span>
                      </div>
                      <div className="text-[11px] text-[#8f8b80]">{item.description}</div>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`px-2 py-0.5 rounded text-[10.5px] font-bold shrink-0 ${
                        item.statusLevel === 'success'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : item.statusLevel === 'warning'
                          ? 'bg-[#d99a2b]/20 text-[#e6b14c] border border-[#d99a2b]/30'
                          : 'bg-[#ff6b57]/20 text-[#ff8f80] border border-[#ff6b57]/30'
                      }`}
                    >
                      {item.statusText}
                    </span>
                  </div>

                  {/* Fix Tip if present */}
                  {item.fixTip && (
                    <div className="text-[11px] text-[#d99a2b] bg-[#d99a2b]/10 p-2 rounded border border-[#d99a2b]/20 flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{item.fixTip}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* How to fix browser settings instruction accordion */}
          <div className="bg-[#16181f] border border-[#2e313b] rounded-xl p-4 space-y-2.5">
            <div className="font-bold text-xs text-[#e9e4d8] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#6b7cff]" />
              <span>常见手机浏览器麦克风与通知权限解除指引：</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-[#a8a399]">
              <div className="p-2.5 bg-[#121318] rounded-lg border border-[#262832] space-y-1">
                <div className="font-bold text-[#e9e4d8] flex items-center gap-1">
                  <span>华为 / 鸿蒙浏览器</span>
                </div>
                <p>
                  点击顶部网址栏<strong>「锁头🔒 / 盾牌」</strong> ➔ 点击<strong>【网站设置】</strong> ➔ 将【麦克风】与【通知】均改为<strong>【允许】</strong>。
                </p>
              </div>

              <div className="p-2.5 bg-[#121318] rounded-lg border border-[#262832] space-y-1">
                <div className="font-bold text-[#e9e4d8] flex items-center gap-1">
                  <span>小米 / MIUI 浏览器</span>
                </div>
                <p>
                  点击网址栏左侧<strong>【盾牌/图标】</strong> ➔ 点击<strong>【网站权限】</strong> ➔ 开启【录音麦克风】与【接收通知】权限。
                </p>
              </div>

              <div className="p-2.5 bg-[#121318] rounded-lg border border-[#262832] space-y-1">
                <div className="font-bold text-[#e9e4d8] flex items-center gap-1">
                  <span>Google Chrome / Edge</span>
                </div>
                <p>
                  点击网址栏左侧<strong>「调整图标 🎚️」</strong> ➔ 点击<strong>【权限】</strong> ➔ 允许麦克风与通知。
                </p>
              </div>

              <div className="p-2.5 bg-[#121318] rounded-lg border border-[#262832] space-y-1">
                <div className="font-bold text-[#e9e4d8] flex items-center gap-1">
                  <span>苹果 iOS Safari</span>
                </div>
                <p>
                  手机进入<strong>【设置】➔【Safari 浏览器】➔【麦克风】</strong>设为允许；通知需通过 Safari 分享按钮【添加到主屏幕】开启。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[#2d303a] bg-[#15171e] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-[#8f8b80]">
            <Info className="w-3.5 h-3.5 text-[#6b7cff]" />
            <span>推荐在手机自带系统浏览器中体验完整功能</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyUrl}
              className="py-1.5 px-3 bg-[#6b7cff]/20 hover:bg-[#6b7cff]/30 border border-[#6b7cff]/40 text-[#8ea4ff] font-bold text-xs rounded transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? '已复制！' : '复制网址'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="py-1.5 px-4 bg-[#2b2d38] hover:bg-[#383b49] text-[#e9e4d8] font-bold text-xs rounded transition-colors cursor-pointer"
            >
              完成诊断并关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
