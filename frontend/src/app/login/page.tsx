'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { login, register } from '@/lib/api';
import { Heart, MessageCircle, UserPlus, Repeat2, ShieldCheck, Flame, TrendingUp, CheckCircle2, Bookmark, Share2, Eye } from 'lucide-react';

const API_URL = 'http://localhost:8000';
import { useQueryClient } from '@tanstack/react-query';
import './login.css';

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
function rndInt(a: number, b: number) { return Math.floor(rnd(a, b + 1)); }
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

// ─── Globe card data ──────────────────────────────────────────────────────────
const GLOBE_CARDS = [
  { user: 'alex_news',   init: 'A', color: '#6366f1', text: 'Scientists confirm breakthrough in renewable energy storage.', likes: 1240, verified: true },
  { user: 'priya_facts', init: 'P', color: '#06b6d4', text: 'New study: 3hrs sleep is enough — CLAIM DISPUTED', likes: 892, verified: false },
  { user: 'mark_truth',  init: 'M', color: '#22c55e', text: '🌍 Climate summit agrees on net-zero by 2040 roadmap.', likes: 3421, verified: true },
  { user: 'sara_daily',  init: 'S', color: '#f97316', text: 'Breaking: Central bank raises rates by 0.5% amid inflation.', likes: 567, verified: true },
  { user: 'dev_post',    init: 'D', color: '#a78bfa', text: 'AI models outperform doctors in early cancer detection.', likes: 2100, verified: true },
  { user: 'leila_watch', init: 'L', color: '#ec4899', text: 'CLAIM: Moon landing footage shot in Hollywood studio.', likes: 312, verified: false },
  { user: 'omar_lens',   init: 'O', color: '#facc15', text: 'Record turnout in municipal elections across 14 states.', likes: 789, verified: true },
  { user: 'nina_verify', init: 'N', color: '#34d399', text: 'New vaccine shows 94% efficacy in phase 3 trials.', likes: 4502, verified: true },
  { user: 'kai_report',  init: 'K', color: '#ef4444', text: 'Stock markets hit all-time high on strong earnings data.', likes: 1023, verified: true },
  { user: 'jess_check',  init: 'J', color: '#60a5fa', text: 'DISPUTED: Drinking lemon water daily cures diabetes.', likes: 201, verified: false },
  { user: 'raj_globe',   init: 'R', color: '#06b6d4', text: 'Space agency announces crewed Mars mission for 2031.', likes: 5890, verified: true },
  { user: 'bella_scan',  init: 'B', color: '#22c55e', text: 'City council approves €2B public transport overhaul.', likes: 1345, verified: true },
  { user: 'tomás_now',   init: 'T', color: '#9ca3af', text: 'FACT-CHECKED ✓ Water fluoridation is safe and effective.', likes: 678, verified: true },
  { user: 'yuna_pulse',  init: 'Y', color: '#f97316', text: 'Earthquake magnitude 6.2 strikes Pacific Rim — no tsunami.', likes: 2231, verified: true },
  { user: 'finn_data',   init: 'F', color: '#a78bfa', text: 'CLAIM: 5G towers cause health issues. Evidence: None found.', likes: 445, verified: false },
  { user: 'chen_live',   init: 'C', color: '#ec4899', text: 'Researchers develop biodegradable plastic alternative.', likes: 3102, verified: true },
  { user: 'amara_hq',   init: 'A', color: '#6366f1', text: '78% of Gen-Z use social media as primary news source.', likes: 1567, verified: true },
  { user: 'sol_facts',   init: 'S', color: '#facc15', text: 'MISLEADING: Headline omits crucial context on tax reform.', likes: 934, verified: false },
  { user: 'lena_brief',  init: 'L', color: '#34d399', text: 'WHO declares end of mpox global health emergency.', likes: 2780, verified: true },
  { user: 'hugo_press',  init: 'H', color: '#ef4444', text: 'CLAIM: New food additive linked to cancer. Study retracted.', likes: 388, verified: false },
  { user: 'mia_signal',  init: 'M', color: '#60a5fa', text: 'Quantum computing startup achieves 1000-qubit milestone.', likes: 4100, verified: true },
  { user: 'zara_now',    init: 'Z', color: '#9ca3af', text: 'Parliament passes landmark digital privacy legislation.', likes: 1890, verified: true },
  { user: 'ivan_check',  init: 'I', color: '#a78bfa', text: 'DISPUTED: Historic temps "not unprecedented" — False.', likes: 512, verified: false },
  { user: 'ada_facts',   init: 'A', color: '#22c55e', text: 'Renewable energy now supplies 42% of global electricity.', likes: 6230, verified: true },
  { user: 'rex_pulse',   init: 'R', color: '#f97316', text: 'Study links ultra-processed food to higher dementia risk.', likes: 3401, verified: true },
  { user: 'nora_wire',   init: 'N', color: '#06b6d4', text: 'CLAIM: Garlic injections cure COVID-19. No evidence found.', likes: 145, verified: false },
  { user: 'eli_scan',    init: 'E', color: '#ec4899', text: 'New deep-sea species discovered off coast of Azores.', likes: 2910, verified: true },
  { user: 'tao_brief',   init: 'T', color: '#6366f1', text: 'Global literacy rate reaches historic high of 91%.', likes: 1750, verified: true },
  { user: 'pia_verify',  init: 'P', color: '#facc15', text: 'MISLEADING: Out-of-context clip distorts politician speech.', likes: 670, verified: false },
  { user: 'kas_live',    init: 'K', color: '#34d399', text: 'Researchers map complete human epigenome for first time.', likes: 3850, verified: true },
];

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

const SPHERE_R = 260;
const SPHERE_POSITIONS = getSpherePositions(GLOBE_CARDS.length, SPHERE_R);

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
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
            <circle cx="6" cy="6" r="2" /><circle cx="12" cy="6" r="2" /><circle cx="18" cy="6" r="2" />
            <circle cx="6" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="18" cy="12" r="2" />
            <circle cx="6" cy="18" r="2" /><circle cx="12" cy="18" r="2" /><circle cx="18" cy="18" r="2" />
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
              <button type="button" onClick={() => setAuthMode('login')} className={`lp-tab ${authMode === 'login' ? 'lp-tab--active' : ''}`}>Login</button>
              <button type="button" onClick={() => setAuthMode('register')} className={`lp-tab ${authMode === 'register' ? 'lp-tab--active' : ''}`}>Register</button>
            </div>
            <form onSubmit={submitAuth} className="lp-form">
              {authMode === 'register' && <>
                <input className="lp-input" name="username" placeholder="Username" required />
                <input className="lp-input" name="full_name" placeholder="Full name" />
              </>}
              <input className="lp-input" name="email" type="email" placeholder="Email" defaultValue={authMode === 'login' ? 'moderator@verique.local' : ''} key={`e-${authMode}`} required />
              <input className="lp-input" name="password" type="password" placeholder="Password" defaultValue={authMode === 'login' ? 'Moderator123!' : ''} key={`p-${authMode}`} required />
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
            <div className="lp-globe-wrapper">
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
    </div>
  );
}
