import { inject } from 'vue';
import type { ComputedRef, InjectionKey, Ref, ShallowRef } from 'vue';
import type { CompositeListContextValue } from '../../internals/composite/list/CompositeListContext';
import type { TextDirection } from '../../internals/direction-context/DirectionContext';
import type { REASONS } from '../../internals/reasons';
import type { Orientation } from '../../internals/types';
import type { Layout, PanelConstraints } from '../utils/layout';
import type {
  ResizableRootActions,
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
  collapsible: () => boolean;
  collapsedSize: () => number | string;
  collapseThreshold: () => number | string | undefined;
  disabled: () => boolean;
  element: Readonly<ShallowRef<HTMLElement | null>>;
  /**
   * Whether `KeepAlive` holds the panel. Such a panel is not in the layout.
   */
  deactivated: Readonly<Ref<boolean>>;
}

/**
 * A handle that moves a panel for a key or a double click.
 */
export interface ResizableHandleMove {
  /**
   * The index in `panels` of the panel before the handle.
   */
  pivot: number;
  reason: typeof REASONS.keyboard | 'reset';
  event: KeyboardEvent | MouseEvent;
}

/**
 * What `useParentRoot()` gives: the orientation and the methods of the nearest root.
 */
export interface ResizableParentRoot extends ResizableRootActions {
  orientation: ComputedRef<Orientation>;
}

export interface ResizableRootContext {
  orientation: ComputedRef<Orientation>;
  direction: ComputedRef<TextDirection>;
  /**
   * The composite list around the root. A panel gives it to its content, so that an item in the
   * panel joins that list and not the list of the panels.
   */
  outerList: CompositeListContextValue<any> | undefined;
  disabled: ComputedRef<boolean>;
  step: ComputedRef<number>;
  largeStep: ComputedRef<number>;
  pushPanels: ComputedRef<boolean>;
  /**
   * The panels in the order of the document, without a panel that `KeepAlive` holds.
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
  /**
   * Collapses the panel to its collapsed size, and commits the change. It does nothing for a panel
   * that is not collapsible or is collapsed. A handle (`by`) moves the panel for a key. With no
   * handle, the move is an action of the app.
   */
  collapsePanel: (id: string, by?: ResizableHandleMove) => void;
  /**
   * Gives a collapsed panel the size that it had before it collapsed, or its least size, and
   * commits the change. It does not collapse another panel, and it does nothing for a panel that
   * is not collapsed.
   */
  expandPanel: (id: string, by?: ResizableHandleMove) => void;
  /**
   * Gives the panel a size, and commits the change. It is an action of the app.
   */
  resizePanel: (id: string, size: number | string) => void;
  /**
   * Gives the panel the size that it has in the first layout, and commits the change. A double
   * click on a handle (`by`) does this. The result is `false` when the panel has that size already.
   */
  resetPanel: (id: string, by: ResizableHandleMove) => boolean;
  /**
   * What `useParentRoot()` gives to a part inside the root.
   */
  actions: ResizableParentRoot;
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
