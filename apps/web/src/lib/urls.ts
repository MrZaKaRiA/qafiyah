import { CAT_POET_PREFIX_REGEX } from '@/constants';

export type TaxonomySection = 'meters' | 'rhymes' | 'themes' | 'collections';

export function normalizePoetSlug(slug: string): string {
  return String(slug).toLowerCase().replace(CAT_POET_PREFIX_REGEX, '');
}

function withPage(path: string, page?: number): string {
  return page && page > 1 ? `${path}?page=${page}` : path;
}

export function taxonomyIndexUrl(section: TaxonomySection): string {
  return `/${section}`;
}

export function taxonomyUrl(section: TaxonomySection, slug: string, page?: number): string {
  return withPage(`/${section}/${slug}`, page);
}

export function poetsUrl(opts?: {
  page?: number | undefined;
  era?: string | undefined;
  q?: string | undefined;
}): string {
  const params = new URLSearchParams();
  if (opts?.era) params.set('era', opts.era);
  if (opts?.q) params.set('q', opts.q);
  if (opts?.page && opts.page > 1) params.set('page', String(opts.page));
  const query = params.toString();
  return query ? `/poets?${query}` : '/poets';
}

export function poetUrl(slug: string, page?: number): string {
  return withPage(`/poets/${normalizePoetSlug(slug)}`, page);
}

export function poemUrl(slug: string): string {
  return `/poems/${slug}`;
}
