import type { FieldsetHTMLAttributes, HTMLAttributes } from 'vue';
export interface FieldsetRootProps extends /* @vue-ignore */ Omit<
  FieldsetHTMLAttributes,
  'disabled'
> {
  disabled?: boolean;
}

export interface FieldsetRootState {
  /** By the `disabled` prop, or by a disabled fieldset around the root. */
  disabled: boolean;
}

export interface FieldsetLegendProps extends /* @vue-ignore */ Omit<HTMLAttributes, 'id'> {
  id?: string;
}
