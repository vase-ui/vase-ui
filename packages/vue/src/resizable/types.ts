import type { HTMLAttributes } from 'vue';
import type { ChangeEventDetails } from '../common/changeEventDetails';
import type { AsProps } from '../common/element';

/**
 * The size of each panel, by panel `id`: a number in percent of the panel space, or a string of a
 * number with a unit. `'30'` and `'30%'` are percent. `'240px'`, `'12em'`, `'12rem'`, `'30vw'` and
 * `'30vh'` are lengths. The layout of an event gives a fixed panel in pixels, such as `'240px'`.
 */
export type ResizableLayout = Record<string, number | string>;

/** A drag changes the layout at each move (`'live'`), or one time at the release. */
export type ResizableRootResizeMode = 'live' | 'on-release';

/** `'reset'` is a double click on a handle. */
export type ResizableRootChangeEventReason = 'drag' | 'keyboard' | 'reset';

export type ResizableRootChangeEventDetails = ChangeEventDetails<ResizableRootChangeEventReason>;

export interface ResizableRootCommitEventDetails {
  reason: ResizableRootChangeEventReason;
  event: Event;
}

export interface ResizableRootProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /**
   * The layout. `null` is a layout with no entries, and the root stays controlled. An entry that is
   * not a size has no effect.
   */
  modelValue?: ResizableLayout | null;
  /** The first layout of an uncontrolled root, and the first sizes for a double click. */
  defaultLayout?: ResizableLayout | null;
  /** @default 'horizontal' */
  orientation?: 'horizontal' | 'vertical';
  /** Each handle ignores the user. */
  disabled?: boolean;
  /**
   * The move of an arrow key. A size: a number is percent of the panel space, and `em` is the font
   * size of the root.
   * @default 1
   */
  step?: number | string;
  /**
   * The move of Shift with an arrow key, of Page Up and of Page Down. A size, as `step`.
   * @default 10
   */
  largeStep?: number | string;
  /** A drag moves a handle in steps of this size. A size, as `step`. */
  dragStep?: number | string;
  /**
   * A move goes on into the panels after the panel beside the handle.
   * @default true
   */
  pushPanels?: boolean;
  /** @default 'live' */
  resizeMode?: ResizableRootResizeMode;
}

export interface ResizableRootState {
  orientation: 'horizontal' | 'vertical';
  disabled: boolean;
  dragging: boolean;
}

export interface ResizablePanelProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  /** The `id` of the element, and the key of the panel in the layout. */
  id?: string;
  /**
   * The first size, when the layout has no entry for the panel. A number is percent of the panel
   * space. A string can have a unit: `%`, `px`, `em` (the font size of the panel), `rem`, `vw` or
   * `vh`. A later change has no effect.
   */
  defaultSize?: number | string;
  /** @default 0 */
  minSize?: number | string;
  /** @default 100 */
  maxSize?: number | string;
  /** The panel collapses to `collapsedSize` below `minSize`. */
  collapsible?: boolean;
  /** @default 0 */
  collapsedSize?: number | string;
  /**
   * The distance that a drag passes below `minSize` to collapse the panel, or above
   * `collapsedSize` to expand it. The default is half of the distance between the two sizes.
   */
  collapseThreshold?: number | string;
  /** A move of a handle leaves the size of the panel. */
  disabled?: boolean;
  /**
   * `'fixed'` keeps the pixels of the panel when the root changes size.
   * @default 'proportional'
   */
  rootResizeBehavior?: 'proportional' | 'fixed';
  /**
   * When the other panels cannot take a size change of the root, the fixed panel with the greater
   * number gives way first.
   * @default 0
   */
  rootResizePriority?: number;
  /** A drag that comes within `snapTolerance` of a point gives the panel that size. */
  snapPoints?: readonly (number | string)[];
  /** @default '10px' */
  snapTolerance?: number | string;
}

export interface ResizablePanelState {
  orientation: 'horizontal' | 'vertical';
  /** The size in percent of the panel space. */
  size: number;
  collapsed: boolean;
  disabled: boolean;
}

export interface ResizableHandleProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /** The handle ignores the user. */
  disabled?: boolean;
  /**
   * The panel that the value, `aria-controls`, Home, End, Page Up, Page Down, Enter and the double
   * click are about.
   * @default 'previous'
   */
  primaryPanel?: 'previous' | 'next';
}

export interface ResizableHandleState {
  orientation: 'horizontal' | 'vertical';
  disabled: boolean;
  dragging: boolean;
  /** A press at the pointer drags this handle and a handle of another root together. */
  crossing: boolean;
  /** The handle cannot move left, or up in a vertical root. */
  atMin: boolean;
  /** The handle cannot move right, or down in a vertical root. */
  atMax: boolean;
}
