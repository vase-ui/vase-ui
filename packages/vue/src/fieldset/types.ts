import type { FieldsetHTMLAttributes, HTMLAttributes } from 'vue';
import type { AsProps } from '../common/element';
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

export interface FieldsetLegendProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  id?: string;
}
