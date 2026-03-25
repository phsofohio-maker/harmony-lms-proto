import React from 'react';
import DOMPurify from 'dompurify';
import { cn } from '../../utils';

interface RichTextRendererProps {
  content: string;
  className?: string;
}

export const RichTextRenderer: React.FC<RichTextRendererProps> = ({
  content,
  className,
}) => {
  const sanitized = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'mark', 'code',
      'h2', 'h3', 'ul', 'ol', 'li', 'a', 'blockquote', 'hr',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'data-color', 'class'],
    ADD_ATTR: ['target'],
  });

  // If content has no HTML tags, wrap in <p> for consistent rendering
  const hasHtml = /<[a-z][\s\S]*>/i.test(content);
  const finalContent = hasHtml ? sanitized : `<p>${sanitized}</p>`;

  return (
    <div
      className={cn('tiptap-content', className)}
      dangerouslySetInnerHTML={{ __html: finalContent }}
    />
  );
};
