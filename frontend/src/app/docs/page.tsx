'use client';

import { Header } from '@/components/layout/Header';
import { Shield, Code, Zap, Lock, ExternalLink } from 'lucide-react';

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Header />
      
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">
          API Documentation
        </h1>
        <p className="text-xl text-slate-600 mb-12">
          Integrate Verique verification into your applications with our REST API.
        </p>

        {/* Quick Start */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Quick Start</h2>
          <div className="bg-slate-900 rounded-xl p-6 overflow-x-auto">
            <pre className="text-green-400 text-sm">
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
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Endpoints</h2>
          
          <EndpointCard
            method="POST"
            path="/api/v1/verify"
            description="Verify text content and get claim-level verdicts"
          />
          
          <EndpointCard
            method="POST"
            path="/api/v1/verify/url"
            description="Fetch and verify content from a URL"
          />
          
          <EndpointCard
            method="GET"
            path="/api/v1/verify/:id"
            description="Get verification results by ID"
          />
        </section>

        {/* Request Schema */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Request Schema</h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Field</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Type</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="px-6 py-4 text-sm font-mono text-slate-900">text</td>
                  <td className="px-6 py-4 text-sm text-slate-600">string (required)</td>
                  <td className="px-6 py-4 text-sm text-slate-600">Content to verify (max 50KB)</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm font-mono text-slate-900">url</td>
                  <td className="px-6 py-4 text-sm text-slate-600">string (optional)</td>
                  <td className="px-6 py-4 text-sm text-slate-600">Source URL for context</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm font-mono text-slate-900">vertical</td>
                  <td className="px-6 py-4 text-sm text-slate-600">string (optional)</td>
                  <td className="px-6 py-4 text-sm text-slate-600">ecommerce, saas, tech, finance, health, education, professional, general</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm font-mono text-slate-900">language</td>
                  <td className="px-6 py-4 text-sm text-slate-600">string (optional)</td>
                  <td className="px-6 py-4 text-sm text-slate-600">ISO 639-1 language code (default: auto-detect)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Verdicts */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Verdict Types</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <VerdictCard verdict="strongly_supported" description="Multiple high-quality sources confirm the claim" color="bg-green-700" />
            <VerdictCard verdict="supported" description="Evidence supports the claim" color="bg-green-500" />
            <VerdictCard verdict="mixed" description="Some sources support, some contradict" color="bg-yellow-500" />
            <VerdictCard verdict="weak" description="Limited or low-quality evidence" color="bg-orange-500" />
            <VerdictCard verdict="contradicted" description="Evidence contradicts the claim" color="bg-red-500" />
            <VerdictCard verdict="not_verifiable" description="Opinion, prediction, or unverifiable" color="bg-gray-500" />
          </div>
        </section>

        {/* Rate Limits */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Rate Limits</h2>
          <div className="bg-slate-100 rounded-xl p-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <div className="text-3xl font-bold text-slate-900">100</div>
                <div className="text-slate-600">requests/hour (free tier)</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-900">10,000</div>
                <div className="text-slate-600">requests/hour (pro)</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-900">Unlimited</div>
                <div className="text-slate-600">enterprise</div>
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
    <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 mb-4">
      <span className={`px-3 py-1 rounded-lg text-sm font-mono font-semibold ${
        method === 'GET' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
      }`}>
        {method}
      </span>
      <code className="text-slate-900 font-mono">{path}</code>
      <span className="text-slate-500 ml-auto">{description}</span>
    </div>
  );
}

function VerdictCard({ verdict, description, color }: { verdict: string; description: string; color: string }) {
  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200">
      <div className={`w-4 h-4 rounded-full ${color}`} />
      <div>
        <div className="font-mono text-sm text-slate-900">{verdict}</div>
        <div className="text-sm text-slate-600">{description}</div>
      </div>
    </div>
  );
}
