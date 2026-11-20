import { byDocumentOrder } from './element';

/**
 * The element that an arrow key moves the focus to, from `current` among `elements`. `undefined`:
 * the key is not of the axis. `current`: an end with no loop. `current` can be absent from
 * `elements`, such as a focused element that becomes disabled.
 */
export function arrowKeyTarget(
  key: string,
  current: HTMLElement,
  elements: readonly HTMLElement[],
  options: { orientation: 'horizontal' | 'vertical'; rtl: boolean; loop: boolean },
): HTMLElement | undefined {
  const [next, previous] =
    options.orientation === 'vertical'
      ? ['ArrowDown', 'ArrowUp']
      : options.rtl
        ? ['ArrowLeft', 'ArrowRight']
        : ['ArrowRight', 'ArrowLeft'];
  const step = key === next ? 1 : key === previous ? -1 : 0;
  if (step === 0) return undefined;
  const sequence = [...new Set([...elements, current])].sort(byDocumentOrder);
  const index = sequence.indexOf(current) + step;
  // `at(-1)` is the last element.
  if (options.loop) return sequence.at(index % sequence.length);
  return sequence[index] ?? current;
}
