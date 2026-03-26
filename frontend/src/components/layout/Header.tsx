'use client';

import Link from 'next/link';
import { Shield } from 'lucide-react';

export function Header() {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-green-600" />
            <span className="text-xl font-bold text-slate-900">Verique</span>
          </Link>
          
          <nav className="flex items-center gap-6">
            <Link 
              href="/docs" 
              className="text-slate-600 hover:text-slate-900 transition-colors"
            >
              API Docs
            </Link>
            <Link 
              href="/about" 
              className="text-slate-600 hover:text-slate-900 transition-colors"
            >
              About
            </Link>
            <a
              href="https://github.com/Pulkit7070/Verique-Mumbai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-600 hover:text-slate-900 transition-colors"
            >
              GitHub
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}
