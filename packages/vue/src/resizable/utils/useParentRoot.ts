import { inject } from 'vue';
import { ResizableRootContext } from '../root/ResizableRootContext';
import type { ResizableParentRoot } from '../root/ResizableRootContext';

/**
 * Gives the orientation and the methods of the nearest `Resizable.Root` above the caller, or `null`
 * when the caller is not inside a root. A root in a panel of another root is the nearest root for
 * the parts inside it. Call it in `setup`.
 */
export function useParentRoot(): ResizableParentRoot | null {
  return inject(ResizableRootContext, null)?.actions ?? null;
}
