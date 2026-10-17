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
} from 'lucide-react';
import { api } from '../services/api';
import { parseQuickHomeworkLine, ParsedQuickHomework } from '../utils/assignmentParser';

export interface VoiceInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Mode: 'homework' for assignments, 'task' for todo items
   */
  mode: 'homework' | 'task';
  courseNames?: string[];
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
  onConfirmText,
  onDirectAdd,
  toast,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recognizedText, setRecognizedText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDirectAdding, setIsDirectAdding] = useState(false);
  const [showMobileHelp, setShowMobileHelp] = useState(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const webSpeechRecognitionRef = useRef<any>(null);

  // AudioContext & Analyser for real-time mobile sound wave and volume detection
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const maxVolumeRef = useRef<number>(0);

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
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch {}
      analyserRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (webSpeechRecognitionRef.current) {
      try {
        webSpeechRecognitionRef.current.stop();
      } catch {}
      webSpeechRecognitionRef.current = null;
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
    }
  }, [isOpen, cleanupRecording]);

  // Start recording
  const startRecording = async () => {
    setErrorMsg(null);
    setRecognizedText('');
    audioChunksRef.current = [];
    setRecordSeconds(0);
    maxVolumeRef.current = 0;
    setAudioLevel(0);

    if (typeof window === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg(
        '当前浏览器不支持或未开放麦克风接口。请确保使用 HTTPS 安全网址打开，并在浏览器设置中允许麦克风权限。'
      );
      setShowMobileHelp(true);
      return;
    }

    try {
      // 1. Mobile-friendly getUserMedia constraints with fallback
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

      // 2. Real-time Audio Visualizer & Sound Detector
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
          }
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 128;
          analyser.smoothingTimeConstant = 0.4;
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          audioContextRef.current = audioCtx;
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateAudioLevel = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            const level = Math.min(100, Math.round((avg / 128) * 100));
            setAudioLevel(level);
            if (level > maxVolumeRef.current) {
              maxVolumeRef.current = level;
            }
            animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
          };
          updateAudioLevel();
        }
      } catch (audioErr) {
        console.warn('AudioContext visualizer not supported, continuing recording:', audioErr);
      }

      // 3. Multi-platform MIME type detection (WebM, MP4, AAC, OGG)
      const candidateMimes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/aac',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/wav',
      ];
      let selectedMime = '';
      if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
        for (const candidate of candidateMimes) {
          if (MediaRecorder.isTypeSupported(candidate)) {
            selectedMime = candidate;
            break;
          }
        }
      }

      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = selectedMime
          ? new MediaRecorder(stream, { mimeType: selectedMime })
          : new MediaRecorder(stream);
      } catch {
        // Fallback without options for strict WebKit/iOS Safari
        mediaRecorder = new MediaRecorder(stream);
      }

      const effectiveMime = mediaRecorder.mimeType || selectedMime || 'audio/webm';
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Release audio visualizer
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        if (audioContextRef.current) {
          try {
            audioContextRef.current.close();
          } catch {}
          audioContextRef.current = null;
        }
        setAudioLevel(0);

        // Stop stream hardware tracks
        try {
          stream.getTracks().forEach(track => track.stop());
        } catch {}

        if (audioChunksRef.current.length === 0) {
          setErrorMsg('未接收到录音数据，请靠近手机麦克风重试');
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: effectiveMime });
        if (audioBlob.size > 0) {
          // If absolute silence was recorded on mobile, alert user
          if (maxVolumeRef.current < 2 && recordSeconds >= 1) {
            console.warn('Microphone input was silent during recording');
          }
          await handleTranscribeBlob(audioBlob, effectiveMime);
        } else {
          setErrorMsg('录音内容为空，请靠近麦克风重新说话');
        }
      };

      // Use 500ms chunking for mobile WebView stability
      mediaRecorder.start(500);
      setIsRecording(true);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordSeconds(sec => sec + 1);
      }, 1000);

      // Optional Web Speech API for desktop Chrome live text preview
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.lang = 'zh-CN';
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.onresult = (event: any) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              interimTranscript += event.results[i][0].transcript;
            }
            if (interimTranscript) {
              setRecognizedText(interimTranscript);
            }
          };
          recognition.onerror = () => {
            // Mobile devices often throw network error for Google speech services in domestic networks
          };
          recognition.start();
          webSpeechRecognitionRef.current = recognition;
        } catch {}
      }
    } catch (err: any) {
      console.error('Microphone access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('麦克风权限被拒绝。请在手机浏览器地址栏锁头图标中开启麦克风权限。');
      } else {
        setErrorMsg(`无法启动麦克风: ${err.message || '未知错误'}`);
      }
      setShowMobileHelp(true);
    }
  };

  // Stop recording and trigger transcribe
  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (webSpeechRecognitionRef.current) {
      try {
        webSpeechRecognitionRef.current.stop();
      } catch {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        if (typeof mediaRecorderRef.current.requestData === 'function') {
          mediaRecorderRef.current.requestData();
        }
      } catch {}
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  // Transcribe recorded blob via Gemini Multimodal Transcribe
  const handleTranscribeBlob = async (blob: Blob, mimeType: string) => {
    setIsTranscribing(true);
    setErrorMsg(null);

    try {
      // Clean mimeType to base type (remove ;codecs=...)
      const baseMime = mimeType.split(';')[0].trim().toLowerCase() || 'audio/webm';

      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result as string;
          resolve(res);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);

      const base64Data = await base64Promise;

      const prompt =
        mode === 'homework'
          ? '请将这段中文语音内容转录为纯文本，准确保留课程名称（如高数、计网、线代、界面设计等）、作业具体内容（如课后习题、实验报告、P32第1题等）和截止时间（如明天交、周五晚前、10月25日截止等）。直接输出纯文本，不要任何额外解说。'
          : '请将这段语音内容原样转录为待办任务纯文本，直接输出文本内容，不要包含多余解说。';

      const result = await api.transcribeAudio(base64Data, baseMime, prompt);
      if (result && result.text && result.text.trim()) {
        setRecognizedText(result.text.trim());
        toast('语音识别成功！');
      } else if (recognizedText.trim()) {
        toast('已采用实时语音识别结果');
      } else if (result?.fallbackToLocal) {
        setErrorMsg('云端引擎未检测到清晰发音。请靠近手机麦克风大声重试，或直接点击下方预设/打字。');
      } else {
        if (maxVolumeRef.current < 2) {
          setErrorMsg('未检测到声音信号，请检查手机是否开启静音或麦克风权限是否正常。');
          setShowMobileHelp(true);
        } else {
          setErrorMsg('未检测到清晰的语音内容，请靠近麦克风重试');
        }
      }
    } catch (err: any) {
      console.warn('Audio transcribe failed, checking existing live text:', err);
      if (recognizedText.trim()) {
        toast('已采用实时捕获语音文本');
      } else {
        const friendlyMsg =
          err?.message === 'BACKEND_HTML_FALLBACK' || err?.isFallback
            ? '云端语音服务暂未就绪，请直接打字输入或稍后重试。'
            : (err?.message || '语音转录遇到问题，请重试或直接打字输入');
        setErrorMsg(friendlyMsg);
        setShowMobileHelp(true);
      }
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
                支持移动端/电脑端麦克风录音与高精度智能转写
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
                          audioLevel > 5 ? 'bg-red-400' : 'bg-[#3e4252]'
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
                    正在聆听说话中... ({formatSeconds(recordSeconds)})
                  </div>
                  <div className="text-xs text-[#8f8b80] flex items-center justify-center gap-1">
                    <Activity className={`w-3.5 h-3.5 ${audioLevel > 5 ? 'text-red-400' : 'text-[#63605a]'}`} />
                    <span>
                      {audioLevel > 5 ? '已捕捉到声音波动，请继续说' : '请靠近手机麦克风清晰说话'}
                    </span>
                  </div>
                </>
              ) : isTranscribing ? (
                <>
                  <div className="text-[#6b7cff] font-bold text-sm flex items-center justify-center gap-1.5 font-mono">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Gemini AI 正在高精度转录音频...
                  </div>
                  <p className="text-xs text-[#8f8b80]">
                    基于多模态大模型智能提炼课程、内容与截止日期
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
                  <span>说完了，结束录音</span>
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

          {/* Error notice if any */}
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <div className="flex-1 space-y-1">
                <div>{errorMsg}</div>
                <button
                  type="button"
                  onClick={() => setShowMobileHelp(!showMobileHelp)}
                  className="text-[#6b7cff] hover:underline flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                >
                  <Smartphone className="w-3 h-3" />
                  <span>查看手机麦克风权限排查指引</span>
                </button>
              </div>
            </div>
          )}

          {/* Mobile Microphone Troubleshooting Accordion */}
          <div className="bg-[#16181d] border border-[#2e313b] rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowMobileHelp(!showMobileHelp)}
              className="w-full px-3 py-2 text-xs flex items-center justify-between text-[#8f8b80] hover:text-[#e9e4d8] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-[#6b7cff]" />
                <span className="font-semibold">📱 手机端无法录音？常见排查与解决方法</span>
              </div>
              {showMobileHelp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showMobileHelp && (
              <div className="px-3 pb-3 pt-1 text-[11.5px] text-[#a8a399] border-t border-[#262832] space-y-2">
                <div className="bg-[#121317] p-2.5 rounded border border-[#262832] space-y-1">
                  <div className="text-[#e9e4d8] font-bold">1. 华为 / 鸿蒙浏览器权限开启</div>
                  <p className="text-[#8f8b80]">
                    点击网址栏左侧「锁头🔒 / 盾牌」图标 ➔ 【网站权限/网站设置】 ➔ 将<strong>【麦克风】</strong>设为<strong>【允许】</strong>。
                  </p>
                </div>

                <div className="bg-[#121317] p-2.5 rounded border border-[#262832] space-y-1">
                  <div className="text-[#e9e4d8] font-bold">2. 苹果 iPhone / Safari 麦克风设置</div>
                  <p className="text-[#8f8b80]">
                    进入手机【设置】 ➔ 【Safari 浏览器】 ➔ 向下找到【麦克风】 ➔ 设为<strong>【允许】</strong>；如添加到桌面打开，在系统设置中允许本应用麦克风。
                  </p>
                </div>

                <div className="bg-[#121317] p-2.5 rounded border border-[#262832] space-y-1">
                  <div className="text-[#e9e4d8] font-bold">3. 微信 / QQ 内置浏览器</div>
                  <p className="text-[#8f8b80]">
                    微信内置浏览器限制网页录音权限，请点击右上角【···】选择<strong>【在浏览器打开】</strong>（推荐使用系统自带浏览器、Chrome 或 Edge）。
                  </p>
                </div>
              </div>
            )}
          </div>

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
              value={recognizedText}
              onChange={e => setRecognizedText(e.target.value)}
              placeholder={
                isRecording
                  ? '正在聆听并实时捕捉语音文字中...'
                  : '语音转录内容将在此显示，您可以随时直接在此输入或修改'
              }
              rows={3}
              className="w-full bg-[#16181d] border border-[#33363d] focus:border-[#6b7cff] rounded-lg p-2.5 text-xs sm:text-sm text-[#e9e4d8] outline-none placeholder:text-[#63605a] custom-scrollbar font-sans"
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
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-[#8f8b80] hover:text-[#e9e4d8] cursor-pointer"
          >
            取消
          </button>

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
    </div>
  );
};
