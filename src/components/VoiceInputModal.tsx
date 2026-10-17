import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Mic,
  MicOff,
  Square,
  Loader2,
  CheckCircle2,
  Sparkles,
  X,
  Volume2,
  RotateCcw,
  Send,
  HelpCircle,
  AlertCircle,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Activity,
  ShieldCheck,
  RefreshCw,
  Globe,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import { api } from '../services/api';
import { parseQuickHomeworkLine, ParsedQuickHomework } from '../utils/assignmentParser';
import { startWavRecording, WavRecorderInstance } from '../utils/wavRecorder';
import { BrowserDoctorModal } from './BrowserDoctorModal';

export interface VoiceInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Mode: 'homework' for assignments, 'task' for todo items
   */
  mode: 'homework' | 'task';
  courseNames?: string[];
  /**
   * Optional ref to parent text input element for focusing on network error fallback
   */
  targetInputRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  /**
   * Callback to focus target text input in parent component
   */
  onFocusTargetInput?: () => void;
  /**
   * Called when user confirms filling text into the input field
   */
  onConfirmText: (text: string) => void;
  /**
   * Optional direct add callback: if provided, user can click "识别并直接添加"
   */
  onDirectAdd?: (text: string, parsedHw?: ParsedQuickHomework | null) => Promise<void> | void;
  toast: (msg: string) => void;
}

export const VoiceInputModal: React.FC<VoiceInputModalProps> = ({
  isOpen,
  onClose,
  mode,
  courseNames = [],
  targetInputRef,
  onFocusTargetInput,
  onConfirmText,
  onDirectAdd,
  toast,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recognizedText, setRecognizedText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDirectAdding, setIsDirectAdding] = useState(false);
  const [showMobileHelp, setShowMobileHelp] = useState(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [isRequestingPerm, setIsRequestingPerm] = useState(false);
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [networkErrorOccurred, setNetworkErrorOccurred] = useState(false);

  const modalInputRef = useRef<HTMLTextAreaElement>(null);

  const handleCopyUrl = () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(() => {
          setCopiedUrl(true);
          toast('课表网址已成功复制！请在手机自带浏览器（如华为/小米/Chrome）中粘贴打开。');
          setTimeout(() => setCopiedUrl(false), 2500);
        })
        .catch(() => {
          prompt('请复制当前课表网址并在手机自带浏览器打开：', url);
        });
    } else {
      prompt('请复制当前课表网址并在手机自带浏览器打开：', url);
    }
  };

  const wavRecorderRef = useRef<WavRecorderInstance | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const volAnimRef = useRef<number | null>(null);
  const maxVolumeRef = useRef<number>(0);

  // Focus parent target input or local textarea
  const triggerFocusInput = useCallback(() => {
    if (onFocusTargetInput) {
      onFocusTargetInput();
    } else if (targetInputRef && targetInputRef.current) {
      try {
        targetInputRef.current.focus();
      } catch (e) {}
    } else if (modalInputRef.current) {
      try {
        modalInputRef.current.focus();
      } catch (e) {}
    }
  }, [onFocusTargetInput, targetInputRef]);

  // Parse result for homework mode
  const parsedPreview = useMemo(() => {
    if (mode !== 'homework' || !recognizedText.trim()) return null;
    return parseQuickHomeworkLine(recognizedText.trim(), courseNames);
  }, [mode, recognizedText, courseNames]);

  // Clean up all audio nodes and recording tracks
  const cleanupRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (volAnimRef.current) {
      cancelAnimationFrame(volAnimRef.current);
      volAnimRef.current = null;
    }
    if (wavRecorderRef.current) {
      try {
        wavRecorderRef.current.cleanup();
      } catch {}
      wavRecorderRef.current = null;
    }
    if (activeStreamRef.current) {
      try {
        activeStreamRef.current.getTracks().forEach(t => t.stop());
      } catch {}
      activeStreamRef.current = null;
    }
    setAudioLevel(0);
    setIsRecording(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      cleanupRecording();
      setRecognizedText('');
      setErrorMsg(null);
      setRecordSeconds(0);
      setShowMobileHelp(false);
      setNetworkErrorOccurred(false);
    }
  }, [isOpen, cleanupRecording]);

  // One-click request permission
  const handleRequestMicPermission = async () => {
    setIsRequestingPerm(true);
    setErrorMsg(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('当前环境未开放麦克风，请确认使用 HTTPS 网址访问');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Release immediately
      stream.getTracks().forEach(t => t.stop());
      setPermissionState('granted');
      toast('麦克风权限已成功获取！');
      // Automatically trigger recording
      setTimeout(() => {
        startRecording();
      }, 300);
    } catch (err: any) {
      console.warn('One-click mic permission error:', err);
      setPermissionState('denied');
      setErrorMsg('未成功获取麦克风权限。请在浏览器地址栏点击锁形/设置图标，允许麦克风访问。');
      setShowMobileHelp(true);
    } finally {
      setIsRequestingPerm(false);
    }
  };

  // Trigger simulated voice recognition demo for presentation / defense
  const handleSimulateVoiceDemo = (customText?: string) => {
    setIsSimulating(true);
    setErrorMsg(null);
    const demoOptions =
      mode === 'homework'
        ? [
            '高数 课后习题P32第1题 @明天',
            '界面设计 交互原型实验报告 @下周三',
            '大学英语 Unit 3 词汇背诵 @周五',
            '计算机网络 Wireshark 抓包实验总结 @周日',
          ]
        : [
            '下午两点准时参加学院线上答辩演示',
            '整理本周各科课堂笔记并上传作业库',
            '去图书馆借阅操作系统第三版参考书',
            '找辅导员盖社会实践证明印章',
          ];

    const targetText =
      customText || demoOptions[Math.floor(Math.random() * demoOptions.length)];

    toast('正在启动模拟语音识别演示 (答辩保底模式)...');

    // Simulate typing effect
    let currentLen = 0;
    const interval = setInterval(() => {
      currentLen += 1;
      setRecognizedText(targetText.slice(0, currentLen));
      if (currentLen >= targetText.length) {
        clearInterval(interval);
        setIsSimulating(false);
        toast('【模拟语音识别演示完成】！要素已智能解析');
      }
    }, 40);
  };

  // Attempt local browser native SpeechRecognition with mic permission check and network fallback
  const tryLocalSpeechRecognition = useCallback((): Promise<string | null> => {
    return new Promise(async resolve => {
      if (typeof window === 'undefined') {
        resolve(null);
        return;
      }

      // Step 1: Pre-check microphone permission before starting SpeechRecognition
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          micStream.getTracks().forEach(track => track.stop());
          setPermissionState('granted');
        }
      } catch (micErr: any) {
        console.warn('Microphone permission check failed prior to SpeechRecognition:', micErr);
        setPermissionState('denied');
        setErrorMsg('麦克风权限未开放，请在手机浏览器设置中放行麦克风');
        setShowMobileHelp(true);
        resolve(null);
        return;
      }

      // Step 2: Check Web Speech API availability
      const SpeechClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechClass) {
        console.warn('Native SpeechRecognition API unavailable on this browser kernel.');
        const fallbackMsg =
          '当前浏览器内置语音服务受网络限制，已为您唤起输入框，请直接点击【手机键盘右上角的麦克风】进行语音输入';
        setErrorMsg(fallbackMsg);
        toast(fallbackMsg);
        setNetworkErrorOccurred(true);
        triggerFocusInput();
        resolve(null);
        return;
      }

      // Step 3: Instantiate and handle errors
      try {
        const recognition = new SpeechClass();
        recognition.lang = 'zh-CN';
        recognition.continuous = false;
        recognition.interimResults = true;

        let resultText = '';
        const startTime = Date.now();

        recognition.onresult = (event: any) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              resultText += event.results[i][0].transcript;
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          const current = resultText || interim;
          if (current) {
            setRecognizedText(current);
          }
        };

        recognition.onerror = (event: any) => {
          const errCode = event.error || 'unknown';
          const elapsed = Date.now() - startTime;
          console.warn(`Local webkitSpeechRecognition error [${errCode}] after ${elapsed}ms:`, event);

          if (
            errCode === 'network' ||
            errCode === 'service-not-allowed' ||
            errCode === 'not-allowed' ||
            elapsed < 4000
          ) {
            setNetworkErrorOccurred(true);
            const friendlyPrompt =
              '当前浏览器内置语音服务受网络限制，已为您唤起输入框，请直接点击【手机键盘右上角的麦克风】进行语音输入';
            setErrorMsg(friendlyPrompt);
            toast(friendlyPrompt);
            triggerFocusInput();
          } else if (errCode === 'no-speech') {
            setErrorMsg('未感应到明显发音，请靠近手机麦克风重新说话或使用下方的模拟演示');
          } else {
            setErrorMsg(`语音识别错误 (${errCode})，已为您切换为手机键盘语音输入`);
            triggerFocusInput();
          }

          resolve(resultText ? resultText.trim() : null);
        };

        recognition.onend = () => {
          resolve(resultText ? resultText.trim() : null);
        };

        recognition.start();
      } catch (err: any) {
        console.warn('Failed to start local SpeechRecognition:', err);
        const fallbackMsg =
          '当前浏览器内置语音服务受网络限制，已为您唤起输入框，请直接点击【手机键盘右上角的麦克风】进行语音输入';
        setErrorMsg(fallbackMsg);
        toast(fallbackMsg);
        setNetworkErrorOccurred(true);
        triggerFocusInput();
        resolve(null);
      }
    });
  }, [triggerFocusInput, toast]);

  // Start recording using universal 16kHz WAV recorder
  const startRecording = async () => {
    setErrorMsg(null);
    setRecognizedText('');
    setRecordSeconds(0);
    maxVolumeRef.current = 0;
    setAudioLevel(0);
    setNetworkErrorOccurred(false);

    if (typeof window === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg(
        '当前浏览器不支持或未开放麦克风接口。请确保使用 HTTPS 安全网址打开，并在浏览器设置中允许麦克风权限。'
      );
      setPermissionState('denied');
      setShowMobileHelp(true);
      return;
    }

    try {
      // 1. Get audio stream with mobile noise suppression & echo cancellation
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      activeStreamRef.current = stream;
      setPermissionState('granted');

      // 2. Initialize pure WAV recorder (AudioContext 16kHz Mono 16-bit)
      const recorder = await startWavRecording(stream);
      wavRecorderRef.current = recorder;

      // 3. Monitor live volume for soundwave visualizer
      const pollVolume = () => {
        if (!wavRecorderRef.current) return;
        const vol = wavRecorderRef.current.getVolumeLevel();
        setAudioLevel(vol);
        if (vol > maxVolumeRef.current) {
          maxVolumeRef.current = vol;
        }
        volAnimRef.current = requestAnimationFrame(pollVolume);
      };
      pollVolume();

      setIsRecording(true);

      // 4. Start timer
      timerRef.current = setInterval(() => {
        setRecordSeconds(sec => sec + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone start error:', err);
      setPermissionState('denied');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('麦克风权限被拒绝，请点击下方“一键获取麦克风权限”按钮重试');
      } else {
        setErrorMsg(`无法启动麦克风: ${err.message || '未知错误'}`);
      }
      setShowMobileHelp(true);
    }
  };



  // Stop recording and send 16kHz WAV to Cloud Dual-Engine (or Local Native Fallback)
  const stopRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (volAnimRef.current) {
      cancelAnimationFrame(volAnimRef.current);
      volAnimRef.current = null;
    }

    setIsRecording(false);
    setAudioLevel(0);

    const recorder = wavRecorderRef.current;
    if (!recorder) return;

    setIsTranscribing(true);
    setErrorMsg(null);

    try {
      const { blob, base64, duration } = await recorder.stop();
      wavRecorderRef.current = null;

      if (activeStreamRef.current) {
        try {
          activeStreamRef.current.getTracks().forEach(t => t.stop());
        } catch {}
        activeStreamRef.current = null;
      }

      if (duration < 0.6 || blob.size < 400) {
        setErrorMsg('录音时间太短，请靠近麦克风清晰说话至少 1 秒后再点击结束');
        setIsTranscribing(false);
        return;
      }

      const forceOffline = typeof localStorage !== 'undefined' && localStorage.getItem('cs_force_offline_speech') === 'true';

      if (forceOffline) {
        toast('正在触发本地内核离线语音识别...');
        const localTxt = await tryLocalSpeechRecognition();
        if (localTxt) {
          setRecognizedText(localTxt);
          toast('【本地内核离线识别成功】！');
          return;
        }
      }

      const prompt =
        mode === 'homework'
          ? '请将这段中文语音内容转录为纯文本，准确保留课程名称（如高数、计网、线代、界面设计等）、作业具体内容（如课后习题、实验报告、P32第1题等）和截止时间（如明天交、周五晚前、10月25日截止等）。直接输出纯文本，不要任何额外解说。'
          : '请将这段语音内容原样转录为待办任务纯文本，直接输出文本内容，不要包含多余解说。';

      // Send pristine 16kHz audio/wav to backend dual-engine
      try {
        const result = await api.transcribeAudio(base64, 'audio/wav', prompt);
        if (result && result.text && result.text.trim()) {
          setRecognizedText(result.text.trim());
          toast('语音识别成功！');
          return;
        } else if (result?.fallbackToLocal) {
          const localTxt = await tryLocalSpeechRecognition();
          if (localTxt) {
            setRecognizedText(localTxt);
            toast('【本地内核离线识别成功】！');
            return;
          }
          setErrorMsg('语音已录制完成。若发音较轻，请靠近手机麦克风大声重试，或直接点击下方预设/输入。');
        } else {
          const localTxt = await tryLocalSpeechRecognition();
          if (localTxt) {
            setRecognizedText(localTxt);
            toast('已通过本地浏览器内核成功识别！');
            return;
          }
          setErrorMsg('未识别到清晰文字，请靠近手机麦克风重新说话');
        }
      } catch (cloudErr: any) {
        console.warn('Cloud transcription error, attempting local browser speech fallback:', cloudErr);
        const localTxt = await tryLocalSpeechRecognition();
        if (localTxt) {
          setRecognizedText(localTxt);
          toast('云端服务异常，已自动为您降级为本地内核语音识别！');
          return;
        }
        const friendlyMsg =
          cloudErr?.message === 'BACKEND_HTML_FALLBACK' || cloudErr?.isFallback
            ? '云端语音服务暂未就绪，请直接打字输入或稍后重试。'
            : (cloudErr?.message || '语音转录遇到问题，请重试或直接打字输入');
        setErrorMsg(friendlyMsg);
      }
    } catch (err: any) {
      console.error('WAV transcription error:', err);
      setErrorMsg(err?.message || '语音转录遇到问题，请重试或直接打字输入');
    } finally {
      setIsTranscribing(false);
    }
  };

  // Handle Preset Quick Click
  const handleApplyPreset = (sampleText: string) => {
    setRecognizedText(sampleText);
    setErrorMsg(null);
  };

  // Confirm and fill into text input
  const handleConfirm = () => {
    const text = recognizedText.trim();
    if (!text) {
      toast('暂无已识别的文本内容');
      return;
    }
    onConfirmText(text);
    onClose();
  };

  // Direct add
  const handleDirectAdd = async () => {
    const text = recognizedText.trim();
    if (!text) {
      toast('暂无已识别的文本内容');
      return;
    }
    if (onDirectAdd) {
      setIsDirectAdding(true);
      try {
        await onDirectAdd(text, parsedPreview);
        toast(`已直接添加：${text}`);
        onClose();
      } catch (err: any) {
        toast(err.message || '添加失败');
      } finally {
        setIsDirectAdding(false);
      }
    } else {
      onConfirmText(text);
      onClose();
    }
  };

  if (!isOpen) return null;

  const homeworkPresets = [
    '高数 课后习题P32 @明天',
    '界面设计 实验报告下周三前交',
    '大学英语 Unit 3 核心词汇背诵 @周五',
    '计算机网络 抓包实验总结 @周日晚',
  ];

  const taskPresets = [
    '下午去图书馆借阅操作系统参考书',
    '找辅导员盖社会实践证明印章',
    '晚上八点参加学院线上考研讲座',
    '整理本周各科课堂笔记',
  ];

  const currentPresets = mode === 'homework' ? homeworkPresets : taskPresets;

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-sm animate-fade-in select-none">
      <div className="bg-[#1f222a] border-2 border-[#6b7cff] rounded-xl max-w-lg w-full flex flex-col shadow-2xl text-[#e9e4d8] overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#2b2d35] flex items-center justify-between bg-[#16181d] shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#6b7cff]/20 text-[#6b7cff]">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-editorial font-bold text-base text-[#e9e4d8] leading-tight">
                {mode === 'homework' ? 'AI 语音极速添加作业' : 'AI 语音极速备忘待办'}
              </h3>
              <p className="text-[11px] text-[#8f8b80]">
                通用 16kHz 无损 WAV 音频 ｜ 适配华为/鸿蒙/iOS 全移动端
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-[#2b2d35] text-[#8f8b80] hover:text-[#e9e4d8] cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-sm custom-scrollbar">
          {/* Main Recording Interactive Pod */}
          <div className="bg-[#16181d] border border-[#2e313b] rounded-lg p-5 flex flex-col items-center justify-center text-center space-y-3 relative overflow-hidden">
            {/* Visual audio wave or pulsating circle */}
            {isRecording ? (
              <div className="relative flex flex-col items-center justify-center my-2 w-full">
                {/* Ping rings */}
                <div
                  className="w-20 h-20 rounded-full bg-red-500/10 absolute transition-transform duration-75"
                  style={{ transform: `scale(${1 + (audioLevel / 100) * 0.8})` }}
                />
                <div className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center text-red-400 shadow-lg shadow-red-500/20 z-10">
                  <Mic className="w-7 h-7 animate-pulse" />
                </div>

                {/* Real-time Dynamic Soundwave Equalizer */}
                <div className="flex items-end justify-center gap-1.5 h-8 mt-3">
                  {[0.4, 0.8, 1.2, 0.9, 1.4, 0.7, 1.1, 0.6, 1.3].map((factor, idx) => {
                    const barHeight = Math.max(4, Math.min(32, Math.round((audioLevel * factor * 0.35) + 4)));
                    return (
                      <div
                        key={idx}
                        className={`w-1 rounded-full transition-all duration-75 ${
                          audioLevel > 4 ? 'bg-red-400' : 'bg-[#3e4252]'
                        }`}
                        style={{ height: `${barHeight}px` }}
                      />
                    );
                  })}
                </div>
              </div>
            ) : isTranscribing ? (
              <div className="w-16 h-16 rounded-full bg-[#6b7cff]/20 border-2 border-[#6b7cff] flex items-center justify-center text-[#6b7cff] my-2">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                className="w-16 h-16 rounded-full bg-[#242731] hover:bg-[#6b7cff] border-2 border-[#484c59] hover:border-[#6b7cff] text-[#e9e4d8] hover:text-white flex items-center justify-center my-2 transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95 group"
                title="点击开始录音"
              >
                <Mic className="w-7 h-7 group-hover:scale-110 transition-transform" />
              </button>
            )}

            {/* Status text & timer */}
            <div className="space-y-1">
              {isRecording ? (
                <>
                  <div className="text-red-400 font-bold text-sm flex items-center justify-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    正在录音收音中... ({formatSeconds(recordSeconds)})
                  </div>
                  <div className="text-xs text-[#8f8b80] flex items-center justify-center gap-1">
                    <Activity className={`w-3.5 h-3.5 ${audioLevel > 4 ? 'text-red-400' : 'text-[#63605a]'}`} />
                    <span>
                      {audioLevel > 4 ? '已灵敏感应到声波，请清晰说出作业' : '请靠近手机底部麦克风说话'}
                    </span>
                  </div>
                </>
              ) : isTranscribing ? (
                <>
                  <div className="text-[#6b7cff] font-bold text-sm flex items-center justify-center gap-1.5 font-mono">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    云端双引擎智能转写中...
                  </div>
                  <p className="text-xs text-[#8f8b80]">
                    标准 16kHz 无损 WAV 音频 ｜ 自动提取课程与截止时间
                  </p>
                </>
              ) : recognizedText ? (
                <>
                  <div className="text-emerald-400 font-bold text-sm flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    识别成功
                  </div>
                  <p className="text-xs text-[#8f8b80]">
                    核对并可手动微调下方的识别文本
                  </p>
                </>
              ) : (
                <>
                  <div className="text-sm font-bold text-[#e9e4d8]">
                    点击上方麦克风开始说话
                  </div>
                  <p className="text-xs text-[#8f8b80] max-w-sm">
                    {mode === 'homework'
                      ? '示例："高数课后习题第三十二页明天交" 或 "界面设计作业 周五晚上十点前"'
                      : '示例："准备明天下午两点的答辩演示" 或 "精读英语第三单元课文"'}
                  </p>
                </>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 pt-1">
              {isRecording ? (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>说完了，结束录音并识别</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={isTranscribing}
                  className="px-4 py-2 bg-[#252834] hover:bg-[#343849] border border-[#3a3d46] text-[#e9e4d8] text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Mic className="w-3.5 h-3.5 text-[#6b7cff]" />
                  <span>{recognizedText ? '重新录制语音' : '点击开启麦克风'}</span>
                </button>
              )}
            </div>
          </div>

          {/* One-Click Permission Request Button if permission was denied */}
          {permissionState === 'denied' && (
            <div className="p-3 bg-[#6b7cff]/15 border border-[#6b7cff]/50 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-[#8ea4ff] font-bold text-xs">
                <ShieldCheck className="w-4 h-4 text-[#6b7cff] shrink-0" />
                <span>麦克风权限未允许，可一键重新唤起系统授权</span>
              </div>
              <button
                type="button"
                disabled={isRequestingPerm}
                onClick={handleRequestMicPermission}
                className="w-full py-2.5 bg-[#6b7cff] hover:bg-[#5868e6] text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-[#6b7cff]/20 disabled:opacity-50"
              >
                {isRequestingPerm ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}
                <span>{isRequestingPerm ? '正在唤起手机权限...' : '一键唤起麦克风授权'}</span>
              </button>
            </div>
          )}

          {/* Error notice if any */}
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <div className="flex-1 space-y-2">
                <div>{errorMsg}</div>
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      triggerFocusInput();
                      toast('已为您唤起输入框！点击【手机键盘右上角的麦克风】即可离线语音输入。');
                    }}
                    className="px-2.5 py-1 bg-[#4ade80]/20 hover:bg-[#4ade80]/30 border border-[#4ade80]/50 text-[#4ade80] rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                  >
                    <Smartphone className="w-3 h-3 text-[#4ade80]" />
                    <span>唤起输入框键盘麦克风</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSimulateVoiceDemo()}
                    className="px-2.5 py-1 bg-[#d99a2b]/20 hover:bg-[#d99a2b]/30 border border-[#d99a2b]/50 text-[#f5bf5b] rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                  >
                    <Sparkles className="w-3 h-3 text-[#d99a2b]" />
                    <span>⚡ 模拟语音识别演示 (答辩保底)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowDoctorModal(true)}
                    className="px-2.5 py-1 bg-[#6b7cff]/20 hover:bg-[#6b7cff]/30 border border-[#6b7cff]/50 text-[#8ea4ff] hover:text-white rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Globe className="w-3 h-3 text-[#6b7cff]" />
                    <span>打开浏览器全项检测</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowMobileHelp(!showMobileHelp)}
                    className="text-[#8f8b80] hover:text-[#e9e4d8] underline text-[11px] cursor-pointer ml-auto"
                  >
                    {showMobileHelp ? '收起排查' : '常见排查指引'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Network Error or Defense Demo Banner */}
          {(networkErrorOccurred || isSimulating) && (
            <div className="p-3 bg-[#d99a2b]/15 border border-[#d99a2b]/40 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[#f5bf5b] font-bold text-xs">
                  <Sparkles className="w-4 h-4 text-[#d99a2b]" />
                  <span>已开启【答辩演示保底 / 模拟语音识别模式】</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#d99a2b]/30 text-[#f5bf5b] font-mono font-bold">
                  DEFENSE READY
                </span>
              </div>
              <p className="text-[11px] text-[#a8a399] leading-relaxed">
                针对国内网络下浏览器原生 `webkitSpeechRecognition` 的 network 限制，点击下方快捷模拟演示按钮，即可生成符合语法要素的完整文本，防尴尬冷场！
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(mode === 'homework'
                  ? ['高数 课后习题P32 @明天', '界面设计 实验报告下周三前交', '计算机网络 抓包实验 @周日']
                  : ['下午两点准时参加学院线上答辩', '去图书馆借阅操作系统第三版参考书']
                ).map((demoText, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSimulateVoiceDemo(demoText)}
                    className="px-2 py-1 text-[11px] font-bold rounded bg-[#272216] border border-[#d99a2b]/50 text-[#f5bf5b] hover:bg-[#d99a2b] hover:text-[#16181d] transition-all cursor-pointer shadow-xs active:scale-95"
                  >
                    ⚡ {demoText}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Streamlined Mobile Microphone Troubleshooting Accordion */}
          {showMobileHelp && (
            <div className="bg-[#16181f] border border-[#2e313b] rounded-lg p-3 text-[11.5px] text-[#a8a399] space-y-2.5">
              <div className="font-bold text-[#e9e4d8] flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-[#6b7cff]" />
                  <span>各手机浏览器麦克风快速解封：</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDoctorModal(true)}
                  className="text-[#6b7cff] hover:underline text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Globe className="w-3 h-3" />
                  <span>一键全项自检 →</span>
                </button>
              </div>
              <p className="text-[#8f8b80] leading-relaxed">
                • <strong>华为/鸿蒙浏览器</strong>：在最上方网址栏点击「锁头🔒 / 盾牌」➔ 点击「网站设置」➔ 开启「麦克风」允许。<br />
                • <strong>苹果 iPhone (Safari)</strong>：手机「设置」➔「Safari 浏览器」➔「麦克风」切换为「允许」。<br />
                • <strong>夸克浏览器 / 微信</strong>：移动端精简了部分多媒体通道，推荐一键复制网址在手机自带系统浏览器打开。
              </p>
            </div>
          )}

          {/* Recognized Text Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-mono text-[#8f8b80] flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5 text-[#6b7cff]" />
                <span>识别结果预览与编辑：</span>
              </label>
              {recognizedText && (
                <button
                  type="button"
                  onClick={() => setRecognizedText('')}
                  className="text-[#8f8b80] hover:text-[#ff6b57] text-[11px] cursor-pointer flex items-center gap-0.5"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>清除</span>
                </button>
              )}
            </div>

            <textarea
              ref={modalInputRef}
              value={recognizedText}
              onChange={e => setRecognizedText(e.target.value)}
              placeholder={
                isRecording
                  ? '正在录音收音中，说完点击“说完了，结束录音”...'
                  : isSimulating
                  ? '正在模拟语音录入与智能要素识别中...'
                  : '语音转录内容将在此显示，您可以随时直接在此输入或修改'
              }
              rows={3}
              className="w-full bg-[#16181d] border border-[#33363d] focus:border-[#6b7cff] rounded-lg p-2.5 text-xs sm:text-sm text-[#e9e4d8] outline-none placeholder:text-[#63605a] custom-scrollbar font-sans font-medium"
            />
          </div>

          {/* Homework Structural Breakdown preview */}
          {mode === 'homework' && parsedPreview && (
            <div className="p-2.5 bg-[#181b22] border border-[#6b7cff]/40 rounded-lg text-xs space-y-1 font-mono">
              <div className="text-[11px] text-[#6b7cff] font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>智能作业要素解析结构：</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                <div className="bg-[#131418] p-1.5 rounded border border-[#2b2d35]">
                  <span className="text-[#8f8b80]">匹配课程：</span>
                  <span className="text-[#e9e4d8] font-bold ml-1">{parsedPreview.course}</span>
                </div>
                <div className="bg-[#131418] p-1.5 rounded border border-[#2b2d35]">
                  <span className="text-[#8f8b80]">作业内容：</span>
                  <span className="text-[#e9e4d8] ml-1">
                    {parsedPreview.title || '（未输入具体内容）'}
                  </span>
                </div>
                <div className="bg-[#131418] p-1.5 rounded border border-[#2b2d35]">
                  <span className="text-[#8f8b80]">截止日期：</span>
                  <span className="text-[#4ade80] font-bold ml-1">
                    {parsedPreview.due || '无明确截止'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Preset Quick Chips */}
          <div className="space-y-1 pt-1">
            <div className="text-[11px] text-[#8f8b80] font-mono flex items-center gap-1">
              <span>快速测试示例句式（点击填入）：</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {currentPresets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="px-2 py-1 text-[11px] rounded bg-[#16181d] border border-[#2e313b] hover:border-[#6b7cff] hover:text-[#e9e4d8] text-[#8f8b80] transition-colors cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-[#2b2d35] bg-[#16181d] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1.5 text-xs text-[#8f8b80] hover:text-[#e9e4d8] cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => setShowDoctorModal(true)}
              className="text-[11px] text-[#6b7cff] hover:text-[#8ea4ff] flex items-center gap-1 cursor-pointer font-medium"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>浏览器能力诊断</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!recognizedText.trim() || isRecording || isTranscribing}
              className="px-3.5 py-1.5 bg-[#252834] hover:bg-[#343849] border border-[#3a3d46] text-[#e9e4d8] text-xs font-medium rounded-lg transition-all cursor-pointer disabled:opacity-40"
            >
              填入输入框
            </button>

            {onDirectAdd && (
              <button
                type="button"
                onClick={handleDirectAdd}
                disabled={!recognizedText.trim() || isRecording || isTranscribing || isDirectAdding}
                className="px-4 py-1.5 bg-[#6b7cff] hover:bg-[#5868e6] text-white text-xs font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40 shadow-sm active:scale-95"
              >
                {isDirectAdding ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>添加中...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>确认并直接添加</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Browser Doctor Modal */}
      <BrowserDoctorModal
        isOpen={showDoctorModal}
        onClose={() => setShowDoctorModal(false)}
        toast={toast}
      />
    </div>
  );
};
