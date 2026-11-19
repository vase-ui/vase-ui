export interface FieldsetRootProps {
  disabled?: boolean;
}

export interface FieldsetRootState {
  /** By the `disabled` prop, or by a disabled fieldset around the root. */
  disabled: boolean;
}

export interface FieldsetLegendProps {
  id?: string;
}
