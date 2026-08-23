'use client';

import { useEffect, useRef } from 'react';

// ─── Canvas animation config ──────────────────────────────────────────────────
const GAP = 36;
const RADIUS_VMIN = 28;
const SPEED_IN = 0.5;
const SPEED_OUT = 0.6;
const REST_SCALE = 0.06;
const MIN_HOVER_SCALE = 0.7;
const MAX_HOVER_SCALE = 1.8;
const WAVE_SPEED = 1100;
const WAVE_WIDTH = 160;

const PALETTE = [
  { type: 'solid', value: '#22c55e' }, { type: 'solid', value: '#06b6d4' },
  { type: 'solid', value: '#f97316' }, { type: 'solid', value: '#ef4444' },
  { type: 'solid', value: '#facc15' }, { type: 'solid', value: '#ec4899' },
  { type: 'solid', value: '#9ca3af' }, { type: 'solid', value: '#a78bfa' },
  { type: 'solid', value: '#60a5fa' }, { type: 'solid', value: '#34d399' },
  { type: 'gradient', stops: ['#6366f1', '#3b82f6'] },
  { type: 'gradient', stops: ['#06b6d4', '#6366f1'] },
  { type: 'gradient', stops: ['#22c55e', '#06b6d4'] },
  { type: 'gradient', stops: ['#f97316', '#ef4444'] },
  { type: 'gradient', stops: ['#8b5cf6', '#06b6d4'] },
] as const;

const SHAPE_TYPES = ['heart', 'user', 'message', 'repeat', 'check'] as const;
type ColorDef = typeof PALETTE[number];
type ShapeType = typeof SHAPE_TYPES[number];
interface Shape { x: number; y: number; type: ShapeType; color: ColorDef; angle: number; size: number; scale: number; maxScale: number; hovered: boolean; }

const ICON_PATHS_STRINGS = {
  heart: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z',
  user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  message: 'M7.9 20A9 9 0 1 0 4 16.1L2 22Z',
  repeat: 'm17 2 4 4-4 4 M3 11v-1a4 4 0 0 1 4-4h14 M7 22l-4-4 4-4 M21 13v1a4 4 0 0 1-4 4H3',
  check: 'M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3'
};

function rnd(a: number, b: number) { return Math.random() * (b - a) + a; }
function pick<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function smoothstep(t: number) { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c); }
function durationToFactor(s: number) { if (s <= 0) return 1; return 1 - Math.pow(0.05, 1 / (60 * s)); }

function drawIcon(c: CanvasRenderingContext2D, s: Shape, paths: Record<string, Path2D>) {
  const scale = (s.size / 12) * 0.7; // size is radius, viewBox is 24x24
  c.scale(scale, scale);
  c.translate(-12, -12);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.lineWidth = 2.5;
  const path = paths[s.type];
  if (path) c.stroke(path);
}

function resolveFill(c: CanvasRenderingContext2D, colorDef: ColorDef, sz: number): string | CanvasGradient {
  if (colorDef.type === 'solid') return colorDef.value;
  const stops = (colorDef as { type: 'gradient'; stops: readonly string[] }).stops;
  const g = c.createRadialGradient(0, -sz * 0.3, 0, 0, sz * 0.3, sz * 1.5);
  g.addColorStop(0, stops[0]); g.addColorStop(1, stops[1]); return g;
}

function buildGrid(W: number, H: number): Shape[] {
  const cols = Math.floor(W / GAP), rows = Math.floor(H / GAP);
  const ox = (W - (cols - 1) * GAP) / 2, oy = (H - (rows - 1) * GAP) / 2;
  const shapes: Shape[] = [];
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const s: Shape = {
        x: ox + col * GAP, y: oy + r * GAP,
        type: pick(SHAPE_TYPES), color: pick(PALETTE),
        angle: rnd(0, Math.PI * 2), size: 12,
        scale: REST_SCALE, maxScale: rnd(MIN_HOVER_SCALE, MAX_HOVER_SCALE),
        hovered: false,
      };
      shapes.push(s);
    }
  }
  return shapes;
}

interface AnimatedCanvasProps {
  blurCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  blurWidthRatio?: number;
  className?: string;
  interactive?: boolean;
}

export function AnimatedCanvas({ blurCanvasRef, blurWidthRatio, className = '', interactive = true }: AnimatedCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas.getContext('2d')!;
    if (!c) return;

    let shapes: Shape[] = [], rafId: number;
    let pointer: { x: number; y: number } | null = null;
    let activity = 0;
    let waves: { x: number; y: number; startTime: number }[] = [];
    let maskRects: DOMRect[] = [], frameCount = 0, maskOverride = false, W = 0, H = 0;

    const iconPaths = {
      heart: new Path2D(ICON_PATHS_STRINGS.heart),
      user: new Path2D(ICON_PATHS_STRINGS.user),
      message: new Path2D(ICON_PATHS_STRINGS.message),
      repeat: new Path2D(ICON_PATHS_STRINGS.repeat),
      check: new Path2D(ICON_PATHS_STRINGS.check),
    };

    function init() {
      W = window.innerWidth; H = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = W * dpr; canvas!.height = H * dpr;
      canvas!.style.width = W + 'px'; canvas!.style.height = H + 'px';
      c.setTransform(1, 0, 0, 1, 0, 0); c.scale(dpr, dpr);

      // Size the blur canvas if provided
      if (blurCanvasRef && blurCanvasRef.current) {
        const bc = blurCanvasRef.current;
        const panelW = blurWidthRatio ? Math.max(320, Math.round(W * blurWidthRatio)) : W;
        bc.width = panelW * dpr; bc.height = H * dpr;
        bc.style.width = panelW + 'px'; bc.style.height = H + 'px';
      }

      shapes = buildGrid(W, H);
    }

    function tick() {
      const radius = Math.min(W, H) * (RADIUS_VMIN / 100), now = performance.now();
      c.clearRect(0, 0, W, H); c.fillStyle = '#080808'; c.fillRect(0, 0, W, H);

      activity *= 0.93;
      if (++frameCount % 10 === 0) maskRects = Array.from(document.querySelectorAll('[data-shape-mask]')).map(el => el.getBoundingClientRect());
      const maxDist = Math.sqrt(W * W + H * H);
      waves = waves.filter(w => (now - w.startTime) / 1000 * WAVE_SPEED < maxDist + WAVE_WIDTH);

      for (const s of shapes) {
        const pad = GAP / 2;
        const masked = !maskOverride && maskRects.some(r => s.x >= r.left - pad && s.x <= r.right + pad && s.y >= r.top - pad && s.y <= r.bottom + pad);
        if (masked) { s.scale += (0 - s.scale) * durationToFactor(SPEED_OUT); if (s.scale < 0.005) s.scale = 0; continue; }

        let pi = 0;
        if (pointer && activity > 0.001) {
          const dist = Math.sqrt((s.x - pointer.x) ** 2 + (s.y - pointer.y) ** 2);
          pi = smoothstep(1 - dist / radius) * activity;
          if (pi > 0.05 && !s.hovered) { s.hovered = true; s.maxScale = rnd(MIN_HOVER_SCALE, MAX_HOVER_SCALE); s.angle = rnd(0, Math.PI * 2); }
          else if (pi <= 0.05) s.hovered = false;
        } else s.hovered = false;

        let wi = 0;
        for (const wave of waves) { const wr = (now - wave.startTime) / 1000 * WAVE_SPEED; const wd = Math.sqrt((s.x - wave.x) ** 2 + (s.y - wave.y) ** 2); const t = 1 - Math.abs(wd - wr) / WAVE_WIDTH; if (t > 0) wi = Math.max(wi, Math.sin(Math.PI * t)); }

        const target = Math.max(REST_SCALE + pi * (s.maxScale - REST_SCALE), REST_SCALE + wi * (s.maxScale - REST_SCALE));
        s.scale += (target - s.scale) * (target > s.scale ? durationToFactor(SPEED_IN) : durationToFactor(SPEED_OUT));
        if (s.scale < REST_SCALE * 0.15) continue;

        c.save();
        c.translate(s.x, s.y);
        c.rotate(s.angle);
        c.scale(s.scale, s.scale);

        const fill = resolveFill(c, s.color, s.size);
        c.strokeStyle = fill as string;

        drawIcon(c, s, iconPaths);

        c.restore();
      }
      rafId = requestAnimationFrame(tick);

      // Draw 1:1 copy to blur canvas if provided
      if (blurCanvasRef && blurCanvasRef.current) {
        const bc = blurCanvasRef.current;
        const bctx = bc.getContext('2d')!;
        bctx.clearRect(0, 0, bc.width, bc.height);
        
        bctx.drawImage(canvas!, 0, 0, bc.width, bc.height, 0, 0, bc.width, bc.height);
        
        bctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
        bctx.fillRect(0, 0, bc.width, bc.height);
      }
    }

    function triggerWave(x?: number, y?: number) {
      waves.push({ x: x ?? W / 2, y: y ?? H / 2, startTime: performance.now() });
      maskOverride = true;
      setTimeout(() => { maskOverride = false; }, Math.sqrt(W * W + H * H) / WAVE_SPEED * 1000);
    }

    const onMove = (e: PointerEvent) => { pointer = { x: e.clientX, y: e.clientY }; activity = 1; };
    const onClick = (e: MouseEvent) => triggerWave(e.clientX, e.clientY);

    init(); rafId = requestAnimationFrame(tick);
    window.addEventListener('resize', init);
    if (interactive) {
      window.addEventListener('pointermove', onMove);
      window.addEventListener('click', onClick);
    }
    triggerWave();
    
    return () => { 
      cancelAnimationFrame(rafId); 
      window.removeEventListener('resize', init); 
      if (interactive) {
        window.removeEventListener('pointermove', onMove); 
        window.removeEventListener('click', onClick); 
      }
    };
  }, [blurCanvasRef, blurWidthRatio, interactive]);

  return <canvas ref={canvasRef} className={`absolute inset-0 block z-0 ${className}`} />;
}
