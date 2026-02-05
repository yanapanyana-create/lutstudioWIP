
export interface ColorStats {
  mean: [number, number, number];
  std: [number, number, number];
}

export interface AdvancedStats {
  shadows: ColorStats;
  midtones: ColorStats;
  highlights: ColorStats;
  globalMeanL: number;
}

export interface ImageAnalysis {
  description: string;
  palette: string[];
  styleName: string;
}

export interface CurvePoint {
  x: number;
  y: number;
}

export interface CurvesState {
  master: CurvePoint[];
  red: CurvePoint[];
  green: CurvePoint[];
  blue: CurvePoint[];
}

export interface HSLAdjustment {
  hue: number;        // -180 to 180
  saturation: number; // -100 to 100
  lightness: number;  // -100 to 100
}

export interface HSLAdjustments {
  reds: HSLAdjustment;
  oranges: HSLAdjustment;
  yellows: HSLAdjustment;
  greens: HSLAdjustment;
  cyans: HSLAdjustment;
  blues: HSLAdjustment;
  purples: HSLAdjustment;
  magentas: HSLAdjustment;
}

export interface SkinToneAdjustment {
  hue: number;
  saturation: number;
  lightness: number;
}

export interface ColorAdjustments {
  brightness: number; 
  contrast: number;   
  saturation: number; 
  temp: number;       
  tint: number;       
  curves: CurvesState;
  hsl: HSLAdjustments;
  skin: SkinToneAdjustment;
}

export interface Preset {
  id: string;
  name: string;
  adjustments: ColorAdjustments;
}

export type TransferMode = 'LUT';

export interface ProcessedState {
  isProcessing: boolean;
  error: string | null;
  resultUrl: string | null;
  lutUrl: string | null;
  aiInsights: ImageAnalysis | null;
  transferMode: TransferMode;
}
