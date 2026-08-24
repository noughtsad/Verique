/**
 * API client for Verique backend.
 */

import {
  AuthResponse,
  Challenge,
  ChallengePayload,
  CreatePostPayload,
  LoginPayload,
  ModerationDecisionPayload,
  ModerationReview,
  Post,
  PostVerification,
  RegisterPayload,
  User,
  VerificationResult,
  VerifyRequest,
  VerifyUrlRequest,
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const TOKEN_STORAGE_KEY = 'verique_access_token';

function getAuthToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setAuthToken(token: string) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }
}

export function clearAuthToken() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

async function apiFetch<T>(path: string, init?: RequestInit, requireAuth = false): Promise<T> {
  const headers = new Headers(init?.headers || {});
  headers.set('Content-Type', 'application/json');

  const token = getAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  } else if (requireAuth) {
    throw new Error('Please sign in to continue');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401 && token) {
      clearAuthToken();
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
  const data = await apiFetch<AuthResponse>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  setAuthToken(data.access_token);
  return data;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  setAuthToken(data.access_token);
  return data;
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
