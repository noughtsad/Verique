'use client';

import { Header } from '@/components/layout/Header';
import { Shield, Target, Users, Eye, AlertTriangle } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Header />
      
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-green-100 mb-6">
            <Shield className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            About Verique
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            We believe trust should be transparent, not opaque. Verique helps 
            you understand the factual basis of any content — without telling you 
            what to think.
          </p>
        </div>

        {/* Mission */}
        <section className="mb-16">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-8 border border-green-100">
            <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
              <Target className="w-6 h-6 text-green-600" />
              Our Mission
            </h2>
            <p className="text-slate-700 text-lg leading-relaxed">
              In a world flooded with content, separating fact from fiction shouldn&apos;t 
              require hours of research. Verique uses AI to do the heavy lifting — 
              extracting claims, finding evidence, and presenting it transparently so 
              <strong> you</strong> can make informed decisions.
            </p>
          </div>
        </section>

        {/* What We Are NOT */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            What We&apos;re NOT
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-red-50 rounded-xl p-6 border border-red-100">
              <h3 className="font-semibold text-red-900 mb-2">❌ Not a Truth Arbiter</h3>
              <p className="text-red-800 text-sm">
                We don&apos;t tell you what&apos;s &quot;true&quot; or &quot;false.&quot; We show you evidence 
                and let you decide.
              </p>
            </div>
            <div className="bg-red-50 rounded-xl p-6 border border-red-100">
              <h3 className="font-semibold text-red-900 mb-2">❌ Not Political</h3>
              <p className="text-red-800 text-sm">
                We deliberately avoid political content. Our focus is on 
                practical, everyday claims.
              </p>
            </div>
            <div className="bg-red-50 rounded-xl p-6 border border-red-100">
              <h3 className="font-semibold text-red-900 mb-2">❌ Not a Censor</h3>
              <p className="text-red-800 text-sm">
                We never hide, block, or modify content. We add context, 
                that&apos;s all.
              </p>
            </div>
            <div className="bg-red-50 rounded-xl p-6 border border-red-100">
              <h3 className="font-semibold text-red-900 mb-2">❌ Not Perfect</h3>
              <p className="text-red-800 text-sm">
                AI can make mistakes. We show our confidence level and sources 
                so you can verify yourself.
              </p>
            </div>
          </div>
        </section>

        {/* What We ARE */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
            <Eye className="w-6 h-6 text-green-600" />
            What We ARE
          </h2>
          <div className="space-y-4">
            <FeatureRow 
              title="Evidence Surface" 
              description="We find and present supporting and contradicting evidence from the web"
            />
            <FeatureRow 
              title="Confidence Scores" 
              description="Every verdict comes with a confidence level — no false certainty"
            />
            <FeatureRow 
              title="Source Links" 
              description="Click through to original sources and verify for yourself"
            />
            <FeatureRow 
              title="Transparent Reasoning" 
              description="We explain why each claim is rated the way it is"
            />
            <FeatureRow 
              title="Privacy-First" 
              description="We don't store your content or build profiles on users"
            />
          </div>
        </section>

        {/* Use Cases */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
            <Users className="w-6 h-6 text-blue-600" />
            Built For
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <UseCaseCard
              emoji="🛒"
              title="Shoppers"
              description="Verify product claims before you buy"
            />
            <UseCaseCard
              emoji="📚"
              title="Learners"
              description="Check if that tutorial is actually accurate"
            />
            <UseCaseCard
              emoji="💼"
              title="Professionals"
              description="Validate competitor claims and market data"
            />
            <UseCaseCard
              emoji="✍️"
              title="Content Creators"
              description="Fact-check your own work before publishing"
            />
            <UseCaseCard
              emoji="🏢"
              title="Enterprises"
              description="Integrate verification into your workflows"
            />
            <UseCaseCard
              emoji="🔧"
              title="Developers"
              description="Build trust layers into your applications"
            />
          </div>
        </section>

        {/* CTA */}
        <section className="text-center bg-slate-900 rounded-2xl p-12">
          <h2 className="text-2xl font-bold text-white mb-4">
            Ready to verify smarter?
          </h2>
          <p className="text-slate-300 mb-8">
            Start verifying content for free. No signup required.
          </p>
          <a 
            href="/"
            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-xl font-semibold transition-colors"
          >
            Try Verique Now →
          </a>
        </section>
      </main>
    </div>
  );
}

function FeatureRow({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200">
      <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
      <div>
        <span className="font-semibold text-slate-900">{title}:</span>{' '}
        <span className="text-slate-600">{description}</span>
      </div>
    </div>
  );
}

function UseCaseCard({ emoji, title, description }: { emoji: string; title: string; description: string }) {
  return (
    <div className="bg-white rounded-xl p-6 border border-slate-200 text-center">
      <div className="text-4xl mb-3">{emoji}</div>
      <h3 className="font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-600">{description}</p>
    </div>
  );
}
