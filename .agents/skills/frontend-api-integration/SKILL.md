---
name: frontend-api-integration
description: Use when integrating HTTP or REST APIs into Next.js or React frontend applications, building typed fetch clients, handling standardized API error responses, managing tenant/auth headers, or implementing data fetching in Server Components, Server Actions, and Client Components.
---

# Frontend API Integration

## Overview

A robust, type-safe API integration layer for Next.js and React applications. All HTTP interactions enforce a unified API response envelope, transparent error handling for 4xx/5xx status codes, request timeouts, transient retry backoffs, and context header propagation.

**Core Principle:** Never use ad-hoc un-intercepted `fetch` calls scattered across UI components. Every API response follows a strict, typed envelope (`ApiResult<T>`) where errors are structured, deterministic, and gracefully handled in both Server and Client contexts.

**REQUIRED SUB-SKILLS:**
- **REQUIRED:** Use [nextjs](file:///mnt/volume/prince-04-25/Workspace/Projects/omni/.agents/skills/nextjs/SKILL.md) for Next.js 15 App Router conventions (`await headers()`, Server Components, Server Actions).
- **REQUIRED:** Use [vercel-react-best-practices](file:///mnt/volume/prince-04-25/Workspace/Projects/omni/.agents/skills/vercel-react-best-practices/SKILL.md) to eliminate network waterfalls (`Promise.all`, Suspense streaming).

---

## When to Use

Use this skill when:
- Creating or refactoring API client layer or HTTP request utilities in React/Next.js apps.
- Intercepting and handling standard backend HTTP status errors (`400`, `401`, `403`, `404`, `422`, `500`, `503`).
- Forwarding authorization and tenant headers (`client-id`, `workspace-id`, `user-id`, `Authorization`) from Next.js server context to backend microservices.
- Consuming REST APIs in Next.js Server Components, Server Actions, or Client Components.
- Normalizing API error payloads into structured, user-friendly UI toasts, validation state, or error boundaries.

**When NOT to Use:**
- Internal component local state management (use React state or Zustand).
- GraphQL or WebSocket clients (use dedicated Apollo/urql or WebSocket client patterns).

---

## Standardized Response & Error Envelope Contract

Every backend endpoint and API integration client response MUST adhere to the standard envelope:

```typescript
// Envelope for successful API responses
export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    [key: string]: unknown;
  };
};

// Detail item for field-level validation errors (e.g. 422 Unprocessable Entity)
export type ApiErrorDetail = {
  field?: string;
  message: string;
  code?: string;
};

// Envelope for error API responses
export type ApiErrorResponse = {
  success: false;
  error: {
    code: string;       // e.g. "UNAUTHORIZED", "VALIDATION_ERROR", "INTERNAL_SERVER_ERROR"
    message: string;    // Human-readable summary
    status: number;     // HTTP status code (e.g. 401, 404, 422, 500)
    details?: ApiErrorDetail[];
    timestamp?: string;
  };
};

// Discriminated Union for API operations
export type ApiResult<T> = ApiSuccessResponse<T> | ApiErrorResponse;
```

---

## Core Implementation Patterns

### 1. Centralized Typed API Client Wrapper (`apiClient`)

Implement a single, lightweight, dependency-free wrapper around the native Web `fetch` API. Handles timeouts with `AbortSignal.timeout`, parses structured error payloads, retries transient 5xx failures, and sets default headers.

```typescript
// lib/api-client.ts

import { ApiResult, ApiErrorResponse, ApiSuccessResponse } from './types';

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: ApiErrorResponse['error']['details'];

  constructor(errorResponse: ApiErrorResponse['error']) {
    super(errorResponse.message);
    this.name = 'ApiError';
    this.status = errorResponse.status;
    this.code = errorResponse.code;
    this.details = errorResponse.details;
  }
}

export type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  timeoutMs?: number;
  retries?: number;
};

const DEFAULT_TIMEOUT_MS = 10_000;

export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    body,
    headers: customHeaders,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = 2,
    ...fetchInit
  } = options;

  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;

  const headers = new Headers(customHeaders);
  if (body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= retries) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        ...fetchInit,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: fetchInit.signal || controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse JSON body or default fallback if body is empty
      let payload: unknown;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        payload = await response.json();
      } else {
        payload = await response.text();
      }

      // Handle non-2xx responses
      if (!response.ok) {
        const errorObject = parseErrorPayload(payload, response.status);
        
        // Retry transient server errors (502, 503, 504)
        if ([502, 503, 504].includes(response.status) && attempt < retries) {
          attempt++;
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 200));
          continue;
        }

        throw new ApiError(errorObject);
      }

      // Handle successful envelope or raw payload
      if (isApiSuccessEnvelope<T>(payload)) {
        return payload.data;
      }

      return payload as T;
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        throw err;
      }
      
      const isAbort = err instanceof Error && err.name === 'AbortError';
      lastError = new ApiError({
        status: isAbort ? 504 : 0,
        code: isAbort ? 'TIMEOUT' : 'NETWORK_ERROR',
        message: isAbort ? 'Request timed out' : 'Failed to connect to server',
      });

      if (attempt < retries && !isAbort) {
        attempt++;
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 200));
        continue;
      }

      throw lastError;
    }
  }

  throw lastError || new Error('Request failed');
}

// Helpers
function isApiSuccessEnvelope<T>(data: unknown): data is ApiSuccessResponse<T> {
  return typeof data === 'object' && data !== null && 'success' in data && (data as { success: boolean }).success === true;
}

function parseErrorPayload(payload: unknown, status: number): ApiErrorResponse['error'] {
  if (typeof payload === 'object' && payload !== null && 'error' in payload) {
    const err = (payload as { error: ApiErrorResponse['error'] }).error;
    return {
      status: err.status || status,
      code: err.code || getDefaultCode(status),
      message: err.message || 'An unexpected error occurred',
      details: err.details,
    };
  }

  return {
    status,
    code: getDefaultCode(status),
    message: typeof payload === 'string' && payload ? payload : `HTTP Error ${status}`,
  };
}

function getDefaultCode(status: number): string {
  switch (status) {
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 422: return 'VALIDATION_ERROR';
    case 429: return 'TOO_MANY_REQUESTS';
    default: return status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST';
  }
}
```

---

### 2. Next.js 15 Server Components Integration (Header Forwarding)

When calling backend services from Next.js Server Components, forward incoming context headers (`Authorization`, `client-id`, `workspace-id`, `user-id`) using Next.js 15 async `headers()`.

```typescript
// app/dashboard/page.tsx (Server Component)

import { headers } from 'next/headers';
import { apiClient, ApiError } from '@/lib/api-client';

type DashboardData = {
  activeCampaigns: number;
  totalReach: number;
};

async function getDashboardData(): Promise<DashboardData | null> {
  const incomingHeaders = await headers();
  
  try {
    return await apiClient<DashboardData>('/v1/dashboard/metrics', {
      headers: {
        'authorization': incomingHeaders.get('authorization') || '',
        'client-id': incomingHeaders.get('client-id') || '',
        'workspace-id': incomingHeaders.get('workspace-id') || '',
        'user-id': incomingHeaders.get('user-id') || '',
      },
      next: { revalidate: 60, tags: ['dashboard-metrics'] },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      console.error(`[Dashboard Fetch Failed] Status: ${error.status}, Code: ${error.code}`);
    }
    return null;
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  if (!data) {
    return <div className="p-4 text-red-500">Failed to load dashboard metrics.</div>;
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="p-4 border rounded">Active Campaigns: {data.activeCampaigns}</div>
        <div className="p-4 border rounded">Total Reach: {data.totalReach}</div>
      </div>
    </main>
  );
}
```

---

### 3. Next.js 15 Server Actions Integration (Safe Mutation Handler)

For form mutations or server actions, wrap action executions in a standardized result handler to ensure typed success/failure returns without uncaught server exceptions.

```typescript
// app/actions/update-user.ts
'use me' // Server action
'use server';

import { headers } from 'next/headers';
import { apiClient, ApiError } from '@/lib/api-client';

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export async function updateUserProfile(formData: FormData): Promise<ActionResult<{ userId: string }>> {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;

  if (!email || !email.includes('@')) {
    return {
      success: false,
      error: 'Invalid email address',
      fieldErrors: { email: 'Please provide a valid email' },
    };
  }

  const reqHeaders = await headers();

  try {
    const updated = await apiClient<{ userId: string }>('/v1/users/profile', {
      method: 'PUT',
      body: { name, email },
      headers: {
        'authorization': reqHeaders.get('authorization') || '',
        'workspace-id': reqHeaders.get('workspace-id') || '',
      },
    });

    return { success: true, data: updated };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 422 && err.details) {
        const fieldErrors: Record<string, string> = {};
        err.details.forEach((detail) => {
          if (detail.field) fieldErrors[detail.field] = detail.message;
        });
        return { success: false, error: err.message, fieldErrors };
      }
      return { success: false, error: err.message };
    }

    return { success: false, error: 'An unexpected network error occurred.' };
  }
}
```

---

### 4. Client Components Data Fetching & Error UX

In Client Components (`'use client'`), handle UI states (loading, error, data) deterministically, supporting error toasts or field validation mappings.

```typescript
// components/user-profile-form.tsx
'use client';

import { useState, useTransition } from 'react';
import { updateUserProfile } from '@/app/actions/update-user';

export function UserProfileForm() {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMsg(null);
    setFieldErrors({});
    setIsSuccess(false);

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateUserProfile(formData);

      if (!result.success) {
        setErrorMsg(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      } else {
        setIsSuccess(true);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      {errorMsg && (
        <div className="p-3 bg-red-100 text-red-700 rounded text-sm">{errorMsg}</div>
      )}
      {isSuccess && (
        <div className="p-3 bg-green-100 text-green-700 rounded text-sm">Profile updated!</div>
      )}

      <div>
        <label className="block text-sm font-medium">Name</label>
        <input name="name" type="text" required className="w-full border p-2 rounded" />
      </div>

      <div>
        <label className="block text-sm font-medium">Email</label>
        <input name="email" type="email" required className="w-full border p-2 rounded" />
        {fieldErrors.email && (
          <p className="text-red-500 text-xs mt-1">{fieldErrors.email}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        {isPending ? 'Saving...' : 'Save Profile'}
      </button>
    </form>
  );
}
```

---

## Quick Reference & Red Flags

| HTTP Status | Standard Code | Action in Frontend Client |
|---|---|---|
| `400` | `BAD_REQUEST` | Display form validation error or alert |
| `401` | `UNAUTHORIZED` | Redirect to login or refresh auth token session |
| `403` | `FORBIDDEN` | Show Access Denied UI / insufficient permissions banner |
| `404` | `NOT_FOUND` | Trigger `notFound()` or display empty state component |
| `422` | `VALIDATION_ERROR` | Map `details` array to inline input field errors |
| `429` | `TOO_MANY_REQUESTS` | Show rate limit warning; block retry for `Retry-After` duration |
| `500` - `504` | `INTERNAL_SERVER_ERROR` | Retry transient failure twice with backoff; fallback to error boundary |

---

## Common Mistakes & Anti-Patterns

- ❌ **Direct `fetch()` calls in components:** Repeating headers, JSON parsing, and error catching in every UI component leads to inconsistent error handling and missing tenant headers.
- ❌ **Swallowing Error Payload:** Catching exceptions without checking `error.status` or `error.details`, returning `{}` or `null` silently.
- ❌ **Sync `headers()` in Next.js 16/15:** Calling `headers()` synchronously in Next.js App Router (must be `await headers()`).
- ❌ **Exposing Secret Tokens:** Using `NEXT_PUBLIC_` prefixes for confidential API secret keys instead of proxying through Server Actions or Route Handlers.
- ❌ **Waterfall Async Fetches:** Awaiting multiple API calls sequentially when they are independent (use `Promise.all` as recommended in [`vercel-react-best-practices`](file:///mnt/volume/prince-04-25/Workspace/Projects/omni/.agents/skills/vercel-react-best-practices/SKILL.md)).
