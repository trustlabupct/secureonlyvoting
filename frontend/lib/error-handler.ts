import { toast } from '@/hooks/use-toast';

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
  details?: any;
}

export interface ErrorHandlerOptions {
  showToast?: boolean;
  fallbackMessage?: string;
  context?: string;
}

/**
 * Maps common HTTP status codes to user-friendly error messages
 */
export const getErrorMessage = (statusCode: number, originalMessage?: string): string => {
  const errorMessages: Record<number, string> = {
    400: 'Invalid request. Please check your input and try again.',
    401: 'Please log in again to continue.',
    403: 'You do not have permission to perform this action.',
    404: 'The requested resource was not found.',
    409: 'This action conflicts with existing data. Please refresh and try again.',
    413: 'The request is too large. Please try with smaller data.',
    422: 'Invalid data provided. Please check your input.',
    429: 'Too many requests. Please wait a moment before trying again.',
    500: 'A server error occurred. Please try again later.',
    502: 'Service temporarily unavailable. Please try again later.',
    503: 'Service temporarily unavailable. Please try again later.',
    504: 'Request timeout. Please try again.',
  };

  // Use original message if it's more specific and helpful
  if (originalMessage && originalMessage !== 'An error occurred') {
    // Check if it's a generic message that should be replaced
    const genericMessages = [
      'Internal server error',
      'Bad request',
      'Unauthorized',
      'Forbidden',
      'Not found',
    ];
    
    const isGeneric = genericMessages.some(generic => 
      originalMessage.toLowerCase().includes(generic.toLowerCase())
    );
    
    if (!isGeneric) {
      return originalMessage;
    }
  }

  return errorMessages[statusCode] || 'An unexpected error occurred. Please try again.';
};

/**
 * Enhanced error handler that provides context-aware error messages
 */
export const handleApiError = (
  error: any,
  options: ErrorHandlerOptions = {}
): string => {
  const { showToast = true, fallbackMessage, context } = options;

  let statusCode = 500;
  let message = 'An unexpected error occurred';
  let details = null;

  // Extract error information from different error formats
  if (error?.response) {
    // Axios-style error
    statusCode = error.response.status;
    message = error.response.data?.message || error.response.statusText;
    details = error.response.data;
  } else if (error?.status || error?.statusCode) {
    // Fetch API or custom error
    statusCode = error.status || error.statusCode;
    message = error.message || error.statusText;
    details = error.details || error.data;
  } else if (typeof error === 'string') {
    // String error
    message = error;
  } else if (error?.message) {
    // Standard Error object
    message = error.message;
  }

  // Get user-friendly error message
  const userMessage = getErrorMessage(statusCode, message);

  // Add context if provided
  const contextualMessage = context 
    ? `${context}: ${userMessage}`
    : userMessage;

  const finalMessage = fallbackMessage || contextualMessage;

  // Show toast notification if requested
  if (showToast) {
    toast({
      title: getErrorTitle(statusCode),
      description: finalMessage,
      variant: getErrorVariant(statusCode),
    });
  }

  // Log error for debugging
  console.error('Error handled:', {
    statusCode,
    originalMessage: message,
    userMessage: finalMessage,
    details,
    context,
  });

  return finalMessage;
};

/**
 * Get appropriate error title based on status code
 */
const getErrorTitle = (statusCode: number): string => {
  if (statusCode >= 400 && statusCode < 500) {
    return 'Request Error';
  } else if (statusCode >= 500) {
    return 'Server Error';
  }
  return 'Error';
};

/**
 * Get appropriate toast variant based on status code
 */
const getErrorVariant = (statusCode: number): 'default' | 'destructive' => {
  return statusCode >= 400 ? 'destructive' : 'default';
};

/**
 * Enhanced fetch wrapper with better error handling
 */
export const fetchWithErrorHandling = async (
  url: string,
  options: RequestInit = {},
  errorOptions: ErrorHandlerOptions = {}
): Promise<any> => {
  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: response.statusText };
      }

      const error = {
        status: response.status,
        message: errorData.message || response.statusText,
        details: errorData,
      };

      handleApiError(error, errorOptions);
      throw error;
    }

    return await response.json();
  } catch (error: unknown) {
    const hasStatus =
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      typeof (error as { status?: unknown }).status === 'number'

    if (!hasStatus) {
      // Network or other non-HTTP error
      const networkError = {
        status: 0,
        message: 'Network error. Please check your connection and try again.',
      };
      handleApiError(networkError, errorOptions);
      throw networkError;
    }
    throw error;
  }
};

/**
 * Validation error handler for form errors
 */
export const handleValidationErrors = (
  errors: Record<string, string[]> | any,
  showToast: boolean = true
): Record<string, string> => {
  const formattedErrors: Record<string, string> = {};

  if (errors && typeof errors === 'object') {
    Object.keys(errors).forEach(field => {
      const fieldErrors = errors[field];
      if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
        formattedErrors[field] = fieldErrors[0]; // Take first error
      } else if (typeof fieldErrors === 'string') {
        formattedErrors[field] = fieldErrors;
      }
    });

    if (showToast && Object.keys(formattedErrors).length > 0) {
      const errorCount = Object.keys(formattedErrors).length;
      toast({
        title: 'Validation Error',
        description: `Please fix ${errorCount} error${errorCount > 1 ? 's' : ''} in the form.`,
        variant: 'destructive',
      });
    }
  }

  return formattedErrors;
};

/**
 * Rate limit error handler with specific messaging
 */
export const handleRateLimitError = (retryAfter?: number): void => {
  const message = retryAfter 
    ? `Rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`
    : 'Rate limit exceeded. Please wait a moment before trying again.';

  toast({
    title: 'Rate Limit Exceeded',
    description: message,
    variant: 'destructive',
  });
};

/**
 * Authentication error handler
 */
export const handleAuthError = (): void => {
  toast({
    title: 'Authentication Required',
    description: 'Please log in again to continue.',
    variant: 'destructive',
  });
  
  // Redirect to login after a short delay
  setTimeout(() => {
    window.location.href = '/login';
  }, 2000);
};

/**
 * Permission error handler
 */
export const handlePermissionError = (): void => {
  toast({
    title: 'Access Denied',
    description: 'You do not have permission to perform this action.',
    variant: 'destructive',
  });
}; 
