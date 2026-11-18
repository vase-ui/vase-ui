import { isShadowRoot } from '@floating-ui/utils/dom';
import { onScopeDispose, toValue, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { ownerDocument } from '../common/owner';
import { useCSPContext } from '../internals/csp-context/CSPContext';
import { followRootNode, isDocumentOrShadowRoot } from '../internals/observeRootNode';

const DISABLE_SCROLLBAR_CLASS_NAME = 'vase-ui-disable-scrollbar';

export const styleDisableScrollbar = {
  className: DISABLE_SCROLLBAR_CLASS_NAME,
  // The text has none of the characters `&`, `<`, `>`, `"` and `'`.
  // A server render escapes these characters in text.
  // A browser does not decode them in the text of a `<style>` element.
  css: `.${DISABLE_SCROLLBAR_CLASS_NAME}{scrollbar-width:none}.${DISABLE_SCROLLBAR_CLASS_NAME}::-webkit-scrollbar{display:none}`,
};

interface SharedStyle {
  element: HTMLStyleElement;
  users: number;
}

// The map is in the module, so each copy of the library has its own shared elements.
const sharedStyles = new WeakMap<Document | ShadowRoot, SharedStyle>();

/**
 * Takes one use of the shared style element of `root`.
 * It returns the function that gives the use back.
 */
function takeSharedStyle(
  root: Document | ShadowRoot,
  doc: Document,
  nonce: string | undefined,
): () => void {
  let shared = sharedStyles.get(root);

  if (!shared) {
    const element = doc.createElement('style');
    if (nonce) {
      // The `nonce` property does not write the attribute.
      element.setAttribute('nonce', nonce);
    }
    element.textContent = styleDisableScrollbar.css;
    // The element comes first, so a rule of the consumer with the same specificity wins.
    // The browser checks the policy when the element connects, so the nonce and text come first.
    (isShadowRoot(root) ? root : doc.head).prepend(element);
    shared = { element, users: 0 };
    sharedStyles.set(root, shared);
  }

  shared.users += 1;
  const taken = shared;

  return () => {
    taken.users -= 1;
    if (taken.users === 0) {
      taken.element.remove();
      sharedStyles.delete(root);
    }
  };
}

/**
 * Keeps one style element with the rule of `styleDisableScrollbar` in the document or shadow root
 * of `element`. The use follows the element to another root node.
 * A part outside a document or shadow root has no use.
 * The last part that uses the element removes it. The first part decides the nonce.
 * Call it in `setup`. It does nothing on a server. `StyleDisableScrollbar` gives the server HTML
 * its element.
 */
export function useStyleDisableScrollbar(element: MaybeRefOrGetter<Element | null>): void {
  const csp = useCSPContext();
  // eslint-disable-next-line no-restricted-syntax -- Take the new use before the previous release so the style count stays above zero.
  let giveBack: (() => void) | undefined;

  function update() {
    const target = toValue(element);
    const next =
      target && !csp.value.disableStyleElements
        ? followRootNode(target, (root) =>
            isDocumentOrShadowRoot(root)
              ? takeSharedStyle(root, ownerDocument(target), csp.value.nonce)
              : undefined,
          )
        : undefined;
    giveBack?.();
    giveBack = next;
  }

  watch([() => toValue(element), () => csp.value.disableStyleElements], update, { flush: 'post' });
  onScopeDispose(() => {
    giveBack?.();
    giveBack = undefined;
  });
}
