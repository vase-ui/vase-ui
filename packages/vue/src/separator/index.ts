import SeparatorComponent from './Separator.vue';
import type { SeparatorProps, SeparatorState } from './Separator.vue';

/**
 * A separator element accessible to screen readers.
 * Renders a `<div>` element.
 */
export const Separator: typeof SeparatorComponent = SeparatorComponent;
export namespace Separator {
  export type Props = SeparatorProps;
  export type State = SeparatorState;
}

export type * from './Separator.vue';

export * as SeparatorDataAttributes from './SeparatorDataAttributes';
