import { inject } from 'vue';
import type { ComputedRef, InjectionKey, Ref, ShallowRef } from 'vue';
import type { CompositeListContextValue } from '../../internals/composite/list/CompositeListContext';
import type { TextDirection } from '../../internals/direction-context/DirectionContext';
import type { REASONS } from '../../internals/reasons';
import type { Orientation } from '../../internals/types';
import type { Layout, PanelConstraints } from '../utils/layout';
import type { RootMeasurement } from '../utils/measure';
import type {
  ResizableRootActions,
  ResizableRootChangeEventDetails,
  ResizableRootCommitEventReason,
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
   * Each size is a number, or a string of a number with an optional unit.
   */
  minSize: () => number | string;
  maxSize: () => number | string;
  defaultSize: number | string | undefined;
  collapsible: () => boolean;
  collapsedSize: () => number | string;
  collapseThreshold: () => number | string | undefined;
  disabled: () => boolean;
  rootResizeBehavior: () => 'proportional' | 'fixed';
  rootResizePriority: () => number;
  snapPoints: () => readonly (number | string)[] | undefined;
  snapTolerance: () => number | string;
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
   * The list of the panels and the handles. They register with it through this context. The root
   * does not provide the list, so an item of a composite around the root joins that composite.
   */
  list: CompositeListContextValue<{ id?: string }>;
  disabled: ComputedRef<boolean>;
  /**
   * The sizes that a key and a drag move by, in percent of the panel space. `dragStep` is
   * `undefined` when the root has no drag step.
   */
  step: ComputedRef<number>;
  largeStep: ComputedRef<number>;
  dragStep: ComputedRef<number | undefined>;
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
   * The panels whose first size is a length that the root cannot change into percent yet, with that
   * length, by panel id. It is empty from the first measurement on.
   */
  lengthPanels: ComputedRef<ReadonlyMap<string, string>>;
  /**
   * What the root read from the page at the last measurement. It is `undefined` while the root has
   * had no room for its panels.
   */
  measurement: Readonly<ShallowRef<RootMeasurement | undefined>>;
  /**
   * Adds a panel to the root until the scope of the caller ends. Call it in `setup`.
   */
  registerPanel: (panel: ResizablePanelRegistration) => void;
  /**
   * Reads the page again, before a drag, a key or a method. It gives the new measurement, or
   * `undefined` when the root has no room for its panels.
   */
  measure: () => RootMeasurement | undefined;
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
  /**
   * Emits that the user ended a change of the layout. The snapshot of the event has the pixels of
   * each fixed panel.
   */
  commitLayout: (layout: Layout, reason: ResizableRootCommitEventReason, event?: Event) => void;
  /**
   * Collapses the panel to its collapsed size, and commits the change. It does nothing for a panel
   * that is not collapsible or is collapsed. A handle (`handleMove`) moves the panel for a key.
   * With no handle, the move is an action of the app.
   */
  collapsePanel: (id: string, handleMove?: ResizableHandleMove) => void;
  /**
   * Gives a collapsed panel the size that it had before it collapsed, or its least size, and
   * commits the change. It does not collapse another panel, and it does nothing for a panel that
   * is not collapsed.
   */
  expandPanel: (id: string, handleMove?: ResizableHandleMove) => void;
  /**
   * Gives the panel a size, and commits the change. It is an action of the app.
   */
  resizePanel: (id: string, size: number | string) => void;
  /**
   * Gives the panel the size that it has in the first layout, and commits the change. A double
   * click on a handle (`handleMove`) does this. The result is `false` when the panel has that
   * size already.
   */
  resetPanel: (id: string, handleMove: ResizableHandleMove) => boolean;
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
