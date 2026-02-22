/**
 * Production utilities for Wolf Street
 * Ensures clean, optimized behavior in production environment
 */

export const isDevelopment = import.meta.env.DEV;
export const isProduction = import.meta.env.PROD;

/**
 * Conditional logging - only logs in development
 */
export const devLog = (...args: any[]) => {
  if (isDevelopment) {
    console.log(...args);
  }
};

/**
 * Conditional warn - only warns in development
 */
export const devWarn = (...args: any[]) => {
  if (isDevelopment) {
    console.warn(...args);
  }
};

/**
 * Conditional error - always logs errors
 */
export const devError = (...args: any[]) => {
  console.error(...args);
};

/**
 * Performance measurement wrapper
 */
export const measurePerformance = async <T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> => {
  if (isDevelopment) {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    console.log(`⏱️ ${label}: ${(end - start).toFixed(2)}ms`);
    return result;
  }
  return fn();
};

/**
 * Sanitize user input for display
 */
export const sanitizeInput = (input: string): string => {
  return input.replace(/[<>]/g, '');
};

/**
 * Format error message for user display
 */
export const formatErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred. Please try again.';
};
