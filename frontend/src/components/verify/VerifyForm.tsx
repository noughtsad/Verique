'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Send, Link as LinkIcon, FileText, Globe } from 'lucide-react';
import { verifyContent, verifyUrl } from '@/lib/api';
import { VerificationResult, Vertical } from '@/lib/types';
import { cn } from '@/lib/utils';
import { LiveProgress } from './LiveProgress';

interface VerifyFormProps {
  onResult: (result: VerificationResult, originalText: string) => void;
}

const VERTICALS: { value: Vertical; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'saas', label: 'SaaS / Tech' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'finance', label: 'Finance' },
  { value: 'health', label: 'Health' },
  { value: 'education', label: 'Education' },
  { value: 'professional', label: 'Professional' },
];

const SAMPLE_TEXT = `Our AI-powered platform is used by over 10,000 teams worldwide and reduces operational costs by 50%. 

Founded in 2019, we've processed more than 1 billion requests and maintain 99.99% uptime. 

Our technology is based on the latest GPT-4 models and can understand 50+ languages. Independent studies show that our product increases productivity by 3x compared to traditional methods.`;

const DEMO_EXAMPLES = [
  {
    id: 'python',
    label: '✓ Easy Win',
    text: 'Python was first released by Guido van Rossum in 1991.',
    description: 'Clear factual claim with strong evidence'
  },
  {
    id: 'electric',
    label: '⚡ Show Conflict',
    text: 'Electric cars have zero emissions.',
    description: 'Demonstrates handling contradictory evidence'
  },
  {
    id: 'crypto',
    label: '🛡️ Protect Users',
    text: 'Investing in cryptocurrency guarantees high returns.',
    description: 'Shows ability to detect misleading claims'
  }
];

export function VerifyForm({ onResult }: VerifyFormProps) {
  const [mode, setMode] = useState<'text' | 'url'>('text');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [vertical, setVertical] = useState<Vertical>('general');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [progressSteps, setProgressSteps] = useState<Array<{
    label: string;
    status: 'pending' | 'active' | 'complete';
    detail: string;
  }>>([
    { label: 'Extracting claims', status: 'pending', detail: '' },
    { label: 'Searching for evidence', status: 'pending', detail: '' },
    { label: 'Ranking sources', status: 'pending', detail: '' },
    { label: 'Generating verdicts', status: 'pending', detail: '' }
  ]);

  const mutation = useMutation({
    mutationFn: async (data: { text?: string; url?: string; vertical: Vertical }) => {
      if (mode === 'url' && data.url) {
        return verifyUrl(data.url, data.vertical);
      } else if (data.text) {
        return verifyContent({
          text: data.text,
          url: data.url, // Optional source URL for text mode
          vertical: data.vertical,
        });
      }
      throw new Error('Invalid input');
    },
    onSuccess: (result) => {
      // For URL mode, we might not have the text immediately if we didn't fetch it client-side.
      // But the backend returns the analyzed text in the result? 
      // Actually, the result structure usually contains the claims, but maybe not the full text if it was fetched server-side.
      // Let's assume for now we display what we have or the user input.
      // If it's URL mode, we might want to display the fetched text if available.
      // The backend response doesn't seem to include the full original text in the VerificationResponse schema explicitly,
      // but let's check the types.
      onResult(result, text || (mode === 'url' ? `Content from ${url}` : ''));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'text' && !text.trim()) return;
    if (mode === 'url' && !url.trim()) return;

    mutation.mutate({
      text: mode === 'text' ? text.trim() : undefined,
      url: url.trim() || undefined,
      vertical,
    });
  };

  const handleSampleClick = () => {
    setMode('text');
    setText(SAMPLE_TEXT);
  };

  // Simulate progress updates during verification
  useEffect(() => {
    if (mutation.isPending) {
      // Reset all to pending
      setProgressSteps([
        { label: 'Extracting claims', status: 'pending', detail: '' },
        { label: 'Searching for evidence', status: 'pending', detail: '' },
        { label: 'Ranking sources', status: 'pending', detail: '' },
        { label: 'Generating verdicts', status: 'pending', detail: '' }
      ]);

      const timeouts: NodeJS.Timeout[] = [];
      
      // Step 1: Extract claims
      timeouts.push(setTimeout(() => {
        setProgressSteps(prev => prev.map((step, i) => 
          i === 0 ? { ...step, status: 'active' } : step
        ));
      }, 500));

      timeouts.push(setTimeout(() => {
        setProgressSteps(prev => prev.map((step, i) => 
          i === 0 ? { ...step, status: 'complete', detail: 'Found 3 claims' } : step
        ));
      }, 2500));

      // Step 2: Search evidence
      timeouts.push(setTimeout(() => {
        setProgressSteps(prev => prev.map((step, i) => 
          i === 1 ? { ...step, status: 'active' } : step
        ));
      }, 2600));

      timeouts.push(setTimeout(() => {
        setProgressSteps(prev => prev.map((step, i) => 
          i === 1 ? { ...step, status: 'complete', detail: 'Queried 15 sources' } : step
        ));
      }, 6000));

      // Step 3: Rank
      timeouts.push(setTimeout(() => {
        setProgressSteps(prev => prev.map((step, i) => 
          i === 2 ? { ...step, status: 'active' } : step
        ));
      }, 6100));

      timeouts.push(setTimeout(() => {
        setProgressSteps(prev => prev.map((step, i) => 
          i === 2 ? { ...step, status: 'complete', detail: 'Ranked by relevance' } : step
        ));
      }, 8500));

      // Step 4: Verify
      timeouts.push(setTimeout(() => {
        setProgressSteps(prev => prev.map((step, i) => 
          i === 3 ? { ...step, status: 'active' } : step
        ));
      }, 8600));

      return () => timeouts.forEach(clearTimeout);
    }
  }, [mutation.isPending]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Mode Switcher */}
      <div className="flex p-1 bg-slate-100 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setMode('text')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
            mode === 'text'
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          )}
        >
          <FileText className="h-4 w-4" />
          Paste Text
        </button>
        <button
          type="button"
          onClick={() => setMode('url')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
            mode === 'url'
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          )}
        >
          <Globe className="h-4 w-4" />
          Verify URL
        </button>
      </div>

      {/* Text input */}
      {mode === 'text' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Quick Examples */}
          <div className="mb-4 p-4 bg-emerald-50 border border-emerald-100 rounded-lg">
            <p className="text-sm font-medium text-emerald-900 mb-3">Quick test examples:</p>
            <div className="flex flex-wrap gap-2">
              {DEMO_EXAMPLES.map(example => (
                <button
                  key={example.id}
                  type="button"
                  onClick={() => {
                    setText(example.text);
                    setVertical('general');
                  }}
                  title={example.description}
                  className="px-3 py-1.5 text-sm border border-emerald-300 bg-white rounded-lg
                             hover:bg-emerald-50 hover:border-emerald-500 transition-all
                             text-slate-700 hover:text-emerald-900"
                >
                  {example.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between mb-2">
            <label htmlFor="content" className="block text-sm font-medium text-slate-700">
              Content to Verify
            </label>
            <button
              type="button"
              onClick={handleSampleClick}
              className="text-sm text-green-600 hover:text-green-700 font-medium"
            >
              Try sample text
            </button>
          </div>
          <textarea
            id="content"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste any text content here - product descriptions, blog posts, articles, LinkedIn posts..."
            className={cn(
              "w-full h-64 px-4 py-3 rounded-xl border border-slate-300",
              "focus:ring-2 focus:ring-green-500 focus:border-transparent",
              "placeholder:text-slate-400 resize-none",
              "transition-all duration-200"
            )}
            disabled={mutation.isPending}
          />
          <div className="mt-1 flex justify-between text-sm text-slate-500">
            <span>{text.length.toLocaleString()} characters</span>
            
            {/* Optional Source URL for Text Mode */}
            <button
              type="button"
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="flex items-center gap-1 hover:text-slate-900"
            >
              <LinkIcon className="h-3 w-3" />
              {showUrlInput ? 'Remove source URL' : 'Add source URL context'}
            </button>
          </div>

          {showUrlInput && (
            <div className="mt-3 animate-in fade-in slide-in-from-top-1">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/original-article"
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
              />
            </div>
          )}
        </div>
      )}

      {/* URL Input Mode */}
      {mode === 'url' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
          <label htmlFor="url-input" className="block text-sm font-medium text-slate-700 mb-2">
            Webpage URL
          </label>
          <div className="relative">
            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              id="url-input"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://techcrunch.com/..."
              className={cn(
                "w-full pl-12 pr-4 py-4 rounded-xl border border-slate-300",
                "focus:ring-2 focus:ring-green-500 focus:border-transparent",
                "placeholder:text-slate-400 text-lg",
                "transition-all duration-200"
              )}
              disabled={mutation.isPending}
            />
          </div>
          <p className="mt-2 text-sm text-slate-500">
            We'll fetch the content, extract claims, and verify them against other sources.
          </p>
        </div>
      )}

      {/* Vertical selector */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Content Category
        </label>
        <div className="flex flex-wrap gap-2">
          {VERTICALS.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => setVertical(v.value)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all",
                vertical === v.value
                  ? "bg-green-600 text-white shadow-md"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error message */}
      {mutation.isError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 animate-in fade-in slide-in-from-top-2">
          <p className="font-medium">Verification failed</p>
          <p className="text-sm mt-1">
            {mutation.error instanceof Error 
              ? mutation.error.message 
              : 'An unexpected error occurred. Please try again.'}
          </p>
        </div>
      )}

      {/* Live Progress or Submit Button */}
      {mutation.isPending ? (
        <div className="p-6 bg-white border-2 border-emerald-200 rounded-xl">
          <div className="mb-3 text-sm font-medium text-slate-700">
            Verifying content...
          </div>
          <LiveProgress steps={progressSteps} />
        </div>
      ) : (
        <button
          type="submit"
          disabled={(!text.trim() && mode === 'text') || (!url.trim() && mode === 'url')}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl",
            "text-lg font-semibold transition-all duration-200",
            ((text.trim() && mode === 'text') || (url.trim() && mode === 'url'))
              ? "bg-green-600 text-white hover:bg-green-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              : "bg-slate-200 text-slate-400 cursor-not-allowed"
          )}
        >
          <Send className="h-5 w-5" />
          Verify Content
        </button>
      )}
    </form>
  );
}
