import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { nextTick, shallowRef } from 'vue';
import { createRenderer, waitFor } from '#test-utils';
import { EffectOwner } from '../../test/fixtures/effectOwner';
import { observerContract } from '../../test/fixtures/observerContract';
import { useResizeObserver } from './useResizeObserver';

describe('useResizeObserver', () => {
  observerContract('ResizeObserver', (targets, alternate, notify) =>
    useResizeObserver(targets, notify, () => ({
      box: alternate.value ? 'border-box' : 'content-box',
    })),
  );
  const { render } = createRenderer();

  it('follows the box supplied by an options getter on the prototype', async () => {
    const border = shallowRef(false);
    class Options {
      get box(): ResizeObserverBoxOptions {
        return border.value ? 'border-box' : 'content-box';
      }
    }
    const target = document.createElement('div');
    const observe = vi.spyOn(ResizeObserver.prototype, 'observe');
    await render(
      <EffectOwner setupEffect={() => useResizeObserver(target, vi.fn(), new Options())} />,
    );
    expect(observe).toHaveBeenCalledWith(target, { box: 'content-box' });
    border.value = true;
    await nextTick();
    expect(observe).toHaveBeenCalledWith(target, { box: 'border-box' });
  });

  it('reports native size entries and the first delivery of the observer', async () => {
    const box = document.createElement('div');
    box.style.width = '40px';
    document.body.append(box);
    onTestFinished(() => box.remove());
    const notify = vi.fn<(width: number, first: boolean) => void>();
    await render(
      <EffectOwner
        setupEffect={() =>
          useResizeObserver(box, (entries, _, first) => {
            notify(entries[0]!.contentRect.width, first);
          })
        }
      />,
    );
    await waitFor(() => expect(notify).toHaveBeenCalledWith(40, true));
    box.style.width = '60px';
    await waitFor(() => expect(notify).toHaveBeenCalledWith(60, false));
  });
});
