import React, { useEffect, useState } from 'react';
import { Course } from '../types';
import { WEEKDAYS, PALETTE } from '../utils/time';
import { X, CheckCircle, AlertTriangle } from 'lucide-react';

interface PdfImportModalProps {
  pdfFile: File;
  onConfirmImport: (courses: Course[]) => Promise<void>;
  onClose: () => void;
  toast: (msg: string) => void;
}

export const PdfImportModal: React.FC<PdfImportModalProps> = ({
  pdfFile,
  onConfirmImport,
  onClose,
  toast,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [parsedCourses, setParsedCourses] = useState<Course[]>([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    parsePdf(pdfFile);
  }, [pdfFile]);

  const ensurePdfJs = async (): Promise<any> => {
    if ((window as any).pdfjsLib) return (window as any).pdfjsLib;

    const sources = [
      {
        src: 'https://registry.npmmirror.com/pdfjs-dist/3.11.174/files/build/pdf.min.js',
        worker: 'https://registry.npmmirror.com/pdfjs-dist/3.11.174/files/build/pdf.worker.min.js',
      },
      {
        src: 'https://cdn.bootcdn.net/ajax/libs/pdf.js/3.11.174/pdf.min.js',
        worker: 'https://cdn.bootcdn.net/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
      },
      {
        src: 'https://cdn.staticfile.net/pdf.js/3.11.174/pdf.min.js',
        worker: 'https://cdn.staticfile.net/pdf.js/3.11.174/pdf.worker.min.js',
      },
      {
        src: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
        worker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
      },
    ];

    for (const source of sources) {
      try {
        const lib = await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = source.src;
          script.crossOrigin = 'anonymous';
          const timeout = setTimeout(() => {
            script.remove();
            reject(new Error('timeout'));
          }, 6000);

          script.onload = () => {
            clearTimeout(timeout);
            const loaded = (window as any).pdfjsLib;
            if (loaded) {
              loaded.GlobalWorkerOptions.workerSrc = source.worker;
              resolve(loaded);
            } else {
              reject(new Error('not available'));
            }
          };
          script.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('load error'));
          };
          document.head.appendChild(script);
        });

        if (lib) return lib;
      } catch {
        // try next domestic source
      }
    }

    throw new Error('无法连接 PDF 解析资源，请检查网络连接');
  };

  const parsePdf = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const pdfjs = await ensurePdfJs();
      if (!pdfjs) {
        throw new Error('PDF 解析组件加载中，请稍等片刻重试');
      }

      const buf = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({
        data: buf,
        cMapUrl: 'https://registry.npmmirror.com/pdfjs-dist/3.11.174/files/cmaps/',
        cMapPacked: true,
      }).promise;

      const pages: any[] = [];
      for (let pi = 0; pi < doc.numPages; pi++) {
        const page = await doc.getPage(pi + 1);
        const vp = page.getViewport({ scale: 1 });
        const tc = await page.getTextContent();
        pages.push({
          items: tc.items
            .filter((i: any) => i.str && i.str.trim())
            .map((i: any) => ({
              str: i.str,
              tx: i.transform[4],
              ty: i.transform[5],
              sz: i.height,
            })),
          H: vp.height,
        });
      }

      const DAYS = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];
      const dayIdx: Record<string, number> = Object.fromEntries(DAYS.map((d, i) => [d, i]));

      let vertical = false;
      let centers: number[] = [];

      for (const pg of pages) {
        const hs = pg.items.filter((i: any) => dayIdx[i.str.trim()] !== undefined);
        if (hs.length < 5) continue;
        const fset = Array.from(new Set(hs.map((i: any) => i.ty)));
        const eset = Array.from(new Set(hs.map((i: any) => i.tx)));
        vertical = eset.length === 1 && fset.length >= 5;
        const by: Record<number, number> = {};
        hs.forEach((i: any) => {
          const d = dayIdx[i.str.trim()];
          if (by[d] === undefined) by[d] = vertical ? i.ty : i.tx;
        });

        centers = [];
        for (let d = 0; d < 7; d++) {
          if (by[d] !== undefined) {
            centers.push(by[d]);
          } else {
            let a = d - 1;
            while (a >= 0 && by[a] === undefined) a--;
            let b = d + 1;
            while (b < 7 && by[b] === undefined) b++;
            if (a >= 0 && b < 7) centers.push((by[a] + by[b]) / 2);
            else if (a >= 0) centers.push(by[a] + 104);
            else centers.push(by[b] - 104);
          }
        }
        break;
      }

      if (!centers.length) {
        throw new Error('未在 PDF 中识别出星期表头，请确认是教务系统导出的课表文件');
      }

      const bounds: number[] = [];
      for (let i = 0; i < 6; i++) bounds.push((centers[i] + centers[i + 1]) / 2);
      const colOf = (c: number) => {
        for (let i = 0; i < 6; i++) {
          if (c < bounds[i]) return i;
        }
        return 6;
      };

      const texts: any[] = [];
      pages.forEach((pg, pi) => {
        for (const it of pg.items) {
          const s = it.str.trim();
          if (!s) continue;
          const col = vertical ? it.ty : it.tx;
          const row = (vertical ? it.tx : pg.H - it.ty) + pi * 10000;
          texts.push({ s, col, row, sz: it.sz });
        }
      });

      const szCnt: Record<number, number> = {};
      texts.forEach(t => {
        szCnt[t.sz] = (szCnt[t.sz] || 0) + 1;
      });
      let mode = 8;
      let best = 0;
      for (const k in szCnt) {
        if (szCnt[k] > best) {
          best = szCnt[k];
          mode = +k;
        }
      }

      const SKIP = new Set([...DAYS, '时间段', '节次', '上午', '下午', '晚上', '中午', '凌晨']);
      const isTitle = (t: any) =>
        t.sz > mode + 0.3 && t.sz < mode * 1.35 && !SKIP.has(t.s) && !/^\d+$/.test(t.s);

      const segRe = /\((\d+)-(\d+)节\)/;
      const rawCourses: any[] = [];
      const seen: Record<string, string> = {};

      for (let day = 0; day < 7; day++) {
        const col = texts
          .filter(t => t.col > centers[0] - 40 && colOf(t.col) === day)
          .sort((a, b) => a.row - b.row || a.col - b.col);

        let name: string | null = null;
        let seg: any = null;
        const segs: any[] = [];

        for (const t of col) {
          const m = segRe.exec(t.s);
          if (isTitle(t)) {
            const nm = t.s.replace(/[☆★]/g, '');
            if (m) segs.push({ nm: name || nm, s: +m[1], e: +m[2], lines: [t.s] });
            else {
              name = nm;
              seg = null;
            }
          } else if (m) {
            seg = { nm: name, s: +m[1], e: +m[2], lines: [t.s] };
            segs.push(seg);
          } else if (seg) {
            seg.lines.push(t.s);
          }
        }

        for (const g of segs) {
          if (!g.nm) continue;
          const s2 = Math.max(1, Math.min(g.s, 11));
          const e2 = Math.max(1, Math.min(g.e, 11));
          if (s2 > e2) continue;

          const txt = g.lines.join('');
          const room = /场地[:：]([^\/]+)/.exec(txt);
          const teacher = /教师[:：]([^\/]+)/.exec(txt);
          const weeks = /\)([\d\-]+周(?:,[\d\-]+周)*)/.exec(txt);
          const key = day + '|' + s2 + '|' + e2 + '|' + g.nm;

          if (seen[key]) {
            if (weeks && !seen[key].includes(weeks[1])) seen[key] += ',' + weeks[1];
            continue;
          }
          seen[key] = weeks ? weeks[1] : '';
          rawCourses.push({
            name: g.nm,
            teacher: teacher ? teacher[1] : '',
            room: room ? room[1] : '',
            day,
            s: s2,
            e: e2,
            weeks: weeks ? weeks[1] : '',
          });
        }
      }

      if (!rawCourses.length) {
        throw new Error('未能从 PDF 文件中识别到课程信息');
      }

      const colorMap: Record<string, string> = {};
      let colorIndex = 0;
      const formatted: Course[] = rawCourses.map((c, idx) => {
        if (!colorMap[c.name]) {
          colorMap[c.name] = PALETTE[colorIndex % PALETTE.length];
          colorIndex++;
        }
        return {
          id: Date.now() + idx,
          name: c.name,
          teacher: c.teacher,
          room: c.room,
          day: c.day,
          s: c.s,
          e: c.e,
          weeks: c.weeks,
          color: colorMap[c.name],
        };
      });

      setParsedCourses(formatted);
    } catch (err: any) {
      setError(err.message || 'PDF 解析发生错误');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!parsedCourses.length) return;
    setImporting(true);
    try {
      await onConfirmImport(parsedCourses);
      toast(`成功导入 ${parsedCourses.length} 门课程！`);
      onClose();
    } catch (err: any) {
      toast(err.message || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md bg-[#24262c] border-2 border-[#e9e4d8] rounded-lg shadow-2xl p-5 text-[#e9e4d8] max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-[#33363d]">
          <div>
            <h3 className="font-editorial text-xl font-bold tracking-wide">
              {loading
                ? '正在解析 PDF...'
                : error
                ? '解析失败'
                : `识别到 ${parsedCourses.length} 门课程`}
            </h3>
            <div className="text-[10px] font-mono tracking-widest text-[#8f8b80] mt-0.5 truncate max-w-[280px]">
              {pdfFile.name}
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-[#8f8b80] hover:text-[#e9e4d8]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto my-3 text-xs">
          {loading ? (
            <div className="py-12 text-center text-[#8f8b80] space-y-2">
              <div className="w-6 h-6 border-2 border-[#6b7cff] border-t-transparent rounded-full animate-spin mx-auto" />
              <div>正在读取页面坐标与网格数据...</div>
            </div>
          ) : error ? (
            <div className="py-8 text-center text-[#ff6b57] space-y-2">
              <AlertTriangle className="w-8 h-8 mx-auto" />
              <div className="font-bold">{error}</div>
              <div className="text-[11px] text-[#8f8b80]">
                支持正向横版及 90 度旋转的教务系统课表 PDF。
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[#2a2d34]">
              {parsedCourses.map((c, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-[#e9e4d8] truncate flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: c.color }}
                      />
                      <span>{c.name}</span>
                    </div>
                    <div className="text-[11px] text-[#8f8b80] mt-0.5 truncate">
                      {WEEKDAYS[c.day]} 第{c.s}-{c.e}节
                      {c.room ? ` · ${c.room}` : ''}
                      {c.teacher ? ` · ${c.teacher}` : ''}
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-[#a3a19b] shrink-0 border border-[#33363d] px-1.5 py-0.5 rounded">
                    {c.weeks || '全学期'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {!loading && !error && (
          <div className="pt-2 border-t border-[#33363d] flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={importing}
              className="flex-1 py-3 bg-[#e9e4d8] hover:bg-white text-[#1d1f24] font-bold text-xs tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              {importing ? '正在导入...' : '确认导入（覆盖当前课表）'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-3 border border-[#8f8b80] text-[#8f8b80] hover:text-white font-bold text-xs transition-colors cursor-pointer"
            >
              取消
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
