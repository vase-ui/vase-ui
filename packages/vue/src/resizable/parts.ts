import ResizableHandle from './ResizableHandle.vue';
import ResizablePanel from './ResizablePanel.vue';
import ResizableRoot from './ResizableRoot.vue';
import type {
  ResizableHandleProps,
  ResizableHandleState,
  ResizablePanelProps,
  ResizablePanelState,
  ResizableRootChangeEventDetails,
  ResizableRootChangeEventReason,
  ResizableRootCommitEventDetails,
  ResizableRootProps,
  ResizableRootResizeMode,
  ResizableRootState,
} from './types';

export type { ResizableLayout as Layout } from './types';

/**
 * Groups the panels and the handles of the layout, with `display: flex` in the direction of
 * `orientation`. An element in the root that is not a panel or a handle, such as a toolbar, keeps
 * its CSS size.
 * Renders a `<div>` element.
 * @selector `[data-orientation]` The orientation of the root: `horizontal` or `vertical`.
 * @selector `[data-disabled]` The root is disabled.
 * @selector `[data-dragging]` The user drags a handle of the root.
 */
export const Root: typeof ResizableRoot = ResizableRoot;
export namespace Root {
  export type Props = ResizableRootProps;
  export type State = ResizableRootState;
  export type ResizeMode = ResizableRootResizeMode;
  export type ChangeEventReason = ResizableRootChangeEventReason;
  export type ChangeEventDetails = ResizableRootChangeEventDetails;
  export type CommitEventDetails = ResizableRootCommitEventDetails;
}

/**
 * A part of the layout that a handle resizes. A collapsible panel can collapse to a small size.
 * Renders a `<div>` element.
 * @selector `[data-orientation]` The orientation of the root: `horizontal` or `vertical`.
 * @selector `[data-collapsed]` The panel is collapsed.
 * @selector `[data-disabled]` The panel is disabled.
 * @cssVariable `--resizable-panel-size` The size of the panel in percent of the panel space, as a number with no unit. A panel whose first size is a length gets it at the first measurement.
 */
export const Panel: typeof ResizablePanel = ResizablePanel;
export namespace Panel {
  export type Props = ResizablePanelProps;
  export type State = ResizablePanelState;
}

/**
 * The separator between two panels. The user drags it or presses a key on it to resize the panels.
 * Enter collapses or expands the primary panel, and a double click gives it its first size.
 * Without the `element` slot, the handle ends with a `<span>`, its pointer target. The handle has
 * `position: relative` to contain it.
 * A press focuses the handle with no focus ring, where the browser has the `focusVisible` option of
 * `focus()`. A handle before the first panel or after the last panel moves nothing, and it has no
 * tab stop and no value.
 * Renders a `<div>` element with the role `separator`.
 * @selector `[aria-orientation]` The orientation of the handle: `vertical` in a horizontal root, and `horizontal` in a vertical root.
 * @selector `[aria-disabled="true"]` The handle or the root is disabled. The handle then has no tab stop.
 * @selector `[data-dragging]` The user drags the handle.
 * @selector `[data-crossing]` The pointer is where the handle crosses a handle of another root, and a press there drags both.
 * @selector `[data-at-min]` The handle cannot move left, or up in a vertical root. The sides are those of the screen, also in a right-to-left root.
 * @selector `[data-at-max]` The handle cannot move right, or down in a vertical root. The sides are those of the screen, also in a right-to-left root.
 * @cssVariable `--resizable-handle-hit-area-size` The least size of the pointer target on the axis of the move. Set it to give another size than `10px`.
 * @cssVariable `--resizable-handle-preview-offset` In the resize mode `on-release`, the distance from the handle to the place that the release gives it, during a drag.
 */
export const Handle: typeof ResizableHandle = ResizableHandle;
export namespace Handle {
  export type Props = ResizableHandleProps;
  export type State = ResizableHandleState;
}
