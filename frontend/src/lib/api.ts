/**
 * API client for Verique backend.
 */

import {
  AuthResponse,
  Challenge,
  ChallengePayload,
  Comment,
  Conversation,
  CreatePostPayload,
  FollowerListItem,
  FollowResponse,
  LoginPayload,
  Message,
  ModerationDecisionPayload,
  ModerationReview,
  Post,
  PostVerification,
  RegisterPayload,
  User,
  UserProfile,
  VerificationResult,
  VerifyRequest,
  VerifyUrlRequest,
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function clearAuthToken() {
  try {
    await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch (error) {
    console.error('Failed to logout server-side:', error);
  }
}

async function apiFetch<T>(path: string, init?: RequestInit, requireAuth = false): Promise<T> {
  const headers = new Headers(init?.headers || {});
  headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include', // Send httpOnly cookies
  });

  if (!response.ok) {
    if (response.status === 401 && requireAuth) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    const error = await response.json().catch(() => null);
    const message =
      error?.detail ||
      error?.message ||
      (typeof error === 'string' ? error : null) ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getCurrentUser(): Promise<User> {
  return apiFetch<User>('/api/v1/auth/me', undefined, true);
}

export async function listPosts(): Promise<Post[]> {
  return apiFetch<Post[]>('/api/v1/posts/');
}

export async function getPost(postId: number): Promise<Post> {
  return apiFetch<Post>(`/api/v1/posts/${postId}`);
}

export async function createPost(payload: CreatePostPayload): Promise<Post> {
  return apiFetch<Post>(
    '/api/v1/posts/',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    true,
  );
}

export async function verifyPost(postId: number): Promise<PostVerification> {
  return apiFetch<PostVerification>(
    `/api/v1/posts/${postId}/verify`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
    true,
  );
}

export async function getLatestPostVerification(postId: number): Promise<PostVerification | null> {
  return apiFetch<PostVerification | null>(`/api/v1/posts/${postId}/verifications/latest`);
}

export async function likePost(postId: number): Promise<void> {
  return apiFetch<void>(`/api/v1/posts/${postId}/like`, { method: 'POST' }, true);
}

export async function unlikePost(postId: number): Promise<void> {
  return apiFetch<void>(`/api/v1/posts/${postId}/like`, { method: 'DELETE' }, true);
}

export async function listComments(postId: number): Promise<Comment[]> {
  return apiFetch<Comment[]>(`/api/v1/posts/${postId}/comments`);
}

export async function addComment(postId: number, content: string): Promise<Comment> {
  return apiFetch<Comment>(
    `/api/v1/posts/${postId}/comments`,
    { method: 'POST', body: JSON.stringify({ content }) },
    true,
  );
}

export async function challengeVerification(
  verificationId: number,
  payload: ChallengePayload,
): Promise<Challenge> {
  return apiFetch<Challenge>(
    `/api/v1/verifications/${verificationId}/challenges`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    true,
  );
}

export async function listModerationReviews(): Promise<ModerationReview[]> {
  return apiFetch<ModerationReview[]>('/api/v1/moderation/reviews', undefined, true);
}

export async function resolveModerationReview(
  reviewId: number,
  payload: ModerationDecisionPayload,
): Promise<ModerationReview> {
  return apiFetch<ModerationReview>(
    `/api/v1/moderation/reviews/${reviewId}/resolve`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    true,
  );
}

export async function verifyContent(request: VerifyRequest): Promise<VerificationResult> {
  return apiFetch<VerificationResult>('/api/v1/verify/', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function verifyUrl(url: string, vertical?: string): Promise<VerificationResult> {
  const request: VerifyUrlRequest = { url, vertical: vertical as never };
  return apiFetch<VerificationResult>('/api/v1/verify/url', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function getVerificationStatus(verificationId: string): Promise<unknown> {
  return apiFetch<unknown>(`/api/v1/verify/${verificationId}`);
}

export async function healthCheck(): Promise<{ status: string }> {
  return apiFetch<{ status: string }>('/health');
}

// -----------------------------------------------------------------------
// Social — User profiles & follow system
// -----------------------------------------------------------------------

export async function getFollowSuggestions(limit = 5): Promise<FollowerListItem[]> {
  return apiFetch<FollowerListItem[]>(`/api/v1/users/suggestions/for-me?limit=${limit}`, undefined, true);
}

export async function searchUsers(query: string, limit = 5): Promise<FollowerListItem[]> {
  return apiFetch<FollowerListItem[]>(
    `/api/v1/users/search?q=${encodeURIComponent(query)}&limit=${limit}`,
  );
}

export async function getUserProfile(username: string): Promise<UserProfile> {
  return apiFetch<UserProfile>(`/api/v1/users/${username}`);
}

export async function getUserPosts(
  username: string,
  limit = 20,
  offset = 0,
): Promise<Post[]> {
  return apiFetch<Post[]>(`/api/v1/users/${username}/posts?limit=${limit}&offset=${offset}`);
}

export async function getFollowers(username: string): Promise<FollowerListItem[]> {
  return apiFetch<FollowerListItem[]>(`/api/v1/users/${username}/followers`);
}

export async function getFollowing(username: string): Promise<FollowerListItem[]> {
  return apiFetch<FollowerListItem[]>(`/api/v1/users/${username}/following`);
}

export async function followUser(username: string): Promise<FollowResponse> {
  return apiFetch<FollowResponse>(
    `/api/v1/users/${username}/follow`,
    { method: 'POST', body: JSON.stringify({}) },
    true,
  );
}

export async function unfollowUser(username: string): Promise<void> {
  await apiFetch<void>(
    `/api/v1/users/${username}/follow`,
    { method: 'DELETE' },
    true,
  );
}

// -----------------------------------------------------------------------
// Chat — Direct messages
// -----------------------------------------------------------------------

export async function listConversations(): Promise<Conversation[]> {
  return apiFetch<Conversation[]>('/api/v1/chat/conversations', undefined, true);
}

export async function getOrCreateConversation(username: string): Promise<Conversation> {
  return apiFetch<Conversation>(
    `/api/v1/chat/conversations/${username}`,
    { method: 'POST' },
    true,
  );
}

export async function listMessages(
  conversationId: number,
  beforeId?: number,
  limit = 50,
): Promise<Message[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (beforeId !== undefined) params.set('before_id', String(beforeId));
  return apiFetch<Message[]>(
    `/api/v1/chat/conversations/${conversationId}/messages?${params}`,
    undefined,
    true,
  );
}

export async function sendMessageRest(conversationId: number, content: string): Promise<Message> {
  return apiFetch<Message>(
    `/api/v1/chat/conversations/${conversationId}/messages`,
    { method: 'POST', body: JSON.stringify({ content }) },
    true,
  );
}

export async function markConversationRead(conversationId: number): Promise<void> {
  return apiFetch<void>(
    `/api/v1/chat/conversations/${conversationId}/read`,
    { method: 'POST' },
    true,
  );
}

export function getChatWebSocketUrl(): string {
  const wsBase = API_BASE_URL.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
  return `${wsBase}/api/v1/chat/ws`;
}
