import type { HTMLAttributes } from 'vue';
import type { AsProps } from '../common/element';

export interface SeparatorProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
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
