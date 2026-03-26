/**
 * Type definitions for the Verique verification system
 * These types mirror the backend Pydantic schemas
 */

// ============================================
// Enums
// ============================================

export type Vertical = 
  | 'ecommerce'
  | 'saas'
  | 'tech'
  | 'finance'
  | 'health'
  | 'education'
  | 'professional'
  | 'general';

export type TimeSensitivity = 'high' | 'medium' | 'low';

export type ClaimType = 
  | 'numeric'
  | 'entity'
  | 'temporal'
  | 'comparative'
  | 'causal'
  | 'general';

export type Verdict = 
  | 'strongly_supported'
  | 'supported'
  | 'mixed'
  | 'weak'
  | 'contradicted'
  | 'outdated'
  | 'not_verifiable';

export type SourceRole = 'supporting' | 'contradicting' | 'neutral';

// ============================================
// Interfaces
// ============================================

export interface SourceInfo {
  url: string;
  domain: string;
  snippet: string;
  domain_score: number;
  published_at?: string;
  role?: SourceRole;
}

export type Source = SourceInfo;

export interface ClaimSources {
  supporting: SourceInfo[];
  contradicting: SourceInfo[];
}

export interface ClaimResult {
  id: string;
  span: [number, number];
  text: string;
  claim_type: ClaimType;
  topic: Vertical;
  time_sensitivity: TimeSensitivity;
  verdict: Verdict;
  confidence: number;
  reasoning: string;
  sources: ClaimSources;
}

export interface VerificationSummary {
  strongly_supported: number;
  supported: number;
  mixed: number;
  weak: number;
  contradicted: number;
  outdated: number;
  not_verifiable: number;
}

export interface VerificationMetadata {
  processing_time_ms: number;
  models_used: string[];
  sources_checked: number;
  cached?: boolean;
}

export interface VerificationResult {
  verification_id: string;
  status: string;
  page_score: number;
  summary: VerificationSummary;
  claims: ClaimResult[];
  metadata: VerificationMetadata;
  content_hash?: string;
  blockchain_tx?: string;
}

// ============================================
// Request Types
// ============================================

export interface VerifyRequest {
  text: string;
  url?: string;
  vertical?: Vertical;
  language?: string;
  options?: Record<string, any>;
}

export interface VerifyUrlRequest {
  url: string;
  vertical?: Vertical;
  options?: Record<string, any>;
}

// ============================================
// Error Types
// ============================================

export interface ErrorResponse {
  error: string;
  message: string;
  details?: Record<string, any>;
}

// ============================================
// UI Configuration
// ============================================

export const VERDICT_CONFIG: Record<Verdict, {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  score: number;
}> = {
  strongly_supported: {
    label: 'Strongly Supported',
    icon: '✓✓',
    color: 'text-green-800',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-600',
    score: 100,
  },
  supported: {
    label: 'Supported',
    icon: '✓',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-500',
    score: 80,
  },
  mixed: {
    label: 'Mixed Evidence',
    icon: '±',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-500',
    score: 60,
  },
  weak: {
    label: 'Weak Evidence',
    icon: '?',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-500',
    score: 40,
  },
  contradicted: {
    label: 'Contradicted',
    icon: '✗',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-500',
    score: 20,
  },
  outdated: {
    label: 'Outdated',
    icon: '⌛',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-500',
    score: 30,
  },
  not_verifiable: {
    label: 'Not Verifiable',
    icon: '○',
    color: 'text-gray-700',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-400',
    score: 50,
  },
};
