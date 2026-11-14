import { inject } from 'vue';
import type { ComputedRef, InjectionKey, ShallowRef } from 'vue';
import type { TextDirection } from '../../internals/direction-context/DirectionContext';
import type { Orientation } from '../../internals/types';
import type { Layout, PanelConstraints } from '../utils/layout';
import type {
  ResizableRootChangeEventDetails,
  ResizableRootCommitEventDetails,
} from './ResizableRoot.vue';

export interface ResizablePanelRegistration {
  /**
   * The id of the panel element and the key of the panel in the layout.
   */
  id: ComputedRef<string>;
  /**
   * The position of the panel among the panels and the handles of the root.
   */
  index: ComputedRef<number>;
  /**
   * Each size is a number, or a string of a number with an optional `%`.
   */
  minSize: () => number | string;
  maxSize: () => number | string;
  defaultSize: number | string | undefined;
  element: Readonly<ShallowRef<HTMLElement | null>>;
}

export interface ResizableRootContext {
  orientation: ComputedRef<Orientation>;
  direction: ComputedRef<TextDirection>;
  disabled: ComputedRef<boolean>;
  step: ComputedRef<number>;
  largeStep: ComputedRef<number>;
  /**
   * The panels in the order of the document.
   */
  panels: ComputedRef<readonly ResizablePanelRegistration[]>;
  /**
   * The constraints of `panels`, in the same order.
   */
  constraints: ComputedRef<readonly PanelConstraints[]>;
  /**
   * The size of each panel, in percent of the panel space.
   */
  shown: ComputedRef<Layout>;
  /**
   * Adds a panel to the root until the scope of the caller ends. Call it in `setup`.
   */
  registerPanel: (panel: ResizablePanelRegistration) => void;
  /**
   * The room that the panels share on the screen, in pixels: the sum of the content boxes of the
   * panel elements.
   */
  getPanelSpace: () => number;
  /**
   * Starts a drag. It returns `false` while another drag of the root runs.
   */
  startDragging: () => boolean;
  stopDragging: () => void;
  /**
   * Gives `layout` to the root: it emits the change, and it keeps the layout unless a listener
   * cancels the change. The result is the layout that the root emitted, or `undefined` when a
   * listener canceled the change.
   */
  changeLayout: (layout: Layout, details: ResizableRootChangeEventDetails) => Layout | undefined;
  commitLayout: (layout: Layout, details: ResizableRootCommitEventDetails) => void;
}

export const ResizableRootContext: InjectionKey<ResizableRootContext> = Symbol();

export function useResizableRootContext(): ResizableRootContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(ResizableRootContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of Resizable must be inside <Resizable.Root>. Without a root the part has no layout to read and no layout to change. Put the part inside <Resizable.Root>.',
    );
  }

  return context;
}
