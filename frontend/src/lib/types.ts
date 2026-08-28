/**
 * Shared frontend types for verification and social workflows.
 */

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
export type UserRole = 'user' | 'moderator' | 'admin';
export type ReviewDecision = 'uphold' | 'revise' | 'remove_verdict';

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

export interface VerifyRequest {
  text: string;
  url?: string;
  vertical?: Vertical;
  language?: string;
  options?: Record<string, unknown>;
}

export interface VerifyUrlRequest {
  url: string;
  vertical?: Vertical;
  options?: Record<string, unknown>;
}

export interface ErrorResponse {
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface User {
  id: number;
  email: string;
  username: string;
  full_name?: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface PublicUser {
  id: number;
  username: string;
  full_name?: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: 'bearer';
  user: User;
}

export interface PostVerificationSummary {
  id: number;
  status: string;
  score?: number | null;
  summary?: VerificationSummary | null;
  challenge_count: number;
  review_status: string;
  final_decision?: string | null;
  final_decision_note?: string | null;
  is_human_final: boolean;
  created_at: string;
}

export interface Post {
  id: number;
  author: PublicUser;
  content: string;
  source_url?: string | null;
  created_at: string;
  updated_at: string;
  latest_verification_summary?: PostVerificationSummary | null;
  challenge_state: string;
}

export interface PostVerification {
  id: number;
  verification_id: string;
  post_id: number;
  status: string;
  score?: number | null;
  summary?: VerificationSummary | null;
  claims: ClaimResult[];
  metadata?: VerificationMetadata | null;
  challenge_count: number;
  review_status: string;
  final_decision?: string | null;
  final_decision_note?: string | null;
  is_human_final: boolean;
  created_at: string;
  completed_at?: string | null;
}

export interface Challenge {
  id: number;
  verification_id: number;
  user: PublicUser;
  reason_code: string;
  comment?: string | null;
  status: string;
  created_at: string;
}

export interface ModerationReview {
  id: number;
  verification_id: number;
  status: string;
  decision?: ReviewDecision | null;
  note?: string | null;
  override_score?: number | null;
  override_summary?: string | null;
  created_at: string;
  decided_at?: string | null;
  moderator?: PublicUser | null;
  verification: PostVerification;
  post: Post;
}

export interface RegisterPayload {
  email: string;
  username: string;
  full_name?: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface CreatePostPayload {
  content: string;
  source_url?: string;
}

export interface ChallengePayload {
  reason_code: string;
  comment?: string;
}

export interface ModerationDecisionPayload {
  decision: ReviewDecision;
  note: string;
  override_score?: number;
  override_summary?: string;
}

export const VERDICT_CONFIG: Record<
  Verdict,
  {
    label: string;
    icon: string;
    color: string;
    bgColor: string;
    borderColor: string;
    score: number;
  }
> = {
  strongly_supported: {
    label: 'Strongly Supported',
    icon: '++',
    color: 'text-green-800',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-600',
    score: 100,
  },
  supported: {
    label: 'Supported',
    icon: '+',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-500',
    score: 80,
  },
  mixed: {
    label: 'Mixed Evidence',
    icon: '+/-',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-500',
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
    icon: 'x',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-500',
    score: 20,
  },
  outdated: {
    label: 'Outdated',
    icon: 'old',
    color: 'text-violet-700',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-500',
    score: 30,
  },
  not_verifiable: {
    label: 'Not Verifiable',
    icon: 'o',
    color: 'text-slate-700',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-400',
    score: 50,
  },
};

// -----------------------------------------------------------------------
// Social networking — Follow system
// -----------------------------------------------------------------------

export interface UserProfile {
  id: number;
  username: string;
  full_name?: string | null;
  bio?: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
  is_followed_by_me: boolean;
}

export interface FollowerListItem {
  id: number;
  username: string;
  full_name?: string | null;
  bio?: string | null;
  role: UserRole;
  is_followed_by_me: boolean;
}

export interface FollowResponse {
  follower_id: number;
  followed_id: number;
  created_at: string;
}

