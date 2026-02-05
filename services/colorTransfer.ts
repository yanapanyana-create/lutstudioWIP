
import { ColorStats, ColorAdjustments, CurvePoint, HSLAdjustment, AdvancedStats } from '../types';

export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  let r_ = r / 255;
  let g_ = g / 255;
  let b_ = b / 255;
  r_ = r_ > 0.04045 ? Math.pow((r_ + 0.055) / 1.055, 2.4) : r_ / 12.92;
  g_ = g_ > 0.04045 ? Math.pow((g_ + 0.055) / 1.055, 2.4) : g_ / 12.92;
  b_ = b_ > 0.04045 ? Math.pow((b_ + 0.055) / 1.055, 2.4) : b_ / 12.92;
  let x = (r_ * 0.4124 + g_ * 0.3576 + b_ * 0.1805) * 100;
  let y = (r_ * 0.2126 + g_ * 0.7152 + b_ * 0.0722) * 100;
  let z = (r_ * 0.0193 + g_ * 0.1192 + b_ * 0.9505) * 100;
  x /= 95.047; y /= 100.000; z /= 108.883;
  x = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x) + (16 / 116);
  y = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y) + (16 / 116);
  z = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z) + (16 / 116);
  return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)];
}

export function labToRgb(l: number, a: number, b: number): [number, number, number] {
  let y = (l + 16) / 116;
  let x = a / 500 + y;
  let z = y - b / 200;
  x = Math.pow(x, 3) > 0.008856 ? Math.pow(x, 3) : (x - 16 / 116) / 7.787;
  y = Math.pow(y, 3) > 0.008856 ? Math.pow(y, 3) : (y - 16 / 116) / 7.787;
  z = Math.pow(z, 3) > 0.008856 ? Math.pow(z, 3) : (z - 16 / 116) / 7.787;
  x *= 95.047; y *= 100.000; z *= 108.883;
  x /= 100; y /= 100; z /= 100;
  let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
  let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
  let b_ = x * 0.0557 + y * -0.2040 + z * 1.0570;
  r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
  b_ = b_ > 0.0031308 ? 1.055 * Math.pow(b_, 1 / 2.4) - 0.055 : 12.92 * b_;
  return [Math.max(0, Math.min(255, r * 255)), Math.max(0, Math.min(255, g * 255)), Math.max(0, Math.min(255, b_ * 255))];
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;
  if (s === 0) { r = g = b = l; } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [r * 255, g * 255, b * 255];
}

function interpolateCurve(val: number, points: CurvePoint[]): number {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  if (val <= sorted[0].x) return sorted[0].y;
  if (val >= sorted[sorted.length - 1].x) return sorted[sorted.length - 1].y;
  for (let i = 0; i < sorted.length - 1; i++) {
    const p1 = sorted[i]; const p2 = sorted[i + 1];
    if (val >= p1.x && val <= p2.x) {
      const t = (val - p1.x) / (p2.x - p1.x);
      return p1.y + t * (p2.y - p1.y);
    }
  }
  return val;
}

function getHSLAdjust(hue: number, hsl: ColorAdjustments['hsl']): HSLAdjustment {
  const h = (hue + 360) % 360;
  if (h >= 345 || h < 15) return hsl.reds;
  if (h >= 15 && h < 45) return hsl.oranges;
  if (h >= 45 && h < 75) return hsl.yellows;
  if (h >= 75 && h < 165) return hsl.greens;
  if (h >= 165 && h < 195) return hsl.cyans;
  if (h >= 195 && h < 255) return hsl.blues;
  if (h >= 255 && h < 315) return hsl.purples;
  return hsl.magentas;
}

export function applyColorAdjustments(data: Uint8ClampedArray, adj: ColorAdjustments): Uint8ClampedArray {
  const result = new Uint8ClampedArray(data.length);
  const bright = adj.brightness / 100;
  const contrast = (adj.contrast + 100) / 100;
  const saturation = (adj.saturation + 100) / 100;
  const temp = adj.temp / 5;
  const tint = adj.tint / 5;

  // Optimization: Check if HSL or LAB adjustments are actually used to skip expensive conversions
  const hasSkinAdj = adj.skin.hue !== 0 || adj.skin.saturation !== 0 || adj.skin.lightness !== 0;
  const hasHslAdj = Object.values(adj.hsl).some(a => a.hue !== 0 || a.saturation !== 0 || a.lightness !== 0);
  const hasLabAdj = temp !== 0 || tint !== 0;

  const curvesLUT = {
    m: new Uint8Array(256), r: new Uint8Array(256), g: new Uint8Array(256), b: new Uint8Array(256)
  };
  for (let i = 0; i < 256; i++) {
    const n = i / 255;
    curvesLUT.m[i] = Math.max(0, Math.min(255, interpolateCurve(n, adj.curves.master) * 255));
    curvesLUT.r[i] = Math.max(0, Math.min(255, interpolateCurve(n, adj.curves.red) * 255));
    curvesLUT.g[i] = Math.max(0, Math.min(255, interpolateCurve(n, adj.curves.green) * 255));
    curvesLUT.b[i] = Math.max(0, Math.min(255, interpolateCurve(n, adj.curves.blue) * 255));
  }

  for (let i = 0; i < data.length; i += 4) {
    let r = curvesLUT.r[data[i]];
    let g = curvesLUT.g[data[i+1]];
    let b = curvesLUT.b[data[i+2]];
    r = curvesLUT.m[r]; g = curvesLUT.m[g]; b = curvesLUT.m[b];

    // Basic Brightness & Contrast
    r = ((r / 255 - 0.5) * contrast + 0.5 + bright) * 255;
    g = ((g / 255 - 0.5) * contrast + 0.5 + bright) * 255;
    b = ((b / 255 - 0.5) * contrast + 0.5 + bright) * 255;

    // Fast-path HSL processing
    if (hasSkinAdj || hasHslAdj) {
      const [hVal, sVal, lVal] = rgbToHsl(r, g, b);
      let newH = hVal, newS = sVal, newL = lVal;

      if (hasSkinAdj) {
        const isSkin = hVal > 0 && hVal < 45 && sVal > 8 && lVal > 15;
        if (isSkin) {
           newH += adj.skin.hue;
           newS += adj.skin.saturation;
           newL += adj.skin.lightness;
        }
      }

      if (hasHslAdj) {
        const hslTarget = getHSLAdjust(newH, adj.hsl);
        newH += hslTarget.hue;
        newS += hslTarget.saturation;
        newL += hslTarget.lightness;
      }

      const rgbHsl = hslToRgb(newH, Math.max(0, Math.min(100, newS)), Math.max(0, Math.min(100, newL)));
      r = rgbHsl[0]; g = rgbHsl[1]; b = rgbHsl[2];
    }

    // Fast-path Saturation
    if (saturation !== 1) {
      const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
      r = gray + (r - gray) * saturation;
      g = gray + (g - gray) * saturation;
      b = gray + (b - gray) * saturation;
    }

    // Fast-path LAB (Temp/Tint)
    if (hasLabAdj) {
      const lab = rgbToLab(r, g, b);
      lab[1] += tint; lab[2] += temp;
      const finalRgb = labToRgb(lab[0], lab[1], lab[2]);
      r = finalRgb[0]; g = finalRgb[1]; b = finalRgb[2];
    }

    result[i] = r; result[i+1] = g; result[i+2] = b; result[i+3] = data[i+3];
  }
  return result;
}

export function getAdvancedStats(imageData: Uint8ClampedArray): AdvancedStats {
  const shadowPixels: [number, number, number][] = [];
  const midPixels: [number, number, number][] = [];
  const highPixels: [number, number, number][] = [];
  let totalL = 0;

  for (let i = 0; i < imageData.length; i += 4) {
    const lab = rgbToLab(imageData[i], imageData[i + 1], imageData[i + 2]);
    const l = lab[0];
    totalL += l;
    if (l < 33) shadowPixels.push(lab);
    else if (l < 66) midPixels.push(lab);
    else highPixels.push(lab);
  }

  const calc = (pixels: [number, number, number][]): ColorStats => {
    if (pixels.length === 0) return { mean: [50, 0, 0], std: [15, 10, 10] };
    let lSum = 0, aSum = 0, bSum = 0;
    for (const p of pixels) { lSum += p[0]; aSum += p[1]; bSum += p[2]; }
    const mean: [number, number, number] = [lSum / pixels.length, aSum / pixels.length, bSum / pixels.length];
    let lVar = 0, aVar = 0, bVar = 0;
    for (const p of pixels) {
      lVar += Math.pow(p[0] - mean[0], 2);
      aVar += Math.pow(p[1] - mean[1], 2);
      bVar += Math.pow(p[2] - mean[2], 2);
    }
    const count = pixels.length || 1;
    const EPS = 0.0001;
    return { 
      mean, 
      std: [Math.sqrt(lVar / count) + EPS, Math.sqrt(aVar / count) + EPS, Math.sqrt(bVar / count) + EPS] 
    };
  };

  return { 
    shadows: calc(shadowPixels), 
    midtones: calc(midPixels), 
    highlights: calc(highPixels),
    globalMeanL: totalL / (imageData.length / 4 || 1)
  };
}

export function transferColorAdvanced(
  targetData: Uint8ClampedArray,
  sourceStats: AdvancedStats,
  targetStats: AdvancedStats
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(targetData.length);
  
  for (let i = 0; i < targetData.length; i += 4) {
    const lab = rgbToLab(targetData[i], targetData[i + 1], targetData[i + 2]);
    const l = lab[0];

    let sMean = [0,0,0], sStd = [1,1,1], tMean = [0,0,0], tStd = [1,1,1];
    if (l <= 33) {
      const t = l / 33;
      for(let j=0; j<3; j++) {
        sMean[j] = sourceStats.shadows.mean[j] * (1-t) + sourceStats.midtones.mean[j] * t;
        sStd[j] = sourceStats.shadows.std[j] * (1-t) + sourceStats.midtones.std[j] * t;
        tMean[j] = targetStats.shadows.mean[j] * (1-t) + targetStats.midtones.mean[j] * t;
        tStd[j] = targetStats.shadows.std[j] * (1-t) + targetStats.midtones.std[j] * t;
      }
    } else if (l <= 66) {
      const t = (l - 33) / 33;
      for(let j=0; j<3; j++) {
        sMean[j] = sourceStats.midtones.mean[j] * (1-t) + sourceStats.highlights.mean[j] * t;
        sStd[j] = sourceStats.midtones.std[j] * (1-t) + sourceStats.highlights.std[j] * t;
        tMean[j] = targetStats.midtones.mean[j] * (1-t) + targetStats.highlights.mean[j] * t;
        tStd[j] = targetStats.midtones.std[j] * (1-t) + targetStats.highlights.std[j] * t;
      }
    } else {
      sMean = sourceStats.highlights.mean; sStd = sourceStats.highlights.std;
      tMean = targetStats.highlights.mean; tStd = targetStats.highlights.std;
    }

    const newA = (lab[1] - tMean[1]) * (sStd[1] / tStd[1]) + sMean[1];
    const newB = (lab[2] - tMean[2]) * (sStd[2] / tStd[2]) + sMean[2];
    let shiftedL = (lab[0] - tMean[0]) * (sStd[0] / tStd[0]) + sMean[0];
    
    const finalL = Math.max(0, Math.min(100, shiftedL));

    const rgb = labToRgb(finalL, newA, newB);
    result[i] = rgb[0]; result[i + 1] = rgb[1]; result[i + 2] = rgb[2]; result[i + 3] = targetData[i + 3];
  }
  return result;
}

export function generateHaldLUT(): Uint8ClampedArray {
  const size = 64; 
  const dim = 512; 
  const pixels = new Uint8ClampedArray(dim * dim * 4);
  const step = 255 / (size - 1);
  
  for (let b = 0; b < size; b++) {
    const tileY = Math.floor(b / 8);
    const tileX = b % 8;
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const x = tileX * size + r;
        const y = tileY * size + g;
        const idx = (y * dim + x) * 4;
        pixels[idx] = Math.round(r * step);
        pixels[idx + 1] = Math.round(g * step);
        pixels[idx + 2] = Math.round(b * step);
        pixels[idx + 3] = 255;
      }
    }
  }
  return pixels;
}
