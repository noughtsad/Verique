'use client';

import { Header } from '@/components/layout/Header';
import { Terminal, Code, Zap, Copy, Check } from 'lucide-react';
import { useState } from 'react';

export default function DocsPage() {
  const [copied, setCopied] = useState(false);

  const copyCurl = () => {
    navigator.clipboard.writeText(`curl -X POST http://127.0.0.1:8000/api/v1/verify \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "Our product increases productivity by 300%.",
    "vertical": "saas"
  }'`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans selection:bg-zinc-700 selection:text-white">
      <Header />
      
      <main className="container mx-auto px-6 py-12 max-w-4xl">
        <div className="mb-10 space-y-2">
          <div className="flex items-center gap-2 font-mono text-xs text-zinc-400">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" /> Developer Platform
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            REST API Documentation
          </h1>
          <p className="text-zinc-400 text-sm max-w-xl leading-relaxed">
            Integrate Verique claim verification directly into your applications and services.
          </p>
        </div>

        {/* Quick Start */}
        <section className="mb-10">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <Code className="w-4 h-4 text-emerald-400" /> Quick Start
            </h2>
            <button 
              onClick={copyCurl} 
              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-mono text-zinc-300 flex items-center gap-1.5 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy cURL'}
            </button>
          </div>
          <div className="card-sleek rounded-xl p-5 overflow-x-auto bg-[#0c0c0e]">
            <pre className="text-emerald-400 text-xs font-mono leading-relaxed">
{`curl -X POST http://127.0.0.1:8000/api/v1/verify \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "Our product increases productivity by 300%.",
    "vertical": "saas"
  }'`}
            </pre>
          </div>
        </section>

        {/* Endpoints */}
        <section className="mb-10 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" /> API Endpoints
          </h2>
          
          <EndpointCard
            method="POST"
            path="/api/v1/verify"
            description="Verify text content & receive claim-level evidential breakdown"
          />
          
          <EndpointCard
            method="POST"
            path="/api/v1/verify/url"
            description="Extract web content from a URL & run verification"
          />
          
          <EndpointCard
            method="GET"
            path="/api/v1/verify/:id"
            description="Retrieve existing verification analysis by ID"
          />
        </section>

        {/* Request Schema */}
        <section className="mb-10 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-200">Request Parameters</h2>
          <div className="card-sleek rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 font-mono">
                <tr>
                  <th className="px-5 py-3 font-medium">Field</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 text-zinc-300">
                <tr>
                  <td className="px-5 py-3 font-mono font-semibold text-emerald-400">text</td>
                  <td className="px-5 py-3 text-zinc-400 font-mono">string (required)</td>
                  <td className="px-5 py-3">Text content to extract claims from (max 50KB)</td>
                </tr>
                <tr>
                  <td className="px-5 py-3 font-mono font-semibold text-emerald-400">url</td>
                  <td className="px-5 py-3 text-zinc-400 font-mono">string (optional)</td>
                  <td className="px-5 py-3">Source URL context for fact-checking</td>
                </tr>
                <tr>
                  <td className="px-5 py-3 font-mono font-semibold text-emerald-400">vertical</td>
                  <td className="px-5 py-3 text-zinc-400 font-mono">string (optional)</td>
                  <td className="px-5 py-3">ecommerce, saas, tech, finance, health, general</td>
                </tr>
                <tr>
                  <td className="px-5 py-3 font-mono font-semibold text-emerald-400">language</td>
                  <td className="px-5 py-3 text-zinc-400 font-mono">string (optional)</td>
                  <td className="px-5 py-3">ISO 639-1 language code (default: auto-detect)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Verdicts */}
        <section className="mb-10 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-200">Verdict Classifications</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <VerdictCard verdict="strongly_supported" description="Multiple high-reputation sources confirm claim" color="bg-emerald-400" />
            <VerdictCard verdict="supported" description="Solid evidential support found" color="bg-green-500" />
            <VerdictCard verdict="mixed" description="Contradictory or partial evidence surfaced" color="bg-amber-400" />
            <VerdictCard verdict="weak" description="Limited or low-credibility sources" color="bg-orange-400" />
            <VerdictCard verdict="contradicted" description="Directly contradicted by reputable data" color="bg-rose-500" />
            <VerdictCard verdict="not_verifiable" description="Subjective opinion or unverifiable claim" color="bg-purple-400" />
          </div>
        </section>

        {/* Rate Limits */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-200">Rate Limits</h2>
          <div className="card-sleek rounded-xl p-5">
            <div className="grid md:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold font-mono text-white">100</div>
                <div className="text-xs text-zinc-400 font-mono">req/hr (free tier)</div>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-white">10,000</div>
                <div className="text-xs text-zinc-400 font-mono">req/hr (pro tier)</div>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-white">Custom</div>
                <div className="text-xs text-zinc-400 font-mono">enterprise</div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function EndpointCard({ method, path, description }: { method: string; path: string; description: string }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3.5 card-sleek rounded-xl text-xs">
      <div className="flex items-center gap-3">
        <span className={`px-2 py-0.5 rounded font-mono font-semibold text-[10px] ${
          method === 'GET' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
        }`}>
          {method}
        </span>
        <code className="text-white font-mono font-semibold">{path}</code>
      </div>
      <span className="text-zinc-400">{description}</span>
    </div>
  );
}

function VerdictCard({ verdict, description, color }: { verdict: string; description: string; color: string }) {
  return (
    <div className="flex items-center gap-3 p-3.5 card-sleek rounded-xl">
      <div className={`w-2.5 h-2.5 rounded-full ${color} flex-shrink-0`} />
      <div>
        <div className="font-mono font-semibold text-xs text-white uppercase">{verdict}</div>
        <div className="text-xs text-zinc-400">{description}</div>
      </div>
    </div>
  );
}
