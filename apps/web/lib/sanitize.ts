import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitises user-authored HTML before it is rendered via dangerouslySetInnerHTML
 * (campaign bodies, rich-text notes, form-builder previews). Allow-list driven:
 * strips <script>, event handlers (onerror=…), javascript: URIs, etc.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty ?? '', {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      'a',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'img',
      'blockquote',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}
