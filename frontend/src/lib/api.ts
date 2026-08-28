/**
 * API client for Verique backend.
 */

import {
  AuthResponse,
  Challenge,
  ChallengePayload,
  CreatePostPayload,
  FollowerListItem,
  FollowResponse,
  LoginPayload,
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
    if (response.status === 401) {
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
