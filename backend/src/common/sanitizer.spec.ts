import { sanitizeText, SanitizeString } from './sanitizer';
import { Transform, plainToClass } from 'class-transformer';

describe('sanitizeText', () => {
  it('should remove script tags', () => {
    const maliciousInput = '<script>alert("XSS")</script>Hello World';
    const result = sanitizeText(maliciousInput);
    expect(result).toBe('Hello World');
  });

  it('should remove event handlers', () => {
    const maliciousInput = '<div onclick="alert(\'XSS\')">Click me</div>';
    const result = sanitizeText(maliciousInput);
    expect(result).toBe('Click me');
  });

  it('should remove javascript: protocols', () => {
    const maliciousInput = '<a href="javascript:alert(\'XSS\')">Click</a>';
    const result = sanitizeText(maliciousInput);
    expect(result).toBe('Click');
  });

  it('should remove iframe tags', () => {
    const maliciousInput = '<iframe src="evil.com"></iframe>Safe content';
    const result = sanitizeText(maliciousInput);
    expect(result).toBe('Safe content');
  });

  it('should remove style tags with malicious CSS', () => {
    const maliciousInput =
      '<style>body { background: url("javascript:alert(\'XSS\')"); }</style>Content';
    const result = sanitizeText(maliciousInput);
    expect(result).toBe('Content');
  });

  it('should handle complex nested attacks', () => {
    const maliciousInput =
      '<div><script>alert("XSS")</script><p onclick="malicious()">Text</p></div>';
    const result = sanitizeText(maliciousInput);
    expect(result).toBe('Text');
  });

  it('should preserve plain text', () => {
    const plainText =
      'This is just plain text with numbers 123 and symbols !@#';
    const result = sanitizeText(plainText);
    expect(result).toBe(plainText);
  });

  it('should handle null and undefined', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(undefined)).toBe('');
  });

  it('should trim whitespace', () => {
    const input = '  <b>Bold text</b>  ';
    const result = sanitizeText(input);
    expect(result).toBe('Bold text');
  });

  it('should handle common XSS payloads', () => {
    const payloads = [
      '<img src=x onerror=alert("XSS")>',
      '<svg onload=alert("XSS")>',
      '<input onfocus=alert("XSS") autofocus>',
      '<body onload=alert("XSS")>',
      '<marquee onstart=alert("XSS")>',
      '"><script>alert("XSS")</script>',
      '<script>alert(String.fromCharCode(88,83,83))</script>',
    ];

    payloads.forEach((payload) => {
      const result = sanitizeText(payload);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('javascript:');
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('onload');
      expect(result).not.toContain('onstart');
      expect(result).not.toContain('onfocus');
      // Only check for alert in contexts where it should be removed (inside HTML tags)
      if (payload.includes('<')) {
        expect(result).not.toMatch(/alert\s*\(/);
      }
    });
  });
});

describe('SanitizeString decorator', () => {
  class TestDto {
    @SanitizeString()
    content: string;

    @SanitizeString()
    title: string;
  }

  it('should sanitize string properties when transforming', () => {
    const maliciousData = {
      content: '<script>alert("XSS")</script>Safe content',
      title: '<img src=x onerror=alert("XSS")>Clean title',
    };

    const transformed = plainToClass(TestDto, maliciousData);

    expect(transformed.content).toBe('Safe content');
    expect(transformed.title).toBe('Clean title');
  });

  it('should not affect non-string values', () => {
    const data = {
      content: 123,
      title: null,
    };

    const transformed = plainToClass(TestDto, data);

    expect(transformed.content).toBe(123);
    expect(transformed.title).toBe(null);
  });
});
