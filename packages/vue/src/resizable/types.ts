import type { HTMLAttributes } from 'vue';
import type { ChangeEventDetails, GenericEventDetails } from '../common/changeEventDetails';
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

export type ResizableRootCommitEventDetails = GenericEventDetails<ResizableRootChangeEventReason>;

export interface ResizableRootProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /**
   * The layout. `{}` and `null` give each panel its first size, and the root stays controlled. An
   * entry that is not a size has no effect.
   */
  modelValue?: ResizableLayout | null;
  /** The first layout of an uncontrolled root, and the first sizes for a double click. */
  defaultLayout?: ResizableLayout | null;
  /**
   * `'vertical'` puts the panels in a column, and ArrowUp and ArrowDown move the handles.
   * @default 'horizontal'
   */
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
  /**
   * A drag moves a handle in steps of this size. A size, as `step`. A key and a method do not use
   * it.
   */
  dragStep?: number | string;
  /**
   * A move continues into the panels after the panel beside the handle.
   * @default true
   */
  pushPanels?: boolean;
  /**
   * When a drag changes the layout. A key, a double click and a method change it at once.
   * @default 'live'
   */
  resizeMode?: ResizableRootResizeMode;
}

export interface ResizableRootEmits {
  /**
   * The user changes the layout. `details.cancel()` keeps the layout. A listener can then write its
   * own layout to `v-model`, such as a layout that snaps to a rule of the app.
   */
  layoutChange: [layout: ResizableLayout, details: ResizableRootChangeEventDetails];
  /**
   * Comes after `layoutChange`, unless a listener cancelled it. Also comes alone after a method of a
   * panel, and after a panel that mounts with no entry. A change of the size of the root emits
   * nothing.
   */
  'update:modelValue': [layout: ResizableLayout];
  /** The user ends a change: the release of a drag, a key, a double click. */
  layoutCommitted: [layout: ResizableLayout, details: ResizableRootCommitEventDetails];
  /** A drag starts, and it ends. */
  draggingChange: [dragging: boolean];
}

export interface ResizableRootState {
  orientation: 'horizontal' | 'vertical';
  disabled: boolean;
  dragging: boolean;
}

export interface ResizablePanelProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  /**
   * The `id` of the element, and the key of the panel in the layout. With none, the panel gets a
   * generated `id`.
   */
  id?: string;
  /**
   * The first size, when the layout has no entry for the panel. A number is percent of the panel
   * space. A string can have a unit: `%`, `px`, `em` (the font size of the panel), `rem`, `vw` or
   * `vh`. The panels with no first size share the rest of the space in equal parts. A later change
   * has no effect.
   */
  defaultSize?: number | string;
  /**
   * The least size, in the form of `defaultSize`.
   * @default 0
   */
  minSize?: number | string;
  /**
   * The greatest size, in the form of `defaultSize`.
   * @default 100
   */
  maxSize?: number | string;
  /**
   * The panel collapses to `collapsedSize` below `minSize`. Give it a `minSize` greater than its
   * `collapsedSize`.
   */
  collapsible?: boolean;
  /**
   * The size of the collapsed panel, in the form of `defaultSize`. A panel whose first size is
   * `collapsedSize` starts collapsed, with no event.
   * @default 0
   */
  collapsedSize?: number | string;
  /**
   * The distance that a drag passes below `minSize` to collapse the panel, or above
   * `collapsedSize` to expand it. The default is half of the distance between the two sizes.
   */
  collapseThreshold?: number | string;
  /**
   * A move of a handle goes through the panel to the next panel, and leaves its size. The methods of
   * the panel and the layout of the root still change its size.
   */
  disabled?: boolean;
  /**
   * `'fixed'` keeps the pixels of the panel when the root changes size.
   * @default 'proportional'
   */
  rootResizeBehavior?: 'proportional' | 'fixed';
  /**
   * When the other panels cannot take a size change of the root, the fixed panel with the greater
   * number changes size first.
   * @default 0
   */
  rootResizePriority?: number;
  /**
   * A drag that comes within `snapTolerance` of a point gives the panel that size. A key and a
   * method do not snap.
   */
  snapPoints?: readonly (number | string)[];
  /**
   * The distance from a snap point at which a drag snaps to it.
   * @default '10px'
   */
  snapTolerance?: number | string;
}

export interface ResizablePanelEmits {
  /** The panel collapses or expands, after the DOM update. Not at the mount. */
  collapsedChange: [collapsed: boolean];
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
