import { formatNewsletterMarkdownToHtml } from './newsletter-html-formatter.util';

describe('formatNewsletterMarkdownToHtml', () => {
  it('returns an empty string for blank input', () => {
    expect(formatNewsletterMarkdownToHtml('')).toBe('');
    expect(formatNewsletterMarkdownToHtml('   ')).toBe('');
  });

  it('preserves input that is already full HTML', () => {
    const rawHtml = '<div class="ez-vibes-newsletter"><h1>Custom</h1></div>';
    expect(formatNewsletterMarkdownToHtml(rawHtml)).toBe(rawHtml);
  });

  it('renders h1, h2, h3, and h4 with brand styling and tokens', () => {
    const markdown = `# EZ Vibes Weekly Top Picks: Nov 10 - 15, 2026\n## The Highlights\n### Featured Show\n#### 1. Quick Hits`;
    const html = formatNewsletterMarkdownToHtml(markdown);

    expect(html).toContain('<h1 style="font-family: -apple-system, BlinkMacSystemFont');
    expect(html).toContain('EZ Vibes Weekly Top Picks: Nov 10 - 15, 2026</h1>');
    expect(html).toContain('border-bottom: 2px solid #80E0A0');
    expect(html).toContain('The Highlights</h2>');
    expect(html).toContain('color: #15803d');
    expect(html).toContain('Featured Show</h3>');
    expect(html).toContain('Quick Hits</h4>');
  });

  it('styles regular links with #15803d and #80E0A0 underline', () => {
    const markdown = `Check out [Dr. Bacon](https://pourhouse.com/dr-bacon) at the Pour House!`;
    const html = formatNewsletterMarkdownToHtml(markdown);

    expect(html).toContain('href="https://pourhouse.com/dr-bacon"');
    expect(html).toContain('color: #15803d');
    expect(html).toContain('text-decoration-color: #80E0A0');
    expect(html).toContain('Dr. Bacon</a>');
  });

  it('renders CTA button links with green pill button styling', () => {
    const markdown = `[Get Tix](https://tickets.example.com/show1)\n[Get More Info](https://festival.example.com)`;
    const html = formatNewsletterMarkdownToHtml(markdown);

    expect(html).toContain('background-color: #80E0A0');
    expect(html).toContain('color: #064e3b');
    expect(html).toContain('Get Tix ↗</a>');
    expect(html).toContain('Get More Info ↗</a>');
  });

  it('formats unordered lists with clean padding and bullets', () => {
    const markdown = `- 👑 **EZ Vibes Update:** Soulful vibes\n- 🐸 **Featured Show:** Big show\n- ✅ **Top Picks:** Great lineup`;
    const html = formatNewsletterMarkdownToHtml(markdown);

    expect(html).toContain('<ul style="margin: 12px 0;');
    expect(html).toContain('<li style="margin-bottom: 6px;">👑 <strong>EZ Vibes Update:</strong> Soulful vibes</li>');
    expect(html).toContain('<li style="margin-bottom: 6px;">🐸 <strong>Featured Show:</strong> Big show</li>');
    expect(html).toContain('<li style="margin-bottom: 6px;">✅ <strong>Top Picks:</strong> Great lineup</li>');
  });

  it('formats blockquotes with #80E0A0 left border accent', () => {
    const markdown = `> **Join the Squad:** Jump into the Discord.`;
    const html = formatNewsletterMarkdownToHtml(markdown);

    expect(html).toContain('<blockquote style="margin: 16px 0;');
    expect(html).toContain('border-left: 4px solid #80E0A0');
    expect(html).toContain('<strong>Join the Squad:</strong> Jump into the Discord.</blockquote>');
  });

  it('formats horizontal rules cleanly', () => {
    const markdown = `Section 1\n\n---\n\nSection 2`;
    const html = formatNewsletterMarkdownToHtml(markdown);

    expect(html).toContain('<hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;" />');
  });
});
