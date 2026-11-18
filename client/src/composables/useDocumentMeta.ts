import { onBeforeUnmount, watchEffect, type ComputedRef } from 'vue';

export interface DocumentMetaOptions {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  ogType?: string;
  ogImage?: string | null;
  jsonLd?: Record<string, unknown> | null;
}

const DEFAULT_TITLE = 'EZ Vibes Concerts';
const JSON_LD_SCRIPT_ID = 'nido-event-jsonld';

function upsertMetaTag(
  attribute: 'name' | 'property',
  key: string,
  content?: string | null,
) {
  if (typeof document === 'undefined') return;
  const selector = `meta[${attribute}="${key}"]`;
  const existing = document.head.querySelector<HTMLMetaElement>(selector);

  if (!content) {
    existing?.remove();
    return;
  }

  const el = existing ?? document.createElement('meta');
  el.setAttribute(attribute, key);
  el.setAttribute('content', content);
  if (!existing) {
    document.head.appendChild(el);
  }
}

function upsertCanonicalLink(href?: string | null) {
  if (typeof document === 'undefined') return;
  const existing = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  );

  if (!href) {
    existing?.remove();
    return;
  }

  const el = existing ?? document.createElement('link');
  el.setAttribute('rel', 'canonical');
  el.setAttribute('href', href);
  if (!existing) {
    document.head.appendChild(el);
  }
}

function upsertJsonLdScript(payload?: Record<string, unknown> | null) {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById(JSON_LD_SCRIPT_ID);

  if (!payload) {
    existing?.remove();
    return;
  }

  const script =
    (existing as HTMLScriptElement | null) ?? document.createElement('script');
  script.id = JSON_LD_SCRIPT_ID;
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(payload);
  if (!existing) {
    document.head.appendChild(script);
  }
}

export function useDocumentMeta(
  source: ComputedRef<DocumentMetaOptions> | (() => DocumentMetaOptions),
) {
  const resolveOptions = () =>
    typeof source === 'function' ? source() : source.value;

  watchEffect(() => {
    if (typeof document === 'undefined') return;
    const meta = resolveOptions();
    const title = meta.title?.trim() || DEFAULT_TITLE;
    document.title = title;

    upsertMetaTag('name', 'description', meta.description);
    upsertCanonicalLink(meta.canonicalUrl);
    upsertMetaTag('property', 'og:title', title);
    upsertMetaTag('property', 'og:description', meta.description);
    upsertMetaTag('property', 'og:url', meta.canonicalUrl);
    upsertMetaTag('property', 'og:type', meta.ogType || 'website');
    upsertMetaTag('property', 'og:image', meta.ogImage);
    upsertJsonLdScript(meta.jsonLd);
  });

  onBeforeUnmount(() => {
    if (typeof document === 'undefined') return;
    document.title = DEFAULT_TITLE;
    upsertJsonLdScript(null);
  });
}
