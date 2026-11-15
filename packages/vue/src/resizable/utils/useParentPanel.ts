import { inject } from 'vue';
import { ResizablePanelContext } from '../panel/ResizablePanelContext';
import type { ResizableParentPanel } from '../panel/ResizablePanelContext';

/**
 * Gives the id, the state and the methods of the nearest `Resizable.Panel` above the caller, or
 * `null` when the caller is not inside a panel. Call it in `setup`.
 */
export function useParentPanel(): ResizableParentPanel | null {
  return inject(ResizablePanelContext, null);
}
