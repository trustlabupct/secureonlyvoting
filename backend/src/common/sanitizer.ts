import * as sanitizeHtml from 'sanitize-html';
import { Transform } from 'class-transformer';

/**
 * Sanitizes a string to remove all HTML tags and attributes, leaving only plain text content.
 * Also trims leading/trailing whitespace.
 *
 * @param input The potentially unsafe string input.
 * @returns The sanitized plain text string, or an empty string if input is null/undefined.
 */
export function sanitizeText(input: string | null | undefined): string {
  if (!input) {
    return '';
  }

  const sanitized = sanitizeHtml(input, {
    allowedTags: [], // No tags allowed
    allowedAttributes: {}, // No attributes allowed
    // Disallow common attack vectors explicitly (though allowedTags: [] should cover most)
    disallowedTagsMode: 'discard',
    allowProtocolRelative: false,
    enforceHtmlBoundary: true,
    // Add other options as needed, e.g., handling specific entities
  });

  // Trim whitespace after sanitization
  return sanitized.trim();
}

/**
 * Class-transformer decorator that automatically sanitizes string values
 * Use this decorator on DTO properties to automatically sanitize incoming data
 */
export function SanitizeString() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      return sanitizeText(value);
    }
    return value;
  });
}
