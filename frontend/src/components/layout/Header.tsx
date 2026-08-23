'use client';

import Link from 'next/link';
import { Shield } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-[#09090b]/90 backdrop-blur-md border-b border-[#27272a] transition-colors">
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="flex items-center justify-between h-14">
          
          {/* Logo & Status Badge */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center group-hover:border-zinc-500 transition-colors">
                <Shield className="h-4 w-4 text-emerald-400" />
              </div>
              <span className="text-sm font-semibold text-zinc-100 tracking-tight group-hover:text-white transition-colors">
                Verique
              </span>
            </Link>

            <span className="h-4 w-[1px] bg-zinc-800 mx-1"></span>

            <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>Evidential Protocol v2.0</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link 
              href="/" 
              className="px-3 py-1.5 rounded-md text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-colors"
            >
              Feed
            </Link>

            <Link 
              href="/docs" 
              className="px-3 py-1.5 rounded-md text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors"
            >
              API Docs
            </Link>
            
            <Link 
              href="/about" 
              className="px-3 py-1.5 rounded-md text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors"
            >
              About
            </Link>

            <a
              href="https://github.com/Pulkit7070/Verique-Mumbai"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 px-3 py-1.5 rounded-md bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/60 text-xs font-medium text-zinc-200 transition-colors"
            >
              GitHub
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}
