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

export const Root: typeof ResizableRoot = ResizableRoot;
export namespace Root {
  export type Props = ResizableRootProps;
  export type State = ResizableRootState;
  export type ResizeMode = ResizableRootResizeMode;
  export type ChangeEventReason = ResizableRootChangeEventReason;
  export type ChangeEventDetails = ResizableRootChangeEventDetails;
  export type CommitEventDetails = ResizableRootCommitEventDetails;
}

export const Panel: typeof ResizablePanel = ResizablePanel;
export namespace Panel {
  export type Props = ResizablePanelProps;
  export type State = ResizablePanelState;
}

export const Handle: typeof ResizableHandle = ResizableHandle;
export namespace Handle {
  export type Props = ResizableHandleProps;
  export type State = ResizableHandleState;
}
