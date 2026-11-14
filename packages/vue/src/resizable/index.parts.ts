import ResizableHandle from './handle/ResizableHandle.vue';
import type { ResizableHandleProps, ResizableHandleState } from './handle/ResizableHandle.vue';
import ResizablePanel from './panel/ResizablePanel.vue';
import type {
  ResizablePanelActions,
  ResizablePanelProps,
  ResizablePanelState,
} from './panel/ResizablePanel.vue';
import ResizableRoot from './root/ResizableRoot.vue';
import type {
  ResizableRootActions,
  ResizableRootChangeEventDetails,
  ResizableRootChangeEventReason,
  ResizableRootCommitEventDetails,
  ResizableRootCommitEventReason,
  ResizableRootLayout,
  ResizableRootProps,
  ResizableRootState,
} from './root/ResizableRoot.vue';

/**
 * Groups the panels and the handles of the layout.
 * Each panel and each handle must be a flex item of the root element. A wrapper element between
 * them needs `display: contents`.
 * Renders a `<div>` element.
 */
export const Root: typeof ResizableRoot = ResizableRoot;
export namespace Root {
  export type State = ResizableRootState;
  export type Props = ResizableRootProps;
  export type Actions = ResizableRootActions;
  export type Layout = ResizableRootLayout;
  export type ChangeEventReason = ResizableRootChangeEventReason;
  export type ChangeEventDetails = ResizableRootChangeEventDetails;
  export type CommitEventReason = ResizableRootCommitEventReason;
  export type CommitEventDetails = ResizableRootCommitEventDetails;
}

/**
 * A part of the layout that a handle resizes. A collapsible panel can collapse to a small size.
 * Renders a `<div>` element.
 */
export const Panel: typeof ResizablePanel = ResizablePanel;
export namespace Panel {
  export type State = ResizablePanelState;
  export type Props = ResizablePanelProps;
  export type Actions = ResizablePanelActions;
}

/**
 * The separator between two panels. The user drags it or presses a key on it to resize the panels.
 * Enter collapses or expands the primary panel, and a double click gives it its first size.
 * Renders a `<div>` element.
 */
export const Handle: typeof ResizableHandle = ResizableHandle;
export namespace Handle {
  export type State = ResizableHandleState;
  export type Props = ResizableHandleProps;
}

export { useParentPanel } from './utils/useParentPanel';
export { useParentRoot } from './utils/useParentRoot';
