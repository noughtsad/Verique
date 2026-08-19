'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { login, register } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import './login.css';

// ─── Canvas animation config ──────────────────────────────────────────────────
const GAP = 44;
const RADIUS_VMIN = 28;
const SPEED_IN = 0.5;
const SPEED_OUT = 0.6;
const REST_SCALE = 0.07;
const MIN_HOVER_SCALE = 0.9;
const MAX_HOVER_SCALE = 2.5;
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

const SHAPE_TYPES = ['circle', 'pill', 'star', 'star'] as const;
type ColorDef = typeof PALETTE[number];
type ShapeType = typeof SHAPE_TYPES[number];
interface Shape { x: number; y: number; type: ShapeType; color: ColorDef; angle: number; size: number; scale: number; maxScale: number; hovered: boolean; points?: number; innerRatio?: number; }

function rnd(a: number, b: number) { return Math.random() * (b - a) + a; }
function rndInt(a: number, b: number) { return Math.floor(rnd(a, b + 1)); }
function pick<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function smoothstep(t: number) { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c); }
function durationToFactor(s: number) { if (s <= 0) return 1; return 1 - Math.pow(0.05, 1 / (60 * s)); }

function drawCircle(c: CanvasRenderingContext2D, sz: number) { c.beginPath(); c.arc(0, 0, sz, 0, Math.PI * 2); c.fill(); }
function drawPill(c: CanvasRenderingContext2D, sz: number) { const w = sz * 0.48; c.beginPath(); c.roundRect(-w, -sz, w * 2, sz * 2, w); c.fill(); }
function drawStar(c: CanvasRenderingContext2D, sz: number, pts: number, ir: number) {
  c.beginPath();
  for (let i = 0; i < pts * 2; i++) { const a = (i * Math.PI) / pts - Math.PI / 2; const r = i % 2 === 0 ? sz : sz * ir; i === 0 ? c.moveTo(Math.cos(a) * r, Math.sin(a) * r) : c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  c.closePath(); c.fill();
}
function drawShape(c: CanvasRenderingContext2D, s: Shape) {
  switch (s.type) { case 'circle': return drawCircle(c, s.size / 1.5); case 'pill': return drawPill(c, s.size / 1.4); case 'star': return drawStar(c, s.size, s.points!, s.innerRatio!); }
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
  for (let r = 0; r < rows; r++) for (let col = 0; col < cols; col++) {
    const type = pick(SHAPE_TYPES);
    const s: Shape = { x: ox + col * GAP, y: oy + r * GAP, type, color: pick(PALETTE), angle: rnd(0, Math.PI * 2), size: GAP * 0.35, scale: REST_SCALE, maxScale: rnd(MIN_HOVER_SCALE, MAX_HOVER_SCALE), hovered: false };
    if (type === 'star') { s.points = rndInt(4, 8); s.innerRatio = rnd(0.15, 0.45); }
    shapes.push(s);
  }
  return shapes;
}

// ─── Globe card data ──────────────────────────────────────────────────────────
const GLOBE_CARDS = [
  { user: 'alex_news', init: 'A', color: '#6366f1', text: 'Scientists confirm breakthrough in renewable energy storage.', likes: 1240, verified: true },
  { user: 'priya_facts', init: 'P', color: '#06b6d4', text: 'New study shows 3hrs of sleep is enough — CLAIM DISPUTED', likes: 892, verified: false },
  { user: 'mark_truth', init: 'M', color: '#22c55e', text: '🌍 Climate summit agrees on net-zero by 2040 roadmap.', likes: 3421, verified: true },
  { user: 'sara_daily', init: 'S', color: '#f97316', text: 'Breaking: Central bank raises rates by 0.5% amid inflation.', likes: 567, verified: true },
  { user: 'dev_post', init: 'D', color: '#a78bfa', text: 'AI models now outperform doctors in early cancer detection.', likes: 2100, verified: true },
  { user: 'leila_watch', init: 'L', color: '#ec4899', text: 'CLAIM: Moon landing footage was shot in Hollywood studio.', likes: 312, verified: false },
  { user: 'omar_lens', init: 'O', color: '#facc15', text: 'Record turnout in municipal elections across 14 states.', likes: 789, verified: true },
  { user: 'nina_verify', init: 'N', color: '#34d399', text: 'New vaccine shows 94% efficacy in phase 3 trials.', likes: 4502, verified: true },
  { user: 'kai_report', init: 'K', color: '#ef4444', text: 'Stock markets hit all-time high on strong earnings data.', likes: 1023, verified: true },
  { user: 'jess_check', init: 'J', color: '#60a5fa', text: 'DISPUTED: Drinking lemon water daily cures diabetes.', likes: 201, verified: false },
  { user: 'raj_globe', init: 'R', color: '#06b6d4', text: 'Space agency announces first crewed Mars mission for 2031.', likes: 5890, verified: true },
  { user: 'bella_scan', init: 'B', color: '#22c55e', text: 'City council approves €2B public transport overhaul.', likes: 1345, verified: true },
  { user: 'tomás_now', init: 'T', color: '#9ca3af', text: 'FACT-CHECKED ✓ Water fluoridation is safe and effective.', likes: 678, verified: true },
  { user: 'yuna_pulse', init: 'Y', color: '#f97316', text: 'Earthquake magnitude 6.2 strikes Pacific Rim — no tsunami.', likes: 2231, verified: true },
  { user: 'finn_data', init: 'F', color: '#a78bfa', text: 'CLAIM: 5G towers cause health issues. Evidence: None found.', likes: 445, verified: false },
  { user: 'chen_live', init: 'C', color: '#ec4899', text: 'Researchers develop biodegradable plastic alternative.', likes: 3102, verified: true },
  { user: 'amara_hq', init: 'A', color: '#6366f1', text: 'Survey: 78% of Gen-Z use social media as primary news source.', likes: 1567, verified: true },
  { user: 'sol_facts', init: 'S', color: '#facc15', text: 'MISLEADING: Headline omits crucial context on tax reform.', likes: 934, verified: false },
];

// Position cards on sphere surface using Fibonacci lattice
function getSpherePositions(n: number, R: number) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: n }, (_, i) => {
    const y = 1 - (i / (n - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = golden * i;
    return {
      rotY: (Math.atan2(Math.cos(theta) * radius, Math.sin(theta) * radius) * 180) / Math.PI,
      rotX: (-Math.asin(y) * 180) / Math.PI,
    };
  });
}

const SPHERE_R = 380;
const SPHERE_POSITIONS = getSpherePositions(GLOBE_CARDS.length, SPHERE_R);

// ─── Component ────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── Canvas ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d')!;
    if (!ctx2d) return;

    let shapes: Shape[] = [], rafId: number;
    let pointer: { x: number; y: number } | null = null;
    let activity = 0;
    let waves: { x: number; y: number; startTime: number }[] = [];
    let maskRects: DOMRect[] = [], frameCount = 0, maskOverride = false, W = 0, H = 0;

    function init() {
      W = window.innerWidth; H = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = W * dpr; canvas!.height = H * dpr;
      canvas!.style.width = W + 'px'; canvas!.style.height = H + 'px';
      ctx2d.setTransform(1, 0, 0, 1, 0, 0); ctx2d.scale(dpr, dpr);
      shapes = buildGrid(W, H);
    }

    function tick() {
      const radius = Math.min(W, H) * (RADIUS_VMIN / 100), now = performance.now();
      ctx2d.clearRect(0, 0, W, H); ctx2d.fillStyle = '#080808'; ctx2d.fillRect(0, 0, W, H);
      activity *= 0.93;
      if (++frameCount % 10 === 0) maskRects = Array.from(document.querySelectorAll('[data-shape-mask]')).map(el => el.getBoundingClientRect());
      const maxDist = Math.sqrt(W * W + H * H);
      waves = waves.filter(w => (now - w.startTime) / 1000 * WAVE_SPEED < maxDist + WAVE_WIDTH);

      for (const shape of shapes) {
        const pad = GAP / 2;
        const masked = !maskOverride && maskRects.some(r => shape.x >= r.left - pad && shape.x <= r.right + pad && shape.y >= r.top - pad && shape.y <= r.bottom + pad);
        if (masked) { shape.scale += (0 - shape.scale) * durationToFactor(SPEED_OUT); if (shape.scale < 0.005) shape.scale = 0; continue; }

        let pi = 0;
        if (pointer && activity > 0.001) {
          const dist = Math.sqrt((shape.x - pointer.x) ** 2 + (shape.y - pointer.y) ** 2);
          pi = smoothstep(1 - dist / radius) * activity;
          if (pi > 0.05 && !shape.hovered) { shape.hovered = true; shape.maxScale = rnd(MIN_HOVER_SCALE, MAX_HOVER_SCALE); shape.angle = rnd(0, Math.PI * 2); if (shape.type === 'star') { shape.points = rndInt(4, 8); shape.innerRatio = rnd(0.15, 0.45); } }
          else if (pi <= 0.05) shape.hovered = false;
        } else shape.hovered = false;

        let wi = 0;
        for (const wave of waves) { const wr = (now - wave.startTime) / 1000 * WAVE_SPEED; const wd = Math.sqrt((shape.x - wave.x) ** 2 + (shape.y - wave.y) ** 2); const t = 1 - Math.abs(wd - wr) / WAVE_WIDTH; if (t > 0) wi = Math.max(wi, Math.sin(Math.PI * t)); }

        const target = Math.max(REST_SCALE + pi * (shape.maxScale - REST_SCALE), REST_SCALE + wi * (shape.maxScale - REST_SCALE));
        shape.scale += (target - shape.scale) * (target > shape.scale ? durationToFactor(SPEED_IN) : durationToFactor(SPEED_OUT));
        if (shape.scale < REST_SCALE * 0.15) continue;

        ctx2d.save();
        ctx2d.translate(shape.x, shape.y); ctx2d.rotate(shape.angle); ctx2d.scale(shape.scale, shape.scale);
        ctx2d.fillStyle = resolveFill(ctx2d, shape.color, shape.size) as string;
        drawShape(ctx2d, shape); ctx2d.restore();
      }
      rafId = requestAnimationFrame(tick);
    }

    function triggerWave(x?: number, y?: number) {
      waves.push({ x: x ?? W / 2, y: y ?? H / 2, startTime: performance.now() });
      maskOverride = true;
      setTimeout(() => { maskOverride = false; }, Math.sqrt(W * W + H * H) / WAVE_SPEED * 1000);
    }

    const onMove = (e: PointerEvent) => { pointer = { x: e.clientX, y: e.clientY }; activity = 1; };
    const onClick = (e: MouseEvent) => triggerWave(e.clientX, e.clientY);

    init(); rafId = requestAnimationFrame(tick);
    window.addEventListener('resize', init); window.addEventListener('pointermove', onMove); window.addEventListener('click', onClick);
    triggerWave();
    const t = setTimeout(() => setFormVisible(true), 600);
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('resize', init); window.removeEventListener('pointermove', onMove); window.removeEventListener('click', onClick); clearTimeout(t); };
  }, []);

  // ── Auth ────────────────────────────────────────────────────────────────────
  const authMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const email = String(formData.get('email') || ''), password = String(formData.get('password') || '');
      if (authMode === 'register') return register({ email, password, username: String(formData.get('username') || ''), full_name: String(formData.get('full_name') || '') });
      return login({ email, password });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['posts'] }); router.push('/'); },
    onError: (error) => setAuthError(error instanceof Error ? error.message : 'Authentication failed'),
  });

  const submitAuth = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); authMutation.mutate(new FormData(e.currentTarget)); };

  return (
    <div className="lp-root">
      {/* Canvas backdrop */}
      <canvas ref={canvasRef} className="lp-canvas" />

      {/* Grid overlay */}
      <div className="lp-grid" />

      {/* Navbar */}
      <nav className="lp-nav" data-shape-mask>
        <div className="lp-nav-logo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="6" cy="6" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="18" cy="6" r="2"/>
            <circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/>
            <circle cx="6" cy="18" r="2"/><circle cx="12" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>
          </svg>
          Verique
        </div>
        <div className="lp-nav-links">
          <span className="lp-nav-link">Manifesto</span>
          <span className="lp-nav-link">About</span>
        </div>
      </nav>

      {/* Split layout */}
      <div className="lp-split">

        {/* LEFT — auth form */}
        <div className={`lp-left ${formVisible ? 'lp-left--visible' : ''}`}>
          <div className="lp-badge">✦ Fact-Check Everything</div>
          <h1 className="lp-title">Share Truth,<br />Build Trust</h1>
          <p className="lp-sub">Verified stories, community-driven fact-checking, and AI-powered transparency.</p>

          <div className="lp-card">
            <div className="lp-tabs">
              <button type="button" onClick={() => setAuthMode('login')}    className={`lp-tab ${authMode === 'login'    ? 'lp-tab--active' : ''}`}>Login</button>
              <button type="button" onClick={() => setAuthMode('register')} className={`lp-tab ${authMode === 'register' ? 'lp-tab--active' : ''}`}>Register</button>
            </div>
            <form onSubmit={submitAuth} className="lp-form">
              {authMode === 'register' && <>
                <input className="lp-input" name="username"  placeholder="Username"  required />
                <input className="lp-input" name="full_name" placeholder="Full name" />
              </>}
              <input className="lp-input" name="email"    type="email"    placeholder="Email"    defaultValue={authMode === 'login' ? 'moderator@verique.local' : ''} key={`e-${authMode}`} required />
              <input className="lp-input" name="password" type="password" placeholder="Password" defaultValue={authMode === 'login' ? 'Moderator123!' : ''}           key={`p-${authMode}`} required />
              {authError && <div className="lp-error">{authError}</div>}
              <button className="lp-btn" disabled={authMutation.isPending}>
                {authMutation.isPending ? 'Working…' : authMode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT — 3D spinning globe */}
        <div className={`lp-right ${formVisible ? 'lp-right--visible' : ''}`}>
          <div className="lp-scene">
            <div className="lp-globe">
              {GLOBE_CARDS.map((card, i) => {
                const pos = SPHERE_POSITIONS[i];
                return (
                  <div
                    key={i}
                    className="lp-globe-card"
                    style={{ transform: `rotateY(${pos.rotY}deg) rotateX(${pos.rotX}deg) translateZ(${SPHERE_R}px)` }}
                  >
                    <div className="lgc-header">
                      <div className="lgc-avatar" style={{ background: card.color }}>{card.init}</div>
                      <div className="lgc-user">
                        <div className="lgc-name">@{card.user}</div>
                        {card.verified
                          ? <div className="lgc-badge lgc-badge--ok">✓ Verified</div>
                          : <div className="lgc-badge lgc-badge--warn">⚠ Disputed</div>
                        }
                      </div>
                    </div>
                    <p className="lgc-text">{card.text}</p>
                    <div className="lgc-footer">
                      <span>♥ {card.likes.toLocaleString()}</span>
                      <span>↗ Share</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
