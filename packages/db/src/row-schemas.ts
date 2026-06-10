import type { MeterSlug, PoemSlug, PoetSlug } from '@qafiyah/contracts';
import { meterSlugSchema, poemSlugSchema, poetSlugSchema } from '@qafiyah/contracts';
import * as v from 'valibot';

export const rawPoemRowSchema = v.object({
  title: v.string(),
  slug: poemSlugSchema,
  poet_name: v.string(),
  poet_slug: poetSlugSchema,
  meter_name: v.string(),
  meter_slug: meterSlugSchema,
});

export type PoemListRow = {
  readonly title: string;
  readonly slug: PoemSlug;
  readonly poetName: string;
  readonly poetSlug: PoetSlug;
  readonly meterName: string;
  readonly meterSlug: MeterSlug;
};
