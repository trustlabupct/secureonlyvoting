"use client"

interface FetchOptions extends RequestInit {
  // Add any custom options if needed
}

/**
 * Client-side fetch utility for use in React components
 * Automatically uses relative paths for API calls and includes cookies
 *
 * @param endpoint The API endpoint path (e.g., '/elections').
 * @param options Optional fetch options (method, body, etc.).
 * @returns The parsed JSON response.
 * @throws Error if the fetch fails or the response is not ok.
 */
export async function fetchApi<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const url = `/api${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // This ensures cookies are sent with the request
    });

    if (!response.ok) {
      let errorBody;
      try {
        errorBody = await response.json();
      } catch (e) {
        // Ignore if response body is not JSON
      }
      console.error(`API Error: ${response.status} ${response.statusText}`, errorBody);
      throw new Error(`API request failed: ${response.status} ${response.statusText}${errorBody ? ` - ${JSON.stringify(errorBody)}` : ''}`);
    }

    if (response.status === 204) {
      return null as T;
    }

    return await response.json() as T;
  } catch (error) {
    console.error(`Network or fetch error calling ${url}:`, error);
    throw error;
  }
} 
