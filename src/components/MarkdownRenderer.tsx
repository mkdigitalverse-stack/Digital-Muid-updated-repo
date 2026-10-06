import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Safely parses and renders Markdown text into semantic HTML React elements.
 * Supports H1-H4, blockquotes, lists, links, bold, italics, inline code,
 * fenced code blocks, and horizontal dividers without any unsafe innerHTML.
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  if (!content) return null;

  // Helper to parse inline styles (bold, italic, inline code, links)
  const parseInline = (text: string): React.ReactNode[] => {
    // Regex matching:
    // 1. Links: [text](url)
    // 2. Bold: **text** or __text__
    // 3. Italic: *text* or _text_
    // 4. Inline code: `text`
    const tokens: React.ReactNode[] = [];
    let remaining = text;
    let keyIdx = 0;

    while (remaining.length > 0) {
      // Find the earliest match among the token types
      const linkMatch = remaining.match(/\[(.*?)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/);
      const boldMatch = remaining.match(/(\*\*|__)(.*?)\1/);
      const italicMatch = remaining.match(/(\*|_)(.*?)\1/);
      const codeMatch = remaining.match(/`([^`]+)`/);

      const matches = [
        linkMatch ? { type: 'link', match: linkMatch, index: linkMatch.index! } : null,
        boldMatch ? { type: 'bold', match: boldMatch, index: boldMatch.index! } : null,
        italicMatch ? { type: 'italic', match: italicMatch, index: italicMatch.index! } : null,
        codeMatch ? { type: 'code', match: codeMatch, index: codeMatch.index! } : null,
      ].filter((m): m is { type: string; match: RegExpMatchArray; index: number } => m !== null);

      if (matches.length === 0) {
        tokens.push(remaining);
        break;
      }

      // Sort by earliest appearance in string
      matches.sort((a, b) => a.index - b.index);
      const first = matches[0];

      // Add preceding plain text
      if (first.index > 0) {
        tokens.push(remaining.substring(0, first.index));
      }

      // Add formatted element
      if (first.type === 'link') {
        const linkText = first.match[1];
        const linkUrl = first.match[2];
        const isExternal = linkUrl.startsWith('http');
        tokens.push(
          <a
            key={`link-${keyIdx++}`}
            href={linkUrl}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noopener noreferrer' : undefined}
            className="text-[#1877F2] hover:text-[#2563EB] font-medium underline underline-offset-2 transition-colors"
          >
            {linkText || linkUrl}
          </a>
        );
      } else if (first.type === 'bold') {
        tokens.push(
          <strong key={`bold-${keyIdx++}`} className="font-bold text-slate-900 dark:text-white">
            {first.match[2]}
          </strong>
        );
      } else if (first.type === 'italic') {
        tokens.push(
          <em key={`italic-${keyIdx++}`} className="italic">
            {first.match[2]}
          </em>
        );
      } else if (first.type === 'code') {
        tokens.push(
          <code
            key={`code-${keyIdx++}`}
            className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-xs border border-slate-200 dark:border-slate-700"
          >
            {first.match[1]}
          </code>
        );
      }

      remaining = remaining.substring(first.index + first.match[0].length);
    }

    return tokens;
  };

  // Split into block chunks by double newlines or code fences
  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Skip empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // 2. Fenced Code Block: ```
    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      const lang = trimmed.replace('```', '').trim();
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Skip closing ```
      blocks.push(
        <div key={`codeblock-${i}`} className="my-5 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 text-slate-200 shadow-md">
          {lang && (
            <div className="px-4 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              {lang}
            </div>
          )}
          <pre className="p-4 overflow-x-auto text-xs sm:text-sm font-mono leading-relaxed">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      continue;
    }

    // 3. Headings
    if (trimmed.startsWith('#### ')) {
      blocks.push(
        <h4 key={`h4-${i}`} className="text-base sm:text-lg font-display font-bold text-slate-900 dark:text-white pt-4 pb-1">
          {parseInline(trimmed.replace('#### ', ''))}
        </h4>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('### ')) {
      blocks.push(
        <h3 key={`h3-${i}`} className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white pt-6 pb-2 border-b border-slate-100 dark:border-slate-800">
          {parseInline(trimmed.replace('### ', ''))}
        </h3>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      blocks.push(
        <h2 key={`h2-${i}`} className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white pt-8 pb-2.5 border-b border-slate-200 dark:border-slate-800">
          {parseInline(trimmed.replace('## ', ''))}
        </h2>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('# ')) {
      blocks.push(
        <h1 key={`h1-${i}`} className="text-3xl sm:text-4xl font-display font-bold text-slate-900 dark:text-white pt-8 pb-3">
          {parseInline(trimmed.replace('# ', ''))}
        </h1>
      );
      i++;
      continue;
    }

    // 4. Horizontal Divider: --- or ***
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      blocks.push(
        <hr key={`hr-${i}`} className="my-8 border-t border-slate-200 dark:border-slate-800" />
      );
      i++;
      continue;
    }

    // 5. Blockquote: >
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s*/, ''));
        i++;
      }
      blocks.push(
        <blockquote
          key={`quote-${i}`}
          className="my-5 pl-4 sm:pl-6 py-2 border-l-4 border-[#1877F2] bg-blue-50/50 dark:bg-blue-950/20 rounded-r-xl italic text-slate-700 dark:text-slate-300 text-sm sm:text-base leading-relaxed"
        >
          {quoteLines.map((ql, qIdx) => (
            <p key={qIdx} className="my-1">
              {parseInline(ql)}
            </p>
          ))}
        </blockquote>
      );
      continue;
    }

    // 6. Unordered List: - or *
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const listItems: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
        listItems.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="my-4 pl-6 list-disc space-y-2 text-slate-700 dark:text-slate-300 text-sm sm:text-base leading-relaxed marker:text-[#1877F2]">
          {listItems.map((item, itemIdx) => (
            <li key={itemIdx}>{parseInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // 7. Ordered List: 1. 2. etc
    if (/^\d+\.\s+/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="my-4 pl-6 list-decimal space-y-2 text-slate-700 dark:text-slate-300 text-sm sm:text-base leading-relaxed marker:font-bold marker:text-[#1877F2]">
          {listItems.map((item, itemIdx) => (
            <li key={itemIdx}>{parseInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // 8. Regular Paragraph
    // Accumulate consecutive lines that belong to this paragraph
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('>') &&
      !lines[i].trim().startsWith('- ') &&
      !lines[i].trim().startsWith('* ') &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      lines[i].trim() !== '---' &&
      lines[i].trim() !== '***'
    ) {
      paraLines.push(lines[i]);
      i++;
    }

    blocks.push(
      <p key={`p-${i}`} className="my-4 text-slate-700 dark:text-slate-300 text-sm sm:text-base leading-relaxed font-interface">
        {parseInline(paraLines.join(' '))}
      </p>
    );
  }

  return <div className={`space-y-2 ${className}`}>{blocks}</div>;
};
