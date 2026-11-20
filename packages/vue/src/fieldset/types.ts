import type { FieldsetHTMLAttributes, HTMLAttributes } from 'vue';
import type { AsProps } from '../common/element';
export interface FieldsetRootProps extends /* @vue-ignore */ Omit<
  FieldsetHTMLAttributes,
  'disabled'
> {
  /**
   * Disables each form control in the fieldset and each part that renders a native button, as
   * their `disabled` prop does. A control in the first `<legend>` child of the `<fieldset>` stays
   * enabled, as in HTML. A native `<fieldset disabled>` has the same effect.
   * @default false
   */
  disabled?: boolean;
}

export interface FieldsetRootState {
  /** By the `disabled` prop, or by a disabled fieldset around the root. */
  disabled: boolean;
}

export interface FieldsetLegendProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  /** The `id` of the legend. With no `id`, the legend has an id of its own. */
  id?: string;
}
