export const DEFAULT_PAGE = '1';

export const EXAMPLE_ERA_SLUG = 'abbasi';
export const EXAMPLE_METER_SLUG = 'altawil';
export const EXAMPLE_POET_SLUG = 'abu-nawas';
export const EXAMPLE_POEM_SLUG = 'TnKK';
export const EXAMPLE_RHYME_SLUG = 'meem';
export const EXAMPLE_THEME_SLUG = 'alnasib';
export const EXAMPLE_COLLECTION_SLUG = 'almuallaqat';

export const inputValidationErrorMap = {
  INPUT_VALIDATION_FAILED: { status: 400, message: 'Input validation failed' },
} as const;

export const internalServerErrorMap = {
  INTERNAL_SERVER_ERROR: { status: 500, message: 'Internal server error' },
} as const;

export type ContractErrorCode =
  | keyof typeof inputValidationErrorMap
  | keyof typeof internalServerErrorMap
  | 'NOT_FOUND'
  | 'POEM_PARSE_ERROR';
