import { effectScope, watch, type EffectScope } from 'vue';
import { isShadowRoot } from '@floating-ui/utils/dom';
import { layerElements, openLayers, useLayer, type Layer, type LayerRules } from './layer';
import type { PopupRoot } from './root';
import { useScrollLock } from './useScrollLock';

/**
 * The layer of a root that can write `inert` or `aria-hidden` on the rest of the page, such as a
 * dialog. It also stops the scroll of the page. The families that never hide the page do not
 * import this module, so their bundles do not have its code.
 */
export function useModalLayer(root: PopupRoot, rules: () => LayerRules): Layer {
  const layer = useLayer(root, rules, startHide);
  useScrollLock(
    () => root.open && layer.lockScroll,
    () => root.activeTrigger,
  );
  return layer;
}

// The top layer that asks for it writes `inert` or `aria-hidden` on each sibling of the path from
// each element inside it to `<body>`.
// One watcher of the stack writes the attributes, from the first open of a modal layer to the close
// of the last layer.
let hideScope: EffectScope | undefined;
const written = new Map<Element, 'inert' | 'aria-hidden'>();
// The root of each marked element of a layer below. A part of a closed root writes `inert` itself
// for its leave, so the layer leaves that attribute there.
const rootsOfMarks = new WeakMap<Element, PopupRoot>();

function startHide() {
  if (hideScope) return;
  hideScope = effectScope(true);
  hideScope.run(() => {
    watch(
      // A new object for each change of the stack, so that the last close also stops the watcher.
      () => {
        const layers = openLayers();
        const index = layers.findLastIndex((layer) => layer.hide);
        const top = layers[index];
        if (!top) return { hide: false as const, whole: [], around: [] };
        const { root } = top;
        return {
          hide: top.hide,
          whole: [
            root.popup,
            top.triggerInUse ? root.activeTrigger : null,
            ...layers.slice(index + 1).flatMap(layerElements),
          ],
          around: [...root.parts, ...root.portalElements],
        };
      },
      (next) => writeHide(next),
      { flush: 'post', immediate: true },
    );
  });
}

/**
 * `whole` stays in use with all its content. `around` stays in use, but its other content is
 * outside the popup and does not, as for a native modal `<dialog>`.
 */
function writeHide(next: {
  hide: Layer['hide'];
  whole: (Element | null)[];
  around: (Element | null)[];
}) {
  const wanted = new Map<Element, 'inert' | 'aria-hidden'>();
  if (next.hide) {
    const connected = (element: Element | null): element is Element => !!element?.isConnected;
    const documents = new Set(
      [...next.whole, ...next.around].flatMap((each) => each?.ownerDocument ?? []),
    );
    // A live region and an alert stay in use at each place of the document, so that the page
    // announces its messages, such as toasts, under a modal popup.
    const announcers = [...documents].flatMap((doc) => [
      ...doc.querySelectorAll('[aria-live]:not([aria-live="off"]), [role="alert"]'),
    ]);
    const whole = new Set([...next.whole, ...announcers].filter(connected));
    const kept = new Set(
      [...whole, ...next.around.filter(connected)].flatMap((element) => pathToBody(element, whole)),
    );
    for (const node of kept) {
      for (const sibling of node.parentNode?.children ?? []) {
        if (!kept.has(sibling)) wanted.set(sibling, next.hide);
      }
    }
  }
  for (const [element, attribute] of written) {
    if (wanted.get(element) === attribute) continue;
    if (attribute !== 'inert' || rootsOfMarks.get(element)?.open !== false) {
      element.removeAttribute(attribute);
    }
    written.delete(element);
    rootsOfMarks.delete(element);
  }
  const layers = openLayers();
  for (const [element, attribute] of wanted) {
    if (written.has(element) || element.hasAttribute(attribute)) continue;
    element.setAttribute(attribute, attribute === 'inert' ? '' : 'true');
    written.set(element, attribute);
    const owner = layers.find((layer) => layerElements(layer).includes(element));
    if (owner) rootsOfMarks.set(element, owner.root);
  }
  if (layers.length === 0) {
    hideScope?.stop();
    hideScope = undefined;
  }
}

/**
 * An element inside `whole` has an empty path, so that a live region in a popup does not hide its
 * siblings.
 */
function pathToBody(element: Element, whole: ReadonlySet<Node>): Node[] {
  const path: Node[] = [];
  const body = element.ownerDocument.body;
  for (
    let node: Node | null = element;
    node && node !== body;
    node = node.parentNode && isShadowRoot(node.parentNode) ? node.parentNode.host : node.parentNode
  ) {
    if (node !== element && whole.has(node)) return [];
    path.push(node);
  }
  return path;
}
