import type { ComputedRef, InjectionKey } from 'vue';
import type { ResizablePanelActions, ResizablePanelState } from './ResizablePanel.vue';

/**
 * What `useParentPanel()` gives: the id, the state and the methods of the nearest panel.
 */
export interface ResizableParentPanel extends ResizablePanelActions {
  /**
   * The id of the panel element, and the key of the panel in the layout.
   */
  id: ComputedRef<string>;
  /**
   * The state of the panel.
   */
  state: ComputedRef<ResizablePanelState>;
}

export const ResizablePanelContext: InjectionKey<ResizableParentPanel> = Symbol();
