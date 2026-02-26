"use server"

import { cookies } from 'next/headers';

// Smart API URL detection for server-side
const getApiUrl = () => {
  // Server-side: use absolute URL
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
};

interface FetchOptions extends RequestInit {
  // Add any custom options if needed
}

/**
 * Server-side fetch utility for use in Server Components and Server Actions
 * Automatically adds Authorization header from cookies
 *
 * @param endpoint The API endpoint path (e.g., '/elections').
 * @param options Optional fetch options (method, body, etc.).
 * @returns The parsed JSON response.
 * @throws Error if the fetch fails or the response is not ok.
 */
export async function fetchApi<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;

  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && options.body) {
     // Default to JSON if body is present and Content-Type isn't set
    headers.set('Content-Type', 'application/json');
  }

  const baseUrl = getApiUrl();
  const url = `${baseUrl}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) {
      // Attempt to parse error details from the response body
      let errorBody;
      try {
        errorBody = await response.json();
      } catch (e) {
        // Ignore if response body is not JSON
      }
      console.error(`API Error: ${response.status} ${response.statusText}`, errorBody);
      throw new Error(`API request failed: ${response.status} ${response.statusText}${errorBody ? ` - ${JSON.stringify(errorBody)}` : ''}`);
    }

    // Handle cases where the response might be empty (e.g., 204 No Content)
    if (response.status === 204) {
        return null as T;
    }

    return await response.json() as T;
  } catch (error) {
    console.error(`Network or fetch error calling ${url}:`, error);
    throw error;
  }
} 
