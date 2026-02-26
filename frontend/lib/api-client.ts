import { cookies } from 'next/headers';

// Smart API URL detection - use relative paths on client-side, absolute on server-side
const getApiUrl = () => {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined') {
    // Client-side: use relative paths (Next.js proxy will handle)
    return '/api';
  } else {
    // Server-side: use absolute URL
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  }
};

interface FetchOptions extends RequestInit {
  // Add any custom options if needed
}

/**
 * Fetches data from the backend API, automatically adding the Authorization header.
 * Should be called from Server Components or Route Handlers where cookies() is available.
 *
 * @param endpoint The API endpoint path (e.g., '/elections').
 * @param options Optional fetch options (method, body, etc.).
 * @returns The parsed JSON response.
 * @throws Error if the fetch fails or the response is not ok.
 */
export async function fetchApi<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const cookieStore = await cookies(); // Add await here
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
      credentials: 'include', // Ensure cookies are sent, especially for cross-origin requests (e.g. localhost:3000 to localhost:3001)
      cache: 'no-store', // Add cache: no-store to ensure fresh data for dynamic fetches
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
        return null as T; // Or handle as appropriate for your application
    }

    return await response.json() as T;
  } catch (error) {
    console.error(`Network or fetch error calling ${url}:`, error);
    // Re-throw the error to be handled by the caller
    throw error;
  }
}

/**
 * Client-side fetch utility for use in React components
 * Automatically uses relative paths for API calls
 */
export async function fetchApiClient<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const url = `/api${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
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

    const data = await response.json() as T;
    return data;
  } catch (error) {
    console.error(`Network or fetch error calling ${url}:`, error);
    throw error;
  }
}

// Example usage for fetching elections:
// import { fetchApi } from '@/lib/api-client';
// const elections = await fetchApi('/elections');

// Example usage for posting a vote:
// const voteData = { electionId: '...', optionId: '...' };
// const result = await fetchApi('/votes', {
//   method: 'POST',
//   body: JSON.stringify(voteData),
// });
