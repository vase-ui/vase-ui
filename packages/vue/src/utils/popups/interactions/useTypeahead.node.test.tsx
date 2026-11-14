import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { createSSRApp, defineComponent, shallowRef } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { getEmptyRootStore } from '../floating-root/getEmptyRootStore';
import { useTypeahead } from './useTypeahead';

const onTyping = vi.fn();

const List = defineComponent({
  setup() {
    const typeahead = useTypeahead(getEmptyRootStore(), {
      listRef: shallowRef(['one', 'two']),
      activeIndex: null,
      onTyping,
    });
    return () => (
      <>
        <input {...typeahead.reference} />
        <div {...typeahead.floating}>one</div>
      </>
    );
  },
});

describe('useTypeahead on a server', () => {
  it('renders no listener attribute, starts no timer and calls no callback', async () => {
    const startTimer = vi.spyOn(globalThis, 'setTimeout');
    onTestFinished(() => startTimer.mockRestore());

    const html = await renderToString(createSSRApp(List));

    expect(html).toBe('<!--[--><input><div>one</div><!--]-->');
    expect(startTimer).not.toHaveBeenCalled();
    expect(onTyping).not.toHaveBeenCalled();
  });
});
