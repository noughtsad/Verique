'use client';

import { Header } from '@/components/layout/Header';
import { Shield, Target, Users, Eye, AlertTriangle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans selection:bg-zinc-700 selection:text-white">
      <Header />
      
      <main className="container mx-auto px-6 py-12 max-w-4xl">
        {/* Hero */}
        <div className="text-center mb-14 space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 mb-2">
            <Shield className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            About Verique
          </h1>
          <p className="text-base text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            We believe trust should be transparent, not opaque. Verique helps 
            you understand the factual basis of any content without dictating what to think.
          </p>
        </div>

        {/* Mission */}
        <section className="mb-12">
          <div className="card-sleek rounded-2xl p-6 sm:p-8 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-semibold uppercase tracking-wider">
              <Target className="w-4 h-4 text-emerald-400" /> Mission Statement
            </div>
            <h2 className="text-xl font-bold text-white">Transparent Evidential Fact-Checking</h2>
            <p className="text-zinc-300 text-sm leading-relaxed font-normal">
              In a world flooded with content, separating fact from fiction shouldn&apos;t 
              require hours of manual research. Verique uses AI to extract claims, surface supporting and contradicting web evidence, and present it clearly so <strong className="text-white">you</strong> can make informed decisions.
            </p>
          </div>
        </section>

        {/* What We Are NOT */}
        <section className="mb-12 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold text-white">What We&apos;re NOT</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="card-sleek rounded-xl p-5 border-rose-500/20 bg-rose-500/5">
              <h3 className="font-semibold text-rose-300 text-sm mb-1.5">❌ Not a Truth Arbiter</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                We don&apos;t declare absolute truth or falsehood. We present gathered evidence transparently.
              </p>
            </div>
            <div className="card-sleek rounded-xl p-5 border-rose-500/20 bg-rose-500/5">
              <h3 className="font-semibold text-rose-300 text-sm mb-1.5">❌ Not Political</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                We avoid partisan editorial bias, focusing strictly on factual claim verification.
              </p>
            </div>
            <div className="card-sleek rounded-xl p-5 border-rose-500/20 bg-rose-500/5">
              <h3 className="font-semibold text-rose-300 text-sm mb-1.5">❌ Not a Censor</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                We never remove, block, or suppress content. We provide context and evidence.
              </p>
            </div>
            <div className="card-sleek rounded-xl p-5 border-rose-500/20 bg-rose-500/5">
              <h3 className="font-semibold text-rose-300 text-sm mb-1.5">❌ Not Infallible</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Automated models can miss context. We disclose confidence levels and source citations.
              </p>
            </div>
          </div>
        </section>

        {/* What We ARE */}
        <section className="mb-12 space-y-4">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">What We ARE</h2>
          </div>
          <div className="space-y-2.5">
            <FeatureRow title="Evidence Surface" description="Finds supporting and contradicting evidence from the web" />
            <FeatureRow title="Confidence Scores" description="Every verdict comes with an explicit confidence level" />
            <FeatureRow title="Source Links" description="Direct access to original cited sources for independent verification" />
            <FeatureRow title="Transparent Reasoning" description="Clear breakdown of how each verdict decision was calculated" />
            <FeatureRow title="Privacy-First" description="No tracking profiles or content selling" />
          </div>
        </section>

        {/* Use Cases */}
        <section className="mb-12 space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-bold text-white">Built For</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <UseCaseCard emoji="🛒" title="Shoppers" description="Verify marketing and product claim data before buying" />
            <UseCaseCard emoji="📚" title="Learners" description="Cross-check technical tutorials and educational claims" />
            <UseCaseCard emoji="💼" title="Professionals" description="Validate competitor marketing and business metrics" />
            <UseCaseCard emoji="✍️" title="Content Creators" description="Fact-check statements before publishing content" />
            <UseCaseCard emoji="🏢" title="Enterprises" description="Integrate evidential verification into automated pipelines" />
            <UseCaseCard emoji="🔧" title="Developers" description="Build trust layers using our REST API" />
          </div>
        </section>

        {/* CTA */}
        <section className="text-center card-sleek rounded-2xl p-8 sm:p-10 space-y-3">
          <h2 className="text-2xl font-bold text-white">
            Ready to verify content?
          </h2>
          <p className="text-zinc-400 text-xs max-w-sm mx-auto">
            Start verifying claims using our evidential verification engine.
          </p>
          <div className="pt-2">
            <Link 
              href="/"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5 py-2.5 rounded-xl text-xs transition"
            >
              Go to Feed <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function FeatureRow({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-center gap-3 p-3.5 card-sleek rounded-xl text-xs">
      <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
      <div>
        <span className="font-semibold text-white">{title}:</span>{' '}
        <span className="text-zinc-400">{description}</span>
      </div>
    </div>
  );
}

function UseCaseCard({ emoji, title, description }: { emoji: string; title: string; description: string }) {
  return (
    <div className="card-sleek rounded-xl p-5 text-center">
      <div className="text-2xl mb-2">{emoji}</div>
      <h3 className="font-semibold text-white mb-1 text-xs">{title}</h3>
      <p className="text-xs text-zinc-400 leading-relaxed">{description}</p>
    </div>
  );
}
