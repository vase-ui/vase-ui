import { inject, type InjectionKey } from 'vue';
import { createError } from '../common/createError';
import type { Layout, PanelConstraints } from './layout';
import type { RootMeasurement } from './measure';
import type {
  ResizableLayout,
  ResizableRootChangeEventDetails,
  ResizableRootChangeEventReason,
  ResizableRootResizeMode,
} from './types';

export type Size = number | string;

/** A panel of a root. The properties are reactive. */
export interface RootPanel {
  readonly id: string;
  readonly element: HTMLElement | null;
  readonly minSize: Size;
  readonly maxSize: Size;
  /** The `defaultSize` at the setup of the panel. */
  readonly defaultSize: Size | undefined;
  readonly collapsible: boolean;
  readonly collapsedSize: Size;
  readonly collapseThreshold: Size | undefined;
  readonly disabled: boolean;
  readonly rootResizeBehavior: 'proportional' | 'fixed';
  readonly rootResizePriority: number;
  readonly snapPoints: readonly Size[] | undefined;
  readonly snapTolerance: Size;
}

/** A handle of a root. The property is reactive. */
export interface RootHandle {
  readonly element: HTMLElement | null;
}

/** A move of a handle for a key or a double click. */
export interface HandleMove {
  /** The index in `panels` of the panel before the handle. */
  pivot: number;
  reason: Exclude<ResizableRootChangeEventReason, 'drag'>;
  event: Event;
}

/** What a root gives to its panels and handles. The properties are reactive. */
export interface ResizableRootForParts {
  readonly orientation: 'horizontal' | 'vertical';
  readonly disabled: boolean;
  /** The root is mounted. Until then, a part renders what it knows alone. */
  readonly mounted: boolean;
  /** The steps in percent of the panel space. */
  readonly step: number;
  readonly largeStep: number;
  readonly dragStep: number | undefined;
  readonly pushPanels: boolean;
  readonly resizeMode: ResizableRootResizeMode;
  /** The panels that count, in order. */
  readonly panels: readonly RootPanel[];
  /** The constraints of `panels`, in percent, in the same order. */
  readonly constraints: readonly PanelConstraints[];
  /** The size of each panel of `panels` on the screen, in percent. */
  readonly shown: Layout;
  /**
   * The first length of each panel that waits for the first measurement, by panel id. A root
   * with such a panel has no layout to move.
   */
  readonly lengths: ReadonlyMap<string, string>;
  readonly measurement: RootMeasurement | undefined;
  readonly dragging: boolean;
  /** The layout of the release, while a drag in the mode `'on-release'` runs. */
  readonly pendingLayout: Layout | undefined;
  /** The text direction of the root, from its last read. */
  readonly direction: 'ltr' | 'rtl';
  /** The valid entry of the layout for a panel. */
  entry(id: string): Size | undefined;
  /** The index in `panels` of the panel before the handle, or -1 with no panel on one side. */
  pivotOf(handle: RootHandle): number;
  /** Adds a panel. Returns the function that removes it. */
  addPanel(panel: RootPanel): () => void;
  /** Adds a handle. Returns the function that removes it. */
  addHandle(handle: RootHandle): () => void;
  /** Reads the page again. With no room for the panels, the result is `undefined`. */
  measure(): RootMeasurement | undefined;
  /** Reads the text direction of the root element. */
  readDirection(): 'ltr' | 'rtl';
  /** Starts a drag. It returns `false` while another drag of the root runs. */
  startDrag(): boolean;
  /** Ends the drag, and clears the layout of the release. */
  endDrag(): void;
  setPendingLayout(layout: Layout): void;
  /**
   * Emits the change of the user. The result is the layout of the event, or `undefined` when a
   * listener cancelled it.
   */
  changeLayout(
    layout: Layout,
    details: ResizableRootChangeEventDetails,
  ): ResizableLayout | undefined;
  commitLayout(layout: ResizableLayout, reason: ResizableRootChangeEventReason, event: Event): void;
  /** With no `move`, a method of the panel calls it. */
  collapsePanel(id: string, move?: HandleMove): void;
  expandPanel(id: string, move?: HandleMove): void;
  resizePanel(id: string, size: Size): void;
  /** Gives the panel its first size. The result is `false` when it has that size already. */
  resetPanel(id: string, move: HandleMove): boolean;
}

export const rootKey: InjectionKey<ResizableRootForParts> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'resizable root' : undefined,
);

export function injectRoot(part: 'Panel' | 'Handle') {
  const root = inject(rootKey, null);
  if (!root) {
    throw createError(53, part);
  }
  return root;
}
