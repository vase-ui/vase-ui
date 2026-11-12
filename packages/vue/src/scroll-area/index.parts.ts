import ScrollAreaRoot from './root/ScrollAreaRoot.vue';
import type { ScrollAreaRootProps, ScrollAreaRootState } from './root/ScrollAreaRoot.vue';

/**
 * Groups all parts of the scroll area.
 * Renders a `<div>` element.
 */
export const Root: typeof ScrollAreaRoot = ScrollAreaRoot;
export namespace Root {
  export type Props = ScrollAreaRootProps;
  export type State = ScrollAreaRootState;
}
