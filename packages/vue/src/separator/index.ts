import SeparatorComponent from './Separator.vue';

/**
 * A separator element accessible to screen readers.
 * Renders a `<div>` element.
 */
export const Separator: typeof SeparatorComponent = SeparatorComponent;

export type { SeparatorProps, SeparatorState } from './types';
