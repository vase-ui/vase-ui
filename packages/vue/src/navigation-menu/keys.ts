import { inject, onUnmounted, provide, type InjectionKey, type Ref } from 'vue';
import { arrowKeyTarget } from '../common/arrowKeyTarget';
import { ownerWindow } from '../common/owner';

/** A `List` that is not nested, or a `Content`: the arrow keys move the focus between its items. */
interface KeyGroup {
  add(element: () => HTMLElement | null): () => void;
}

const keyGroupKey: InjectionKey<KeyGroup> = Symbol('navigation menu key group');

/**
 * Makes a key group for the triggers and the links below the part. A list moves on the axis of its
 * orientation, with no loop, and stops each such key of its items. A content moves on both axes,
 * with a loop.
 */
export function useKeyGroup(options: { orientation: () => 'horizontal' | 'vertical' | 'both' }) {
  const items: (() => HTMLElement | null)[] = [];
  provide(keyGroupKey, {
    add(element) {
      items.push(element);
      return () => {
        const index = items.indexOf(element);
        if (index !== -1) items.splice(index, 1);
      };
    },
  });

  return function onKeydown(event: KeyboardEvent) {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    const target = event.target as HTMLElement;
    const elements = items.map((item) => item()).filter((element) => !!element);
    if (!elements.includes(target)) return;
    const orientation = options.orientation();
    const next =
      orientation === 'both'
        ? arrowKeyTarget(alongDocument(event.key), target, elements, {
            orientation: 'vertical',
            rtl: false,
            loop: true,
          })
        : arrowKeyTarget(event.key, target, elements, {
            orientation,
            rtl:
              ownerWindow(target).getComputedStyle(event.currentTarget as Element).direction ===
              'rtl',
            loop: false,
          });
    if (!next) return;
    event.stopPropagation();
    if (next === target) return;
    event.preventDefault();
    next.focus();
  };
}

// In a content, the right and down keys go on, and the left and up keys go back.
function alongDocument(key: string) {
  if (key === 'ArrowRight' || key === 'ArrowDown') return 'ArrowDown';
  if (key === 'ArrowLeft' || key === 'ArrowUp') return 'ArrowUp';
  return key;
}

/** Adds the element of a trigger or a link to the nearest key group above it. */
export function useKeyGroupItem(element: Readonly<Ref<HTMLElement | null>>) {
  const group = inject(keyGroupKey, null);
  if (!group) return;
  const remove = group.add(() => element.value);
  onUnmounted(remove);
}
