import type { HTMLAttributes } from 'vue';

export interface SeparatorProps extends /* @vue-ignore */ HTMLAttributes {
  /**
   * The orientation of the separator.
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical';
}

export interface SeparatorState {
  /** The orientation of the separator. */
  orientation: 'horizontal' | 'vertical';
}
