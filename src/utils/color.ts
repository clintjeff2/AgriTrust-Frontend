import type { LabColor, OklchColor, RgbColor } from "@/src/types/visualization";

const REF_X = 0.95047;
const REF_Y = 1;
const REF_Z = 1.08883;
const EPSILON = 216 / 24389;
const KAPPA = 24389 / 27;

export function oklchToRgb({ l, c, h }: OklchColor): RgbColor {
  const hue = (h * Math.PI) / 180;
  const a = Math.cos(hue) * c;
  const b = Math.sin(hue) * c;

  const lPrime = l + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = l - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = lPrime ** 3;
  const m3 = mPrime ** 3;
  const s3 = sPrime ** 3;

  return {
    r: clamp01(linearToSrgb(+4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3)),
    g: clamp01(linearToSrgb(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3)),
    b: clamp01(linearToSrgb(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3)),
  };
}

export function rgbToHex({ r, g, b }: RgbColor): string {
  return `#${[r, g, b].map((v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, "0")).join("")}`;
}

export function rgbToLab(rgb: RgbColor): LabColor {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);

  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / REF_X;
  const y = (0.2126729 * r + 0.7151522 * g + 0.072175 * b) / REF_Y;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / REF_Z;

  const fx = labPivot(x);
  const fy = labPivot(y);
  const fz = labPivot(z);

  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function ciede2000(left: LabColor, right: LabColor): number {
  const kL = 1;
  const kC = 1;
  const kH = 1;
  const c1 = Math.hypot(left.a, left.b);
  const c2 = Math.hypot(right.a, right.b);
  const cBar = (c1 + c2) / 2;
  const g = 0.5 * (1 - Math.sqrt(cBar ** 7 / (cBar ** 7 + 25 ** 7)));
  const a1p = (1 + g) * left.a;
  const a2p = (1 + g) * right.a;
  const c1p = Math.hypot(a1p, left.b);
  const c2p = Math.hypot(a2p, right.b);
  const h1p = hueDegrees(left.b, a1p);
  const h2p = hueDegrees(right.b, a2p);
  const dLp = right.l - left.l;
  const dCp = c2p - c1p;
  const dhp = deltaHue(h1p, h2p, c1p, c2p);
  const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin(degToRad(dhp / 2));
  const lBar = (left.l + right.l) / 2;
  const cBarP = (c1p + c2p) / 2;
  const hBarP = averageHue(h1p, h2p, c1p, c2p);
  const t = 1 - 0.17 * Math.cos(degToRad(hBarP - 30)) + 0.24 * Math.cos(degToRad(2 * hBarP)) + 0.32 * Math.cos(degToRad(3 * hBarP + 6)) - 0.2 * Math.cos(degToRad(4 * hBarP - 63));
  const deltaTheta = 30 * Math.exp(-(((hBarP - 275) / 25) ** 2));
  const rC = 2 * Math.sqrt(cBarP ** 7 / (cBarP ** 7 + 25 ** 7));
  const sL = 1 + (0.015 * ((lBar - 50) ** 2)) / Math.sqrt(20 + (lBar - 50) ** 2);
  const sC = 1 + 0.045 * cBarP;
  const sH = 1 + 0.015 * cBarP * t;
  const rT = -Math.sin(degToRad(2 * deltaTheta)) * rC;
  return Math.sqrt((dLp / (kL * sL)) ** 2 + (dCp / (kC * sC)) ** 2 + (dHp / (kH * sH)) ** 2 + rT * (dCp / (kC * sC)) * (dHp / (kH * sH)));
}

function linearToSrgb(value: number): number { return value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055; }
function srgbToLinear(value: number): number { return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; }
function labPivot(value: number): number { return value > EPSILON ? Math.cbrt(value) : (KAPPA * value + 16) / 116; }
function clamp01(value: number): number { return Math.min(1, Math.max(0, value)); }
function hueDegrees(y: number, x: number): number { return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360; }
function degToRad(value: number): number { return (value * Math.PI) / 180; }
function deltaHue(h1: number, h2: number, c1: number, c2: number): number { if (c1 * c2 === 0) return 0; const diff = h2 - h1; if (Math.abs(diff) <= 180) return diff; return diff > 180 ? diff - 360 : diff + 360; }
function averageHue(h1: number, h2: number, c1: number, c2: number): number { if (c1 * c2 === 0) return h1 + h2; if (Math.abs(h1 - h2) <= 180) return (h1 + h2) / 2; return h1 + h2 < 360 ? (h1 + h2 + 360) / 2 : (h1 + h2 - 360) / 2; }
