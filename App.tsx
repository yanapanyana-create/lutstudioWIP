
import React, { useState, useRef, useCallback, useEffect, useMemo, useDeferredValue } from 'react';
import { analyzeImageStyle } from './services/gemini';
import { getAdvancedStats, transferColorAdvanced, generateHaldLUT, applyColorAdjustments } from './services/colorTransfer';
import { ProcessedState, ColorAdjustments, CurvesState, HSLAdjustment, AdvancedStats } from './types';

const Header: React.FC = () => (
  <header className="py-4 px-6 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
    <div className="max-w-7xl mx-auto flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">LutStudio AI</h1>
          <p className="text-[10px] text-slate-500 font-medium tracking-widest uppercase">Precision Mastering</p>
        </div>
      </div>
    </div>
  </header>
);

const AdjustmentSlider: React.FC<{ label: string; value: number; min: number; max: number; onChange: (val: number) => void; reset: () => void; }> = ({ label, value, min, max, onChange, reset }) => {
  const [textValue, setTextValue] = useState<string>(String(value));

  // Keep the text input in sync when the value changes from outside
  useEffect(() => {
    setTextValue(String(value));
  }, [value]);

  const commitValue = (raw: string) => {
    // Allow temporary states like empty string or "-" while typing
    if (raw === '' || raw === '-') {
      setTextValue(String(value));
      return;
    }

    const num = Number(raw);
    if (Number.isNaN(num)) {
      setTextValue(String(value));
      return;
    }

    const clamped = Math.max(min, Math.min(max, num));
    onChange(clamped);
  };

  return (
    <div className="flex flex-col gap-1.5 animate-fade-in">
      <div className="flex items-center justify-between px-1">
        <label className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">{label}</label>
        <div className="flex items-center gap-2">
          <input 
            type="number" 
            step={1}
            value={textValue}
            min={min} 
            max={max}
            onChange={(e) => setTextValue(e.target.value)}
            onBlur={(e) => commitValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitValue((e.target as HTMLInputElement).value);
              }
            }}
            className="w-12 bg-slate-800 border border-slate-700 rounded text-[10px] font-mono text-indigo-400 text-center focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button onClick={reset} className="text-[9px] text-slate-600 hover:text-white transition-colors">↺</button>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
};

const AssetInput: React.FC<{ title: string; src: string | null; onFile: (f: File) => void; }> = ({ title, src, onFile }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2 group">
      <div className="flex justify-between items-center px-1">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</label>
        <button onClick={() => inputRef.current?.click()} className="text-[9px] text-indigo-400 font-bold hover:text-indigo-300 transition-colors uppercase">Browse</button>
      </div>
      <div onClick={() => inputRef.current?.click()} className={`aspect-video rounded-2xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden ${src ? 'border-transparent bg-slate-900/50' : 'border-slate-800 hover:border-slate-700 bg-slate-900/20'}`}>
        {src ? <img src={src} className="w-full h-full object-cover" /> : <span className="text-slate-700 text-[10px] font-bold uppercase tracking-tighter">Click to upload</span>}
      </div>
      <input type="file" ref={inputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
    </div>
  );
};

const DEFAULT_HSL_ITEM: HSLAdjustment = { hue: 0, saturation: 0, lightness: 0 };
const DEFAULT_HSL: ColorAdjustments['hsl'] = { reds: { ...DEFAULT_HSL_ITEM }, oranges: { ...DEFAULT_HSL_ITEM }, yellows: { ...DEFAULT_HSL_ITEM }, greens: { ...DEFAULT_HSL_ITEM }, cyans: { ...DEFAULT_HSL_ITEM }, blues: { ...DEFAULT_HSL_ITEM }, purples: { ...DEFAULT_HSL_ITEM }, magentas: { ...DEFAULT_HSL_ITEM } };
const DEFAULT_ADJUSTMENTS: ColorAdjustments = { brightness: 0, contrast: 0, saturation: 0, temp: 0, tint: 0, curves: { master: [{x:0,y:0}, {x:0.25,y:0.25}, {x:0.5,y:0.5}, {x:0.75,y:0.75}, {x:1,y:1}], red: [{x:0,y:0}, {x:0.25,y:0.25}, {x:0.5,y:0.5}, {x:0.75,y:0.75}, {x:1,y:1}], green: [{x:0,y:0}, {x:0.25,y:0.25}, {x:0.5,y:0.5}, {x:0.75,y:0.75}, {x:1,y:1}], blue: [{x:0,y:0}, {x:0.25,y:0.25}, {x:0.5,y:0.5}, {x:0.75,y:0.75}, {x:1,y:1}] }, hsl: DEFAULT_HSL, skin: { hue: 0, saturation: 0, lightness: 0 } };

const App: React.FC = () => {
  const [refImg, setRefImg] = useState<string | null>(null);
  const [targetImg, setTargetImg] = useState<string | null>(null);
  const [adjustments, setAdjustments] = useState<ColorAdjustments>(DEFAULT_ADJUSTMENTS);
  const deferredAdjustments = useDeferredValue(adjustments);

  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [lutUrl, setLutUrl] = useState<string | null>(null);
  const [baseTransferred, setBaseTransferred] = useState<{ pixels: Uint8ClampedArray; width: number; height: number; rStats: AdvancedStats; } | null>(null);
  const [state, setState] = useState<ProcessedState>({ isProcessing: false, error: null, resultUrl: null, lutUrl: null, aiInsights: null, transferMode: 'LUT' });

  const processLook = useCallback(async () => {
    if (!refImg || !targetImg) return;
    setState(p => ({ ...p, isProcessing: true }));
    try {
      const rI = new Image(); rI.src = refImg; await new Promise(res => rI.onload = res);
      const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      canvas.width = rI.width; canvas.height = rI.height; ctx.drawImage(rI, 0, 0);
      const rData = ctx.getImageData(0, 0, rI.width, rI.height).data;
      const rStats = getAdvancedStats(rData);
      
      analyzeImageStyle(refImg).then(insights => setState(p => ({ ...p, aiInsights: insights }))).catch(console.error);
      
      const tI = new Image(); tI.src = targetImg; await new Promise(res => tI.onload = res);
      canvas.width = tI.width; canvas.height = tI.height; ctx.drawImage(tI, 0, 0);
      const tData = ctx.getImageData(0, 0, tI.width, tI.height).data;
      const tStats = getAdvancedStats(tData);
      
      const transferred = transferColorAdvanced(tData, rStats, tStats);
      setBaseTransferred({ pixels: transferred, width: tI.width, height: tI.height, rStats });
      setState(p => ({ ...p, isProcessing: false }));
    } catch (e) { setState(p => ({ ...p, isProcessing: false, error: 'Processing failed.' })); }
  }, [refImg, targetImg]);

  useEffect(() => { processLook(); }, [refImg, targetImg, processLook]);

  // Heavy rendering logic deferred to keep sliders smooth
  useEffect(() => {
    if (!baseTransferred) return;
    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d')!;
    
    // Process Graded Result
    const adjusted = applyColorAdjustments(baseTransferred.pixels, deferredAdjustments);
    canvas.width = baseTransferred.width; canvas.height = baseTransferred.height;
    // Cast to any to satisfy TS ImageDataArray typing in DOM lib
    ctx.putImageData(new ImageData(adjusted as any, canvas.width, canvas.height), 0, 0);
    setResultUrl(canvas.toDataURL('image/jpeg', 0.90)); // Slightly lower quality for faster previews

    // Process HALD LUT
    const nLut = generateHaldLUT();
    const bLut = transferColorAdvanced(nLut, baseTransferred.rStats, { shadows: { mean: [15,0,0], std: [10,10,10] }, midtones: { mean: [50,0,0], std: [15,15,15] }, highlights: { mean: [85,0,0], std: [10,10,10] }, globalMeanL: 50 });
    const fLut = applyColorAdjustments(bLut, deferredAdjustments);
    canvas.width = 512; canvas.height = 512;
    ctx.putImageData(new ImageData(fLut as any, 512, 512), 0, 0);
    setLutUrl(canvas.toDataURL('image/png'));
  }, [baseTransferred, deferredAdjustments]);

  const onUpload = (type: 'ref' | 'target', file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (type === 'ref') setRefImg(e.target?.result as string);
      else setTargetImg(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen pb-12 animate-fade-in bg-slate-950">
      <Header />
      <main className="max-w-7xl mx-auto px-6 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-slate-900/40 p-6 rounded-3xl border border-slate-800 shadow-2xl flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Grading Engine</h2>
              {resultUrl && <a href={resultUrl} download="graded_result.jpg" className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-lg active:scale-95">Save Image</a>}
            </div>
            <div className="flex-1 rounded-2xl overflow-hidden bg-black border border-slate-800 relative flex items-center justify-center">
              {state.isProcessing ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Processing Style...</p>
                </div>
              ) : (resultUrl || refImg) ? (
                <div className="grid grid-cols-2 w-full h-full divide-x divide-slate-800">
                  <div className="relative flex items-center justify-center bg-slate-900/10 p-2 group overflow-hidden">
                    <span className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-slate-900/60 backdrop-blur rounded text-[8px] font-bold uppercase tracking-widest text-slate-400 group-hover:bg-slate-900/90 transition-colors">Original Reference</span>
                    {refImg ? (
                      <img src={refImg} className="max-w-full max-h-[500px] object-contain" alt="Reference" />
                    ) : (
                      <p className="text-slate-800 text-[9px] uppercase font-bold tracking-tighter">Reference Pending</p>
                    )}
                  </div>
                  <div className="relative flex items-center justify-center bg-slate-900/10 p-2 group overflow-hidden">
                    <span className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-indigo-500/40 backdrop-blur rounded text-[8px] font-bold uppercase tracking-widest text-white group-hover:bg-indigo-500/60 transition-colors">Graded Result</span>
                    {resultUrl ? (
                      <img src={resultUrl} className="max-w-full max-h-[500px] object-contain animate-fade-in" alt="Result" />
                    ) : (
                      <p className="text-slate-800 text-[9px] uppercase font-bold tracking-tighter">Grading Target...</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-slate-600 text-[10px] uppercase font-bold tracking-widest text-center px-10">Select Reference and Target images</p>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <AssetInput title="1. Reference" src={refImg} onFile={(f) => onUpload('ref', f)} />
            <AssetInput title="2. Target Image" src={targetImg} onFile={(f) => onUpload('target', f)} />
            <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
                  {lutUrl ? <img src={lutUrl} className="w-full h-full object-cover" /> : <div className="w-4 h-4 bg-slate-800 rounded-sm" />}
                </div>
                <div>
                  <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">3D LUT</p>
                  <p className="text-[9px] text-slate-500 font-mono">512px Hald-8</p>
                </div>
              </div>
              {lutUrl && <a href={lutUrl} download="studio_grade.png" className="mt-4 block w-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold py-2 rounded-lg text-center uppercase tracking-widest transition-colors">Download LUT</a>}
            </div>
          </div>
        </div>

        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900/40 p-5 rounded-3xl border border-slate-800 shadow-xl h-[700px] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/50 mb-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-400">Mastering Panel</h2>
              <button onClick={() => setAdjustments(DEFAULT_ADJUSTMENTS)} className="text-[9px] text-slate-500 hover:text-white uppercase transition-colors font-bold">Clear</button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-6">
              <div className="space-y-4 pt-1">
                <h3 className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Global Tone</h3>
                <AdjustmentSlider label="Exposure" value={adjustments.brightness} min={-100} max={100} onChange={v => setAdjustments(p=>({...p, brightness:v}))} reset={()=>setAdjustments(p=>({...p, brightness:0}))} />
                <AdjustmentSlider label="Contrast" value={adjustments.contrast} min={-100} max={100} onChange={v => setAdjustments(p=>({...p, contrast:v}))} reset={()=>setAdjustments(p=>({...p, contrast:0}))} />
                <AdjustmentSlider label="Saturation" value={adjustments.saturation} min={-100} max={100} onChange={v => setAdjustments(p=>({...p, saturation:v}))} reset={()=>setAdjustments(p=>({...p, saturation:0}))} />
                <div className="grid grid-cols-2 gap-4">
                  <AdjustmentSlider label="Temp" value={adjustments.temp} min={-100} max={100} onChange={v => setAdjustments(p=>({...p, temp:v}))} reset={()=>setAdjustments(p=>({...p, temp:0}))} />
                  <AdjustmentSlider label="Tint" value={adjustments.tint} min={-100} max={100} onChange={v => setAdjustments(p=>({...p, tint:v}))} reset={()=>setAdjustments(p=>({...p, tint:0}))} />
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-800/60">
                <h3 className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Skin Tone</h3>
                <AdjustmentSlider
                  label="Skin Hue"
                  value={adjustments.skin.hue}
                  min={-60}
                  max={60}
                  onChange={v => setAdjustments(p => ({ ...p, skin: { ...p.skin, hue: v } }))}
                  reset={() => setAdjustments(p => ({ ...p, skin: { ...p.skin, hue: 0 } }))}
                />
                <AdjustmentSlider
                  label="Skin Saturation"
                  value={adjustments.skin.saturation}
                  min={-50}
                  max={50}
                  onChange={v => setAdjustments(p => ({ ...p, skin: { ...p.skin, saturation: v } }))}
                  reset={() => setAdjustments(p => ({ ...p, skin: { ...p.skin, saturation: 0 } }))}
                />
                <AdjustmentSlider
                  label="Skin Lightness"
                  value={adjustments.skin.lightness}
                  min={-50}
                  max={50}
                  onChange={v => setAdjustments(p => ({ ...p, skin: { ...p.skin, lightness: v } }))}
                  reset={() => setAdjustments(p => ({ ...p, skin: { ...p.skin, lightness: 0 } }))}
                />
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-800/60">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Color Ranges</h3>
                  <button
                    className="text-[9px] text-slate-500 hover:text-white uppercase transition-colors font-bold"
                    onClick={() => setAdjustments(p => ({ ...p, hsl: DEFAULT_HSL }))}
                  >
                    Reset HSL
                  </button>
                </div>
                <div className="space-y-3">
                  {(['reds','oranges','yellows','greens','cyans','blues','purples','magentas'] as const).map((key) => {
                    const label = key.charAt(0).toUpperCase() + key.slice(1);
                    const hsl = adjustments.hsl[key];
                    return (
                      <div key={key} className="bg-slate-900/40 border border-slate-800 rounded-2xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">{label}</span>
                          <button
                            className="text-[9px] text-slate-500 hover:text-white transition-colors"
                            onClick={() => setAdjustments(p => ({
                              ...p,
                              hsl: {
                                ...p.hsl,
                                [key]: { ...DEFAULT_HSL_ITEM },
                              },
                            }))}
                          >
                            ↺
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <AdjustmentSlider
                            label="Hue"
                            value={hsl.hue}
                            min={-60}
                            max={60}
                            onChange={v => setAdjustments(p => ({
                              ...p,
                              hsl: {
                                ...p.hsl,
                                [key]: { ...p.hsl[key], hue: v },
                              },
                            }))}
                            reset={() => setAdjustments(p => ({
                              ...p,
                              hsl: {
                                ...p.hsl,
                                [key]: { ...p.hsl[key], hue: 0 },
                              },
                            }))}
                          />
                          <AdjustmentSlider
                            label="Sat"
                            value={hsl.saturation}
                            min={-50}
                            max={50}
                            onChange={v => setAdjustments(p => ({
                              ...p,
                              hsl: {
                                ...p.hsl,
                                [key]: { ...p.hsl[key], saturation: v },
                              },
                            }))}
                            reset={() => setAdjustments(p => ({
                              ...p,
                              hsl: {
                                ...p.hsl,
                                [key]: { ...p.hsl[key], saturation: 0 },
                              },
                            }))}
                          />
                          <AdjustmentSlider
                            label="Tone"
                            value={hsl.lightness}
                            min={-50}
                            max={50}
                            onChange={v => setAdjustments(p => ({
                              ...p,
                              hsl: {
                                ...p.hsl,
                                [key]: { ...p.hsl[key], lightness: v },
                              },
                            }))}
                            reset={() => setAdjustments(p => ({
                              ...p,
                              hsl: {
                                ...p.hsl,
                                [key]: { ...p.hsl[key], lightness: 0 },
                              },
                            }))}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {state.aiInsights && (
                <div className="pt-6 border-t border-slate-800/50 space-y-3 animate-slide-up">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest">AI Style Profile</h3>
                    <span className="text-[9px] text-indigo-500 font-bold">{state.aiInsights.styleName}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 italic leading-relaxed opacity-80">"{state.aiInsights.description}"</p>
                  <div className="flex gap-1">
                    {state.aiInsights.palette.map((c, i) => <div key={i} className="flex-1 h-3 rounded-full border border-white/5" style={{ backgroundColor: c }} title={c} />)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default App;
