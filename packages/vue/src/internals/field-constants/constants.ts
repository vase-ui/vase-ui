import type { FieldRootState } from '../../field/types';

export const DEFAULT_FIELD_STATE_ATTRIBUTES: Pick<
  FieldRootState,
  'valid' | 'touched' | 'dirty' | 'filled'
> = {
  valid: null,
  touched: false,
  dirty: false,
  filled: false,
};

export const DEFAULT_FIELD_ROOT_STATE: FieldRootState = {
  disabled: false,
  ...DEFAULT_FIELD_STATE_ATTRIBUTES,
};

export const fieldValidityMapping = {
  valid(value: boolean | null): Record<string, string> | null {
    if (value === null) {
      return null;
    }
    if (value) {
      return { 'data-valid': '' };
    }
    return { 'data-invalid': '' };
  },
};
