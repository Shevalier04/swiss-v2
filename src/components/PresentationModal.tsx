import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Copy,
  Maximize2,
  Minimize2,
  FileText,
  Check,
  Presentation,
  Sparkles,
  Layers,
  HelpCircle,
} from 'lucide-react';
import {
  PRESENTATION_SLIDES,
  SlideData,
  exportToPptxFile,
  exportToMarkdownOutline,
} from '../utils/pptxExport';

interface PresentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  toast?: (msg: string) => void;
}

export const PresentationModal: React.FC<PresentationModalProps> = ({
  isOpen,
  onClose,
  toast,
}) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const modalContainerRef = useRef<HTMLDivElement>(null);

  const slides = PRESENTATION_SLIDES;
  const currentSlide: SlideData = slides[currentSlideIndex] || slides[0];

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        setCurrentSlideIndex((prev) => Math.min(prev + 1, slides.length - 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setCurrentSlideIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Escape') {
        if (isFullscreen) {
          if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFullscreen, slides.length, onClose]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (!isFullscreen && modalContainerRef.current) {
        if (modalContainerRef.current.requestFullscreen) {
          await modalContainerRef.current.requestFullscreen();
        }
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (e) {
      // Ignore fullscreen rejection
    }
  };

  const handleDownloadPptx = async () => {
    try {
      setIsExporting(true);
      if (toast) toast('正在生成高保真 PPTX 演示文稿...');
      await exportToPptxFile(slides);
      if (toast) toast('PPTX 演示文稿已成功生成并下载！');
    } catch (err: any) {
      console.error(err);
      if (toast) toast('导出 PPTX 失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      const md = exportToMarkdownOutline(slides);
      await navigator.clipboard.writeText(md);
      setHasCopied(true);
      if (toast) toast('PPT 大纲内容已复制到剪贴板，可粘贴至 Gamma / WPS / Notion');
      setTimeout(() => setHasCopied(false), 2500);
    } catch (e) {
      if (toast) toast('复制失败，请手动选择');
    }
  };

  return (
    <div
      ref={modalContainerRef}
      className="fixed inset-0 z-50 flex flex-col bg-[#111216] text-[#e9e4d8] select-none overflow-hidden animate-fade-in"
    >
      {/* Top Bar */}
      <header className="h-14 shrink-0 px-4 flex items-center justify-between border-b border-[#2d3038] bg-[#181a20]/95 backdrop-blur z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#6b7cff]/20 text-[#6b7cff] flex items-center justify-center border border-[#6b7cff]/40">
            <Presentation className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-wide flex items-center gap-2">
              <span>掌上课表 · 产品说明书演示文稿</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#6b7cff]/20 text-[#8ea4ff] font-mono border border-[#6b7cff]/40">
                16:9 PPT
              </span>
            </div>
            <div className="text-[11px] text-[#8f8b80] font-mono">
              第 {currentSlideIndex + 1} / {slides.length} 页 · {currentSlide.section}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* PPTX Export Button */}
          <button
            onClick={handleDownloadPptx}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#6b7cff] hover:bg-[#5b6be6] text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
            title="一键下载微软 PowerPoint (.pptx) 文件"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">导出 .pptx 演示文稿</span>
            <span className="sm:hidden">导出 PPT</span>
          </button>

          {/* Copy Markdown */}
          <button
            onClick={handleCopyMarkdown}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#26282e] hover:bg-[#33363e] border border-[#3e424c] text-xs text-[#c4c0b6] transition-all cursor-pointer active:scale-95"
            title="复制 Markdown 幻灯片大纲（可直接导入 Gamma/WPS AI 生成幻灯片）"
          >
            {hasCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">复制大纲</span>
          </button>

          {/* Thumbnails toggle */}
          <button
            onClick={() => setShowThumbnails(!showThumbnails)}
            className={`p-1.5 rounded border text-xs transition-colors cursor-pointer ${
              showThumbnails
                ? 'bg-[#6b7cff]/20 border-[#6b7cff] text-[#8ea4ff]'
                : 'bg-[#26282e] border-[#3e424c] text-[#8f8b80] hover:text-[#e9e4d8]'
            }`}
            title="幻灯片列表"
          >
            <Layers className="w-4 h-4" />
          </button>

          {/* Notes toggle */}
          <button
            onClick={() => setShowNotes(!showNotes)}
            className={`p-1.5 rounded border text-xs transition-colors cursor-pointer ${
              showNotes
                ? 'bg-[#6b7cff]/20 border-[#6b7cff] text-[#8ea4ff]'
                : 'bg-[#26282e] border-[#3e424c] text-[#8f8b80] hover:text-[#e9e4d8]'
            }`}
            title="演讲者备注"
          >
            <FileText className="w-4 h-4" />
          </button>

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded bg-[#26282e] border border-[#3e424c] text-[#8f8b80] hover:text-[#e9e4d8] text-xs transition-colors cursor-pointer hidden sm:block"
            title="全屏放映模式"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-1.5 rounded bg-[#26282e] hover:bg-[#363942] border border-[#3e424c] text-[#8f8b80] hover:text-[#e9e4d8] transition-colors cursor-pointer ml-1"
            title="退出演示 (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Slide Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Thumbnails Sidebar (Collapsible) */}
        {showThumbnails && (
          <aside className="w-60 shrink-0 border-r border-[#2d3038] bg-[#15171c] p-3 overflow-y-auto space-y-2 z-10 transition-all">
            <div className="text-[10px] font-mono tracking-widest text-[#8f8b80] mb-2 px-1">
              SLIDE OUTLINE · 幻灯片清单 ({slides.length})
            </div>
            {slides.map((s, idx) => {
              const isActive = idx === currentSlideIndex;
              return (
                <div
                  key={s.id}
                  onClick={() => setCurrentSlideIndex(idx)}
                  className={`p-2.5 rounded border text-left cursor-pointer transition-all ${
                    isActive
                      ? 'bg-[#6b7cff]/15 border-[#6b7cff] shadow-sm'
                      : 'bg-[#1e2026] border-[#2e313a] hover:border-[#444855]'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10.5px] font-mono text-[#8f8b80]">
                    <span>P.{idx + 1}</span>
                    <span className="text-[9px] truncate max-w-[120px] text-[#6b7cff]">{s.section}</span>
                  </div>
                  <div className={`text-xs font-bold mt-1 line-clamp-1 ${isActive ? 'text-[#8ea4ff]' : 'text-[#e9e4d8]'}`}>
                    {s.title}
                  </div>
                </div>
              );
            })}
          </aside>
        )}

        {/* Center Presentation Stage */}
        <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 overflow-hidden bg-[#0d0e12]">
          {/* 16:9 Presentation Aspect Ratio Card */}
          <div className="w-full max-w-5xl aspect-video bg-[#1d1f24] border border-[#3a3d46] rounded-lg shadow-2xl flex flex-col p-6 sm:p-10 relative overflow-hidden transition-all select-text">
            {/* Top Tag & Badge */}
            <div className="flex items-center justify-between shrink-0 mb-3 border-b border-[#33363f] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold tracking-[2.5px] text-[#6b7cff]">
                  {currentSlide.section}
                </span>
                <span className="text-[#454852]">/</span>
                <span className="text-[11px] font-mono text-[#8f8b80]">
                  SLIDE {currentSlideIndex + 1} OF {slides.length}
                </span>
              </div>
              {currentSlide.highlightBadge && (
                <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-[#6b7cff] text-white tracking-wide shadow-sm">
                  {currentSlide.highlightBadge}
                </span>
              )}
            </div>

            {/* Slide Title & Subtitle */}
            <div className="shrink-0 mb-5">
              <h2 className="text-2xl sm:text-3xl font-extrabold font-editorial tracking-wide text-[#e9e4d8] leading-tight">
                {currentSlide.title}
              </h2>
              <p className="text-xs sm:text-sm text-[#9a978e] mt-1.5 leading-relaxed font-sans">
                {currentSlide.subtitle}
              </p>
            </div>

            {/* Slide Body Grid */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 overflow-y-auto pr-1">
              {currentSlide.points.map((pt, idx) => (
                <div
                  key={idx}
                  className="bg-[#26282e]/90 border border-[#383b44] rounded-md p-3.5 sm:p-4 flex flex-col justify-between hover:border-[#525663] transition-colors relative overflow-hidden"
                >
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1 ${
                      idx % 2 === 0 ? 'bg-[#6b7cff]' : 'bg-[#ff6b57]'
                    }`}
                  />
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-[#e9e4d8] flex items-center gap-2">
                      <span>{pt.title}</span>
                    </h3>
                    <p className="text-xs sm:text-sm text-[#9a978e] mt-2 leading-relaxed font-normal">
                      {pt.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Slide Footer */}
            <div className="shrink-0 mt-4 pt-3 border-t border-[#2e313a] flex items-center justify-between text-[10px] font-mono text-[#666973]">
              <div>掌上课表 · Swiss Editorial v4.5 · 官方产品使用说明书</div>
              <div>PAGE {currentSlideIndex + 1} / {slides.length}</div>
            </div>
          </div>
        </div>

        {/* Right Speaker Notes Drawer (Collapsible) */}
        {showNotes && (
          <aside className="w-72 shrink-0 border-l border-[#2d3038] bg-[#16181e] p-4 overflow-y-auto space-y-3 z-10">
            <div className="flex items-center gap-2 text-xs font-bold text-[#e9e4d8]">
              <FileText className="w-4 h-4 text-[#6b7cff]" />
              <span>演讲者备注与讲解指引</span>
            </div>
            <div className="text-xs text-[#9a978e] leading-relaxed bg-[#20222a] p-3 rounded border border-[#2e313a]">
              {currentSlide.notes || '暂无针对本页的特殊备注。'}
            </div>
            <div className="pt-2 text-[11px] text-[#71737e] space-y-1">
              <div>💡 演示提示：</div>
              <ul className="list-disc pl-4 space-y-1">
                <li>按方向键 ← / → 或 空格键 快捷切换幻灯片</li>
                <li>点击右上角“导出 .pptx 演示文稿”即可保存为本地可编辑文件</li>
                <li>点击“复制大纲”可一键导入至其他 AI PPT 生成平台</li>
              </ul>
            </div>
          </aside>
        )}
      </div>

      {/* Bottom Floating Navigation Bar */}
      <footer className="h-13 shrink-0 px-4 flex items-center justify-between border-t border-[#2d3038] bg-[#16181e]/95 backdrop-blur z-20">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            disabled={currentSlideIndex === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#26282e] hover:bg-[#343740] border border-[#3c404b] text-xs font-bold text-[#e9e4d8] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>上一页</span>
          </button>
          <button
            onClick={handleNext}
            disabled={currentSlideIndex === slides.length - 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#26282e] hover:bg-[#343740] border border-[#3c404b] text-xs font-bold text-[#e9e4d8] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <span>下一页</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Slide Progress Slider / Indicators */}
        <div className="flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlideIndex(i)}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                i === currentSlideIndex
                  ? 'w-6 bg-[#6b7cff]'
                  : 'w-2 bg-[#3a3d46] hover:bg-[#525663]'
              }`}
              title={`跳到第 ${i + 1} 页`}
            />
          ))}
        </div>

        {/* Quick Help & Export */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-[#8f8b80] hidden sm:inline">
            快捷键: ← 上一页 / → 下一页 / Space
          </span>
          <button
            onClick={handleDownloadPptx}
            className="px-2.5 py-1 text-xs rounded bg-[#6b7cff]/20 text-[#8ea4ff] border border-[#6b7cff]/40 hover:bg-[#6b7cff]/30 font-bold cursor-pointer transition-colors"
          >
            下载 .pptx
          </button>
        </div>
      </footer>
    </div>
  );
};
