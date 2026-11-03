/**
 * EZ Vibes Newsletter HTML Formatter
 *
 * Formats curated markdown copy into email-safe HTML adhering to the
 * production 7-section design system and brand palette:
 * - Brand Accent: #80E0A0 (Soft Green)
 * - Brand Primary: #9DFF99 (Lime Light Green)
 * - Deep Text Accent: #15803d
 * - Neutral Body: #1f2937 on #ffffff
 */

export interface NewsletterFormatterOptions {
  includeWrapper?: boolean;
}

export function formatNewsletterMarkdownToHtml(
  markdown: string,
  options: NewsletterFormatterOptions = {},
): string {
  if (!markdown || !markdown.trim()) {
    return '';
  }

  const trimmed = markdown.trim();

  // If already full HTML document, preserve it
  if (
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    trimmed.includes('class="ez-vibes-newsletter"')
  ) {
    return trimmed;
  }

  // Pre-process: normalize line endings
  let text = trimmed.replace(/\r\n/g, '\n');

  // Convert markdown links: [**Text**](url) or [Text](url)
  // Handles button CTAs specially (e.g. "Get Tix", "Get More Info", "Get Tickets")
  text = text.replace(/\[\*\*(.*?)\*\*\]\((.*?)\)/g, '[$1]($2)');
  text = text.replace(/\[(.*?)\]\((.*?)\)/g, (_match, linkText, url) => {
    const cleanUrl = url.trim();
    const cleanText = linkText.trim();
    const isButton =
      /get\s*tix|get\s*tickets|get\s*more\s*info|buy\s*tickets|join\s*the\s*squad/i.test(
        cleanText,
      );

    if (isButton) {
      return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #80E0A0; color: #064e3b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 700; text-decoration: none; padding: 10px 18px; border-radius: 6px; margin: 8px 0; text-transform: uppercase; letter-spacing: 0.5px;">${cleanText} ↗</a>`;
    }

    return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" style="color: #15803d; font-weight: 700; text-decoration: underline; text-decoration-color: #80E0A0; text-underline-offset: 3px;">${cleanText}</a>`;
  });

  // Split into sections by top-level or level 4 headings (e.g. "#### 1. Quick Hits", "#### 2. The EZ Vibes Update")
  const lines = text.split('\n');
  const renderedBlocks: string[] = [];

  let inList = false;
  let listItems: string[] = [];

  const flushList = () => {
    if (inList && listItems.length > 0) {
      renderedBlocks.push(
        `<ul style="margin: 12px 0; padding-left: 20px; line-height: 1.6; color: #1f2937;">\n` +
          listItems.map((item) => `  <li style="margin-bottom: 6px;">${item}</li>`).join('\n') +
          `\n</ul>`,
      );
      listItems = [];
      inList = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine ? rawLine.trim() : '';

    if (!line) {
      flushList();
      continue;
    }

    // Unordered List Items
    if (/^[-*]\s+/.test(line)) {
      inList = true;
      const content = line.replace(/^[-*]\s+/, '');
      listItems.push(formatInlineMarkdown(content));
      continue;
    } else {
      flushList();
    }

    // Horizontal Rule
    if (/^---$|^\*\*\*$|^___$/.test(line)) {
      renderedBlocks.push(
        `<hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;" />`,
      );
      continue;
    }

    // Blockquote
    if (/^>\s+/.test(line)) {
      const quote = line.replace(/^>\s+/, '');
      renderedBlocks.push(
        `<blockquote style="margin: 16px 0; padding: 12px 18px; border-left: 4px solid #80E0A0; background-color: #f9fafb; color: #374151; font-style: italic; border-radius: 0 6px 6px 0;">${formatInlineMarkdown(quote)}</blockquote>`,
      );
      continue;
    }

    // Headings
    if (/^#\s+/.test(line)) {
      const heading = line.replace(/^#\s+/, '');
      renderedBlocks.push(
        `<h1 style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 26px; line-height: 1.25; font-weight: 800; color: #111827; margin: 24px 0 16px 0;">${formatInlineMarkdown(heading)}</h1>`,
      );
      continue;
    }

    if (/^##\s+/.test(line)) {
      const heading = line.replace(/^##\s+/, '');
      renderedBlocks.push(
        `<h2 style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 20px; line-height: 1.35; font-weight: 700; color: #111827; margin: 24px 0 12px 0; border-bottom: 2px solid #80E0A0; padding-bottom: 6px;">${formatInlineMarkdown(heading)}</h2>`,
      );
      continue;
    }

    if (/^###\s+/.test(line)) {
      const heading = line.replace(/^###\s+/, '');
      renderedBlocks.push(
        `<h3 style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 17px; line-height: 1.4; font-weight: 700; color: #15803d; margin: 18px 0 8px 0;">${formatInlineMarkdown(heading)}</h3>`,
      );
      continue;
    }

    if (/^####\s+/.test(line)) {
      const heading = line.replace(/^####\s+/, '');
      renderedBlocks.push(
        `<h4 style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.4; font-weight: 700; color: #111827; margin: 16px 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px;">${formatInlineMarkdown(heading)}</h4>`,
      );
      continue;
    }

    // Regular Paragraph
    renderedBlocks.push(
      `<p style="margin: 12px 0; line-height: 1.6; font-size: 15px; color: #1f2937;">${formatInlineMarkdown(line)}</p>`,
    );
  }

  flushList();

  const bodyHtml = renderedBlocks.join('\n');

  // Wrap in email container
  return `<div class="ez-vibes-newsletter" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #1f2937; line-height: 1.6;">
${bodyHtml}
</div>`;
}

function formatInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background: #f3f4f6; padding: 2px 5px; border-radius: 4px; font-size: 0.9em;">$1</code>');
}
