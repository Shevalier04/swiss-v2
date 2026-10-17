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
  AlertCircle
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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const webSpeechRecognitionRef = useRef<any>(null);

  // Parse result for homework mode
  const parsedPreview = useMemo(() => {
    if (mode !== 'homework' || !recognizedText.trim()) return null;
    return parseQuickHomeworkLine(recognizedText.trim(), courseNames);
  }, [mode, recognizedText, courseNames]);

  // Clean up recording on unmount or close
  const cleanupRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        // ignore
      }
    }
    if (webSpeechRecognitionRef.current) {
      try {
        webSpeechRecognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
      webSpeechRecognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      cleanupRecording();
      setRecognizedText('');
      setErrorMsg(null);
      setRecordSeconds(0);
    }
  }, [isOpen, cleanupRecording]);

  // Start recording
  const startRecording = async () => {
    setErrorMsg(null);
    setRecognizedText('');
    audioChunksRef.current = [];
    setRecordSeconds(0);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg('当前浏览器不支持麦克风录音，请在 Chrome / Edge 或 HTTPS 环境下使用');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Determine supported mimeType
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop stream tracks to release microphone hardware
        stream.getTracks().forEach(track => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size > 0) {
          await handleTranscribeBlob(audioBlob, mimeType);
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordSeconds(sec => sec + 1);
      }, 1000);

      // Optional Web Speech API for real-time live preview while speaking
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
          recognition.start();
          webSpeechRecognitionRef.current = recognition;
        } catch {
          // ignore web speech fallback error
        }
      }
    } catch (err: any) {
      console.error('Microphone access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('麦克风权限被拒绝，请在浏览器地址栏允许麦克风访问权限');
      } else {
        setErrorMsg(`无法启动麦克风录音: ${err.message || '未知错误'}`);
      }
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
      } catch {
        // ignore
      }
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  // Transcribe recorded blob via Gemini 3.5 Transcribe
  const handleTranscribeBlob = async (blob: Blob, mimeType: string) => {
    setIsTranscribing(true);
    setErrorMsg(null);

    try {
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

      const result = await api.transcribeAudio(base64Data, mimeType, prompt);
      if (result && result.text && result.text.trim()) {
        setRecognizedText(result.text.trim());
        toast('语音识别成功');
      } else if (recognizedText.trim()) {
        toast('已采用本地实时语音识别结果');
      } else if (result?.fallbackToLocal) {
        setErrorMsg('请靠近麦克风清晰重试，或直接在下方打字/点选预设');
      } else {
        setErrorMsg('未检测到清晰的语音内容，请靠近麦克风重试');
      }
    } catch (err: any) {
      console.warn('Gemini transcribe failed, checking existing web speech text:', err);
      if (recognizedText.trim()) {
        toast('已采用本地离线语音识别结果');
      } else {
        const friendlyMsg =
          err?.message === 'BACKEND_HTML_FALLBACK' || err?.isFallback
            ? '云端语音引擎暂未就绪，已切换为本地模式。请重试或直接打字输入。'
            : (err?.message || '语音转录遇到问题，请重试或直接打字输入');
        setErrorMsg(friendlyMsg);
      }
    } finally {
      setIsTranscribing(false);
    }
  };

  // Handle Preset Quick Click (useful for quick testing)
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
    '计算机网络 完成Wireshark抓包大作业 10月28日截止',
  ];

  const taskPresets = [
    '精读英语第三单元课文并打卡',
    '复习计算机网络第四章实验',
    '准备明天下午的开题答辩演示文稿',
    '去图书馆归还数据库教材',
  ];

  const currentPresets = mode === 'homework' ? homeworkPresets : taskPresets;

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs animate-editorial-fade">
      <div className="bg-[#1c1e24] border-2 border-[#3a3d46] w-full max-w-lg rounded-lg shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-[#e9e4d8]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#2b2d35] flex items-center justify-between shrink-0 bg-[#16181d]">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all ${
                isRecording
                  ? 'bg-red-500/20 text-red-400 border-red-500/50 animate-pulse'
                  : 'bg-[#6b7cff]/20 text-[#6b7cff] border-[#6b7cff]/40'
              }`}
            >
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[#e9e4d8] font-mono tracking-tight">
                  {mode === 'homework' ? '语音录入作业' : '语音添加待办'}
                </h2>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#6b7cff]/20 text-[#8ea4ff] border border-[#6b7cff]/30">
                  Gemini 3.5 Transcribe
                </span>
              </div>
              <p className="text-[11px] text-[#8f8b80] mt-0.5">
                {mode === 'homework'
                  ? '说出课程、作业内容与截止时间，AI 自动转录并抽取结构'
                  : '说出待办任务内容，快速录入个人日程'}
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
        <div className="p-5 overflow-y-auto space-y-4 text-sm custom-scrollbar">
          {/* Main Recording Interactive Pod */}
          <div className="bg-[#16181d] border border-[#2e313b] rounded-lg p-5 flex flex-col items-center justify-center text-center space-y-3 relative overflow-hidden">
            {/* Visual audio wave or pulsating circle */}
            {isRecording ? (
              <div className="relative flex items-center justify-center my-2">
                <div className="w-20 h-20 rounded-full bg-red-500/10 animate-ping absolute" />
                <div className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center text-red-400 shadow-lg shadow-red-500/20">
                  <Mic className="w-7 h-7 animate-bounce" />
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
                    正在聆听录音中... ({formatSeconds(recordSeconds)})
                  </div>
                  <p className="text-xs text-[#8f8b80]">
                    请清晰说出内容，说完点击下方“结束录音”
                  </p>
                </>
              ) : isTranscribing ? (
                <>
                  <div className="text-[#6b7cff] font-bold text-sm flex items-center justify-center gap-1.5 font-mono">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Gemini 3.5 正在高精度转录音频...
                  </div>
                  <p className="text-xs text-[#8f8b80]">
                    使用专用 gemini-3.5-transcribe 语音大模型智能解析
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
                    点击麦克风开始说话
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
                  className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white font-bold text-xs rounded flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>结束录音并识别</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={isTranscribing}
                  className="px-3.5 py-1.5 bg-[#252834] hover:bg-[#343849] border border-[#3a3d46] text-[#e9e4d8] text-xs font-medium rounded flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Mic className="w-3.5 h-3.5 text-[#6b7cff]" />
                  <span>{recognizedText ? '重新录音' : '开始录音'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Error notice if any */}
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <div className="flex-1">{errorMsg}</div>
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
              value={recognizedText}
              onChange={e => setRecognizedText(e.target.value)}
              placeholder={
                isRecording
                  ? '正在聆听并实时抓取文字中...'
                  : '语音转录内容将在此显示，您可以随时直接在此输入或修改'
              }
              rows={3}
              className="w-full bg-[#16181d] border border-[#33363d] focus:border-[#6b7cff] rounded p-2.5 text-xs sm:text-sm text-[#e9e4d8] outline-none placeholder:text-[#63605a] custom-scrollbar font-sans"
            />
          </div>

          {/* Homework Structural Breakdown preview */}
          {mode === 'homework' && parsedPreview && (
            <div className="p-2.5 bg-[#181b22] border border-[#6b7cff]/40 rounded text-xs space-y-1 font-mono">
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
              className="px-3.5 py-1.5 bg-[#252834] hover:bg-[#343849] border border-[#3a3d46] text-[#e9e4d8] text-xs font-medium rounded transition-all cursor-pointer disabled:opacity-40"
            >
              填入输入框
            </button>

            {onDirectAdd && (
              <button
                type="button"
                onClick={handleDirectAdd}
                disabled={!recognizedText.trim() || isRecording || isTranscribing || isDirectAdding}
                className="px-4 py-1.5 bg-[#6b7cff] hover:bg-[#5868e6] text-white text-xs font-bold rounded flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40 shadow-sm active:scale-95"
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
