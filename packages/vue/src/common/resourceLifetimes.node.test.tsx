import { expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { useListenerSession } from './useListenerSession';
import { useMutationObserver } from './useMutationObserver';
import { useResizeObserver } from './useResizeObserver';

it('renders without a browser target or a press', async () => {
  const target = vi.fn((): Element | null => null);
  const deliver = vi.fn();
  const Host = defineComponent(() => {
    useMutationObserver(target, { childList: true }, deliver);
    useResizeObserver(target, deliver);
    const press = useListenerSession(false);
    return () => <button onPointerdown={() => press.start(deliver)}>Press</button>;
  });
  expect(await renderToString(<Host />)).toBe('<button>Press</button>');
  expect(target).not.toHaveBeenCalled();
  expect(deliver).not.toHaveBeenCalled();
});
