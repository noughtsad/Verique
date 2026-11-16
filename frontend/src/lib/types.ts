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
  caveats?: string[];
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
  bio?: string | null;
  avatar_url?: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface PublicUser {
  id: number;
  username: string;
  full_name?: string | null;
  avatar_url?: string | null;
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
  image_url?: string | null;
  created_at: string;
  updated_at: string;
  latest_verification_summary?: PostVerificationSummary | null;
  challenge_state: string;
  likes_count: number;
  comments_count: number;
  is_liked_by_me: boolean;
  is_bookmarked_by_me: boolean;
}

export type Feed = 'all' | 'following' | 'popular';

export interface ListPostsParams {
  feed?: Feed;
  limit?: number;
  offset?: number;
  q?: string;
}

export interface UpdateMePayload {
  full_name?: string;
  bio?: string;
  avatar_url?: string;
}

export type UploadKind = 'post' | 'avatar';

export interface Comment {
  id: number;
  post_id: number;
  author: PublicUser;
  content: string;
  created_at: string;
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
  image_url?: string;
}

export interface ChallengePayload {
  reason_code: string;
  comment?: string;
}

// Keep in sync with REPORT_REASONS in backend/app/models/report.py.
export const REPORT_REASONS = [
  { code: 'impersonation', label: "It's impersonating someone else", hint: 'Pretending to be another person, brand or organization.' },
  { code: 'misinformation', label: "It's spreading misinformation", hint: 'False or misleading claims presented as fact.' },
  { code: 'spam', label: "It's spam", hint: 'Repetitive, promotional or irrelevant content.' },
  { code: 'harassment', label: 'Harassment or hate speech', hint: 'Attacks, threats or demeaning content aimed at people.' },
  { code: 'scam', label: 'Scam or fraud', hint: 'Trying to trick people out of money or personal information.' },
  { code: 'other', label: 'Something else', hint: "It doesn't fit the options above." },
] as const;

export type ReportReasonCode = (typeof REPORT_REASONS)[number]['code'];

export interface ReportPostPayload {
  reason_code: ReportReasonCode;
  details?: string;
}

export interface ModerationDecisionPayload {
  decision: ReviewDecision;
  note: string;
  override_score?: number;
  override_summary?: string;
}

// -----------------------------------------------------------------------
// Social networking — Follow system
// -----------------------------------------------------------------------

export interface UserProfile {
  id: number;
  username: string;
  full_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
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
  avatar_url?: string | null;
  role: UserRole;
  is_followed_by_me: boolean;
}

export interface FollowResponse {
  follower_id: number;
  followed_id: number;
  created_at: string;
}

// -----------------------------------------------------------------------
// Chat — Direct messages
// -----------------------------------------------------------------------

export interface Message {
  id: number;
  conversation_id: number;
  sender: PublicUser;
  content: string;
  created_at: string;
}

export interface Conversation {
  id: number;
  other_user: PublicUser;
  last_message: Message | null;
  unread_count: number;
  created_at: string;
  last_message_at: string | null;
}

export interface SendMessagePayload {
  content: string;
}

export type ChatWsEnvelope =
  | { type: 'message'; data: Message }
  | { type: 'error'; data: { detail: string } };

// -----------------------------------------------------------------------
// Notifications
// -----------------------------------------------------------------------

export interface Notification {
  id: number;
  type: 'like' | 'comment' | 'follow';
  actor: PublicUser;
  post_id?: number | null;
  preview?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationCountResponse {
  unread_count: number;
}
