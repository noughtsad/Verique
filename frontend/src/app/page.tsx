'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { VerifyForm } from '@/components/verify/VerifyForm';
import { ResultsView } from '@/components/verify/ResultsView';
import { VerificationResult } from '@/lib/types';
import { Shield, Search, FileText, CheckCircle2, ArrowRight } from 'lucide-react';

export default function Home() {
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [originalText, setOriginalText] = useState<string>('');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      
      <main className="flex-1">
        {!result ? (
          <>
            {/* Hero Section */}
            <section className="relative overflow-hidden pt-20 pb-32">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-green-100 via-slate-50 to-slate-50 opacity-70" />
              
              <div className="container mx-auto px-4 relative z-10">
                <div className="max-w-4xl mx-auto text-center mb-16">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 border border-green-100 text-green-700 font-medium text-sm mb-8 animate-fade-in">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    Now powered by Llama 3.3 70B
                  </div>
                  
                  <h1 className="text-5xl md:text-7xl font-bold text-slate-900 mb-6 tracking-tight leading-tight">
                    Verify content with <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-600">
                      AI-powered precision
                    </span>
                  </h1>
                  
                  <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
                    Instantly analyze articles, posts, and documents for factual accuracy. 
                    We cross-reference claims against live web evidence to give you a transparent trust score.
                  </p>
                </div>

                {/* Main Verification Card */}
                <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 p-2 md:p-8">
                  <VerifyForm 
                    onResult={(res, text) => {
                      setResult(res);
                      setOriginalText(text);
                    }} 
                  />
                </div>
              </div>
            </section>

            {/* How it works */}
            <section className="py-24 bg-white border-t border-slate-100">
              <div className="container mx-auto px-4">
                <div className="text-center mb-16">
                  <h2 className="text-3xl font-bold text-slate-900 mb-4">How Verique Works</h2>
                  <p className="text-slate-600 max-w-2xl mx-auto">
                    Our multi-agent AI pipeline breaks down content, finds evidence, and evaluates truthfulness in seconds.
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-12 max-w-6xl mx-auto">
                  <StepCard
                    number="01"
                    icon={<FileText className="h-6 w-6 text-blue-600" />}
                    title="Claim Extraction"
                    description="We analyze your text to identify every factual claim, separating objective statements from opinions."
                  />
                  <StepCard
                    number="02"
                    icon={<Search className="h-6 w-6 text-purple-600" />}
                    title="Evidence Retrieval"
                    description="Our agents search the live web for authoritative sources that either support or contradict each claim."
                  />
                  <StepCard
                    number="03"
                    icon={<Shield className="h-6 w-6 text-green-600" />}
                    title="Verdict Generation"
                    description="You get a detailed report with confidence scores, reasoning, and direct links to sources."
                  />
                </div>
              </div>
            </section>

            {/* Features Grid */}
            <section className="py-24 bg-slate-50">
              <div className="container mx-auto px-4">
                <div className="max-w-6xl mx-auto">
                  <div className="grid md:grid-cols-2 gap-16 items-center">
                    <div>
                      <h2 className="text-3xl font-bold text-slate-900 mb-6">
                        Why professionals trust us
                      </h2>
                      <div className="space-y-6">
                        <FeatureRow 
                          title="Real-time Web Search" 
                          description="Unlike static LLMs, we access the latest information from the web."
                        />
                        <FeatureRow 
                          title="Transparent Reasoning" 
                          description="We don't just say 'true' or 'false'. We explain why, with citations."
                        />
                        <FeatureRow 
                          title="Source Reputation" 
                          description="Every source is evaluated for credibility and bias."
                        />
                        <FeatureRow 
                          title="Privacy First" 
                          description="We don't store your analyzed content longer than necessary."
                        />
                      </div>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-tr from-green-100 to-blue-50 rounded-3xl transform rotate-3"></div>
                      <div className="relative bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
                        <div className="flex items-center gap-4 mb-6 border-b border-slate-100 pb-6">
                          <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="h-6 w-6 text-green-600" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">Verification Complete</div>
                            <div className="text-sm text-slate-500">Processed in 2.4s</div>
                          </div>
                          <div className="ml-auto text-2xl font-bold text-green-600">94/100</div>
                        </div>
                        <div className="space-y-4">
                          <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                          <div className="h-4 bg-slate-100 rounded w-full"></div>
                          <div className="h-4 bg-slate-100 rounded w-5/6"></div>
                          <div className="p-4 bg-green-50 rounded-lg border border-green-100 mt-4">
                            <div className="flex gap-2 text-sm text-green-800 font-medium mb-1">
                              <Shield className="h-4 w-4" />
                              Verified Claim
                            </div>
                            <div className="text-sm text-green-700">
                              "The company was founded in 2019..."
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : (
          <div className="container mx-auto px-4 py-8">
            <ResultsView 
              result={result} 
              originalText={originalText}
              onReset={() => setResult(null)} 
            />
          </div>
        )}
      </main>
      
      <footer className="bg-white border-t border-slate-200 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-green-600" />
              <span className="font-bold text-slate-900">Verique</span>
            </div>
            <div className="text-slate-500 text-sm">
              © 2025 Verique. All rights reserved.
            </div>
            <div className="flex gap-6 text-sm font-medium text-slate-600">
              <a href="#" className="hover:text-green-600 transition-colors">Privacy</a>
              <a href="#" className="hover:text-green-600 transition-colors">Terms</a>
              <a href="#" className="hover:text-green-600 transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StepCard({ number, icon, title, description }: { number: string, icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="relative p-6 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-lg transition-shadow duration-300">
      <div className="absolute -top-4 -left-4 text-6xl font-bold text-slate-100 select-none">
        {number}
      </div>
      <div className="relative z-10">
        <div className="h-12 w-12 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center mb-4">
          {icon}
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
        <p className="text-slate-600 leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

function FeatureRow({ title, description }: { title: string, description: string }) {
  return (
    <div className="flex gap-4">
      <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-1">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
      </div>
      <div>
        <h4 className="font-bold text-slate-900 mb-1">{title}</h4>
        <p className="text-slate-600 text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
