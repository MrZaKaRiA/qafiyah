import { describe, expect, it } from 'vitest';
import type { SearchClient } from './client';
import { searchPoems } from './search';

function clientReturning(response: unknown): SearchClient {
  return { search: async () => response } as unknown as SearchClient;
}

describe('searchPoems mapping', () => {
  it('maps meter.slug from _source instead of emitting an empty string', async () => {
    const client = clientReturning({
      hits: {
        total: { value: 1 },
        hits: [
          {
            _score: 3.2,
            _source: {
              slug: 'aBcd',
              titleDisplay: 'قصيدةٌ',
              content: 'بيتٌ أوّل*بيتٌ ثانٍ*بيتٌ ثالث',
              poetNameDisplay: 'المتنبّي',
              poetSlug: 'mutanabbi',
              eraName: 'عباسي',
              eraSlug: 'abbasid',
              meterName: 'الطويل',
              meterSlug: 'altawil',
            },
            highlight: { content: ['بيتٌ <mark>أوّل</mark>'] },
          },
        ],
      },
    });

    const page = (
      await searchPoems(client, {
        q: 'الحب',
        matchType: 'all',
        page: 1,
        poetSlugs: [],
        eraSlugs: [],
        meterSlugs: [],
        themeSlugs: [],
        rhymeSlugs: [],
        collectionSlugs: [],
      })
    )._unsafeUnwrap();

    expect(page.hits[0]?.meter).toEqual({ name: 'الطويل', slug: 'altawil' });
  });
});
