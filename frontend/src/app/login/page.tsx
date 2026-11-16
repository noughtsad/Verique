'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { login, register } from '@/lib/api';
import { ME_KEY, useCurrentUser } from '@/hooks/useCurrentUser';
import { AnimatedCanvas } from '@/app/components/AnimatedCanvas';
import { Logo } from '@/app/components/Sidebar';
import './login.css';

// ─── Globe card data ──────────────────────────────────────────────────────────
const GLOBE_CARDS = [
  { user: 'alex_news', init: 'A', color: '#6366f1', text: 'Scientists confirm breakthrough in renewable energy storage.', verified: true },
  { user: 'priya_facts', init: 'P', color: '#06b6d4', text: 'New study: 3hrs sleep is enough — CLAIM DISPUTED', verified: false },
  { user: 'mark_truth', init: 'M', color: '#22c55e', text: '🌍 Climate summit agrees on net-zero by 2040 roadmap.', verified: true },
  { user: 'sara_daily', init: 'S', color: '#f97316', text: 'Breaking: Central bank raises rates by 0.5% amid inflation.', verified: true },
  { user: 'dev_post', init: 'D', color: '#a78bfa', text: 'AI models outperform doctors in early cancer detection.', verified: true },
  { user: 'leila_watch', init: 'L', color: '#ec4899', text: 'CLAIM: Moon landing footage shot in Hollywood studio.', verified: false },
  { user: 'omar_lens', init: 'O', color: '#facc15', text: 'Record turnout in municipal elections across 14 states.', verified: true },
  { user: 'nina_verify', init: 'N', color: '#34d399', text: 'New vaccine shows 94% efficacy in phase 3 trials.', verified: true },
  { user: 'kai_report', init: 'K', color: '#ef4444', text: 'Stock markets hit all-time high on strong earnings data.', verified: true },
  { user: 'jess_check', init: 'J', color: '#60a5fa', text: 'DISPUTED: Drinking lemon water daily cures diabetes.', verified: false },
  { user: 'raj_globe', init: 'R', color: '#06b6d4', text: 'Space agency announces crewed Mars mission for 2031.', verified: true },
  { user: 'bella_scan', init: 'B', color: '#22c55e', text: 'City council approves €2B public transport overhaul.', verified: true },
  { user: 'tomás_now', init: 'T', color: '#9ca3af', text: 'FACT-CHECKED ✓ Water fluoridation is safe and effective.', verified: true },
  { user: 'yuna_pulse', init: 'Y', color: '#f97316', text: 'Earthquake magnitude 6.2 strikes Pacific Rim — no tsunami.', verified: true },
  { user: 'finn_data', init: 'F', color: '#a78bfa', text: 'CLAIM: 5G towers cause health issues. Evidence: None found.', verified: false },
  { user: 'chen_live', init: 'C', color: '#ec4899', text: 'Researchers develop biodegradable plastic alternative.', verified: true },
  { user: 'amara_hq', init: 'A', color: '#6366f1', text: '78% of Gen-Z use social media as primary news source.', verified: true },
  { user: 'sol_facts', init: 'S', color: '#facc15', text: 'MISLEADING: Headline omits crucial context on tax reform.', verified: false },
  { user: 'lena_brief', init: 'L', color: '#34d399', text: 'WHO declares end of mpox global health emergency.', verified: true },
  { user: 'hugo_press', init: 'H', color: '#ef4444', text: 'CLAIM: New food additive linked to cancer. Study retracted.', verified: false },
  { user: 'mia_signal', init: 'M', color: '#60a5fa', text: 'Quantum computing startup achieves 1000-qubit milestone.', verified: true },
  { user: 'zara_now', init: 'Z', color: '#9ca3af', text: 'Parliament passes landmark digital privacy legislation.', verified: true },
  { user: 'ivan_check', init: 'I', color: '#a78bfa', text: 'DISPUTED: Historic temps "not unprecedented" — False.', verified: false },
  { user: 'ada_facts', init: 'A', color: '#22c55e', text: 'Renewable energy now supplies 42% of global electricity.', verified: true },
  { user: 'rex_pulse', init: 'R', color: '#f97316', text: 'Study links ultra-processed food to higher dementia risk.', verified: true },
  { user: 'nora_wire', init: 'N', color: '#06b6d4', text: 'CLAIM: Garlic injections cure COVID-19. No evidence found.', verified: false },
  { user: 'eli_scan', init: 'E', color: '#ec4899', text: 'New deep-sea species discovered off coast of Azores.', verified: true },
  { user: 'tao_brief', init: 'T', color: '#6366f1', text: 'Global literacy rate reaches historic high of 91%.', verified: true },
  { user: 'pia_verify', init: 'P', color: '#facc15', text: 'MISLEADING: Out-of-context clip distorts politician speech.', verified: false },
  { user: 'kas_live', init: 'K', color: '#34d399', text: 'Researchers map complete human epigenome for first time.', verified: true },
];

function getSpherePositions(n: number, R: number) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: n }, (_, i) => {
    const y = 1 - (i / (n - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = golden * i;
    // Round to 4dp — prevents SSR/client hydration mismatch from floating point string differences
    const round = (v: number) => Math.round(v * 10000) / 10000;
    return {
      rotY: round((Math.atan2(Math.cos(theta) * radius, Math.sin(theta) * radius) * 180) / Math.PI),
      rotX: round((-Math.asin(y) * 180) / Math.PI),
    };
  });
}

const SPHERE_R = 260;

/** Where to go after signing in: the page that sent the visitor here, if it's one of ours. */
function nextPath(): string {
  const next = new URLSearchParams(window.location.search).get('next');
  if (!next) return '/';
  try {
    // Resolve it the way the browser would: "/\\evil.com" and similar tricks land on another origin.
    const url = new URL(next, window.location.origin);
    return url.origin === window.location.origin ? url.pathname + url.search + url.hash : '/';
  } catch {
    return '/';
  }
}
const SPHERE_POSITIONS = getSpherePositions(GLOBE_CARDS.length, SPHERE_R);

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const blurCanvasRef = useRef<HTMLCanvasElement>(null);
  const { user } = useCurrentUser();

  // Already signed in: skip the form.
  useEffect(() => {
    if (user) router.replace(nextPath());
  }, [user, router]);

  const switchMode = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setAuthError(null);
  };

  useEffect(() => {
    const t = setTimeout(() => setFormVisible(true), 600);
    return () => clearTimeout(t);
  }, []);

  // ── Auth ────────────────────────────────────────────────────────────────────
  const authMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const email = String(formData.get('email') || ''), password = String(formData.get('password') || '');
      if (authMode === 'register') return register({ email, password, username: String(formData.get('username') || ''), full_name: String(formData.get('full_name') || '') });
      return login({ email, password });
    },
    onSuccess: (auth) => {
      // A new session must never show the previous user's cached data.
      queryClient.clear();
      queryClient.setQueryData(ME_KEY, auth.user);
      router.replace(nextPath());
    },
    onError: (error) => setAuthError(error instanceof Error ? error.message : 'Authentication failed'),
  });

  const submitAuth = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); authMutation.mutate(new FormData(e.currentTarget)); };

  return (
    <div className="lp-root">
      {/* Main canvas backdrop */}
      <AnimatedCanvas blurCanvasRef={blurCanvasRef} blurWidthRatio={0.44} className="lp-canvas" />

      {/* Blur canvas — draws a blurred copy of main canvas over the left panel */}
      <canvas ref={blurCanvasRef} className="lp-blur-canvas" />

      {/* Grid overlay */}
      <div className="lp-grid" />

      {/* Navbar */}
      <nav className="lp-nav" data-shape-mask>
        <Link href="/about" className="lp-nav-logo" aria-label="About Verique">
          <Logo withName />
        </Link>
        <div className="lp-nav-links">
          <Link href="/about" className="lp-nav-link">How it works</Link>
        </div>
      </nav>

      {/* Split layout */}
      <div className="lp-split">

        {/* LEFT — auth form */}
        <div className={`lp-left ${formVisible ? 'lp-left--visible' : ''}`}>
          <h1 className="lp-title">Check a claim<br />where you read it</h1>
          <p className="lp-sub">Post, follow and talk like on any social app. Tap Verify on a post to see what the evidence says.</p>

          <div className="lp-card">
            <div className="lp-tabs">
              <button type="button" onClick={() => switchMode('login')} className={`lp-tab ${authMode === 'login' ? 'lp-tab--active' : ''}`}>Log in</button>
              <button type="button" onClick={() => switchMode('register')} className={`lp-tab ${authMode === 'register' ? 'lp-tab--active' : ''}`}>Sign up</button>
            </div>
            <form onSubmit={submitAuth} className="lp-form">
              {authMode === 'register' && <>
                <input className="lp-input" name="username" placeholder="Username (3+ characters)" aria-label="Username" autoComplete="username" minLength={3} maxLength={50} required />
                <input className="lp-input" name="full_name" placeholder="Name (optional)" aria-label="Name" autoComplete="name" maxLength={120} />
              </>}
              <input className="lp-input" name="email" type="email" placeholder="Email" aria-label="Email" autoComplete="email" key={`e-${authMode}`} required />
              <input className="lp-input" name="password" type="password" placeholder={authMode === 'register' ? 'Password (8+ characters)' : 'Password'} aria-label="Password" autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} minLength={8} key={`p-${authMode}`} required />
              {authError && <div className="lp-error" role="alert">{authError}</div>}
              <button className="lp-btn" disabled={authMutation.isPending}>
                {authMutation.isPending ? (authMode === 'login' ? 'Logging in…' : 'Creating account…') : authMode === 'login' ? 'Log in' : 'Create account'}
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT — 3D spinning globe */}
        <div className={`lp-right ${formVisible ? 'lp-right--visible' : ''}`} aria-hidden>
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
