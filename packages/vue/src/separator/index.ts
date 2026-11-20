import SeparatorComponent from './Separator.vue';
import type { SeparatorProps, SeparatorState } from './types';

/**
 * A separator element accessible to screen readers.
 * Renders a `<div>` element.
 * @selector `[aria-orientation="vertical"]` The separator is vertical.
 */
export const Separator: typeof SeparatorComponent = SeparatorComponent;
export namespace Separator {
  export type Props = SeparatorProps;
  export type State = SeparatorState;
}

export type { SeparatorProps, SeparatorState };
