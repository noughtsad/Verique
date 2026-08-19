'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import gsap from 'gsap';

import { login, register } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { Users, Heart, MessageCircle, CheckCircle } from 'lucide-react';
import './login.css';

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      // Configuration based on the original GSAP script
      const itemTargets = [
        { x: "-20vw", y: "-30vh", rotation: -20 },
        { x: "25vw", y: "-20vh", rotation: 15 },
        { x: "-32vw", y: "30vh", rotation: 12 },
        { x: "15vw", y: "25vh", rotation: -15 },
      ];

      const EXIT_DISTANCE = 3.5;
      const itemExits = itemTargets.map((target) => ({
        x: parseFloat(target.x) * EXIT_DISTANCE + "vw",
        y: parseFloat(target.y) * EXIT_DISTANCE + "vh",
        rotation: target.rotation * 2.5,
      }));

      const items = gsap.utils.toArray(".item");
      const floatingTweens: gsap.core.Tween[] = [];

      const tl = gsap.timeline({ delay: 0.5 });

      tl.to(".preloader-revealer", {
        clipPath: "circle(100% at 50% 50%)",
        duration: 1,
        stagger: 0.25,
        ease: "power2.inOut",
      });

      tl.set(".preloader-revealer", { display: "none" });

      items.forEach((item, i) => {
        const target = itemTargets[i];
        const icon = (item as HTMLElement).querySelector("svg");

        tl.to(
          item as HTMLElement,
          {
            x: target.x,
            y: target.y,
            scale: 1,
            rotation: target.rotation,
            duration: 1,
            ease: "power3.out",
            onStart: () => {
              if (icon) {
                floatingTweens[i] = gsap.to(icon, {
                  y: gsap.utils.random(-15, -25),
                  duration: gsap.utils.random(1.5, 2.5),
                  ease: "sine.inOut",
                  yoyo: true,
                  repeat: -1,
                  delay: gsap.utils.random(0, 0.5),
                });
              }
            },
          },
          i === 0 ? "-=0.55" : "<0.075",
        );
      });

      tl.to(
        ".preloader-logo",
        { scale: 1, opacity: 1, duration: 1, ease: "power3.out" },
        "<",
      );

      tl.set(".preloader-bg", { display: "none" });

      tl.to({}, { duration: 1 });

      tl.add(() => floatingTweens.forEach((tween) => tween.kill()));

      items.forEach((item, i) => {
        const exit = itemExits[i];
        tl.to(
          item as HTMLElement,
          {
            x: exit.x,
            y: exit.y,
            scale: 2.5,
            rotation: exit.rotation,
            duration: 0.75,
            ease: "power2.in",
          },
          i === 0 ? ">" : "<0.075",
        );
      });

      tl.to(
        ".preloader-logo",
        { y: "-120vh", scale: 2.5, duration: 0.75, ease: "power2.in" },
        "<",
      );

      // Reveal the login form instead of the hero/nav
      tl.to(
        ".auth-content",
        { opacity: 1, duration: 1, ease: "power3.out" },
        "-=0.2"
      );

      tl.set(".preloader", { display: "none" });
      
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const authMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const email = String(formData.get('email') || '');
      const password = String(formData.get('password') || '');
      if (authMode === 'register') {
        return register({
          email,
          password,
          username: String(formData.get('username') || ''),
          full_name: String(formData.get('full_name') || ''),
        });
      }
      return login({ email, password });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      router.push('/');
    },
    onError: (error) => setAuthError(error instanceof Error ? error.message : 'Authentication failed'),
  });

  const submitAuth = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    authMutation.mutate(new FormData(event.currentTarget));
  };

  return (
    <div className="login-container" ref={containerRef}>
      <div className="preloader">
        <div className="preloader-bg"></div>
        <div className="preloader-revealer preloader-revealer-1"></div>
        <div className="preloader-revealer preloader-revealer-2"></div>
        <div className="preloader-revealer preloader-revealer-3"></div>
        <div className="preloader-revealer preloader-revealer-4"></div>

        <div className="items pointer-events-none">
          <div className="item item-1 flex items-center justify-center text-[#f5e1bf]/80"><Users className="w-full h-full" strokeWidth={1.5} /></div>
          <div className="item item-2 flex items-center justify-center text-[#f5e1bf]/80"><MessageCircle className="w-full h-full" strokeWidth={1.5} /></div>
          <div className="item item-3 flex items-center justify-center text-[#f5e1bf]/80"><CheckCircle className="w-full h-full" strokeWidth={1.5} /></div>
          <div className="item item-4 flex items-center justify-center text-[#f5e1bf]/80"><Heart className="w-full h-full" strokeWidth={1.5} /></div>
        </div>

        <div className="preloader-logo flex flex-col items-center justify-center">
          <div className="w-24 h-24 bg-white text-[#17100a] rounded-2xl flex items-center justify-center shadow-lg mb-4">
            <span className="font-bold text-5xl tracking-tight">V</span>
          </div>
          <span className="font-semibold text-[#f5e1bf] text-3xl tracking-wide">Verique</span>
        </div>
      </div>

      <div className="auth-content">
        <div className="auth-form-card">
          <h2>Verique</h2>
          <p>Sign in to fact-check, share, and connect.</p>
          
          <form onSubmit={submitAuth}>
            <div className="auth-tabs">
              <button 
                type="button" 
                onClick={() => setAuthMode('login')} 
                className={`auth-tab-btn ${authMode === 'login' ? 'active' : ''}`}
              >
                Login
              </button>
              <button 
                type="button" 
                onClick={() => setAuthMode('register')} 
                className={`auth-tab-btn ${authMode === 'register' ? 'active' : ''}`}
              >
                Register
              </button>
            </div>
            
            {authMode === 'register' && (
              <>
                <input className="auth-input" name="username" placeholder="Username" required />
                <input className="auth-input" name="full_name" placeholder="Full name" />
              </>
            )}
            
            <input 
              className="auth-input" 
              name="email" 
              type="email" 
              placeholder="Email" 
              defaultValue={authMode === 'login' ? 'moderator@verique.local' : ''} 
              key={`email-${authMode}`} 
              required 
            />
            <input 
              className="auth-input" 
              name="password" 
              type="password" 
              placeholder="Password" 
              defaultValue={authMode === 'login' ? 'Moderator123!' : ''} 
              key={`pwd-${authMode}`} 
              required 
            />
            
            {authError && <div className="error-banner">{authError}</div>}
            
            <button className="auth-btn" disabled={authMutation.isPending}>
              {authMutation.isPending ? 'Working...' : authMode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
