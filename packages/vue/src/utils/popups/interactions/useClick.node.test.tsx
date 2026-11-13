import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { createSSRApp, defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { getEmptyRootStore } from '../floating-root/getEmptyRootStore';
import { useClick } from './useClick';
import { useOpenInteractionType } from './useOpenInteractionType';

const Trigger = defineComponent({
  setup() {
    const { reference } = useClick(getEmptyRootStore());
    const { triggerProps } = useOpenInteractionType(false);
    return () => (
      <button {...reference} {...triggerProps}>
        trigger
      </button>
    );
  },
});

describe('useClick and useOpenInteractionType on a server', () => {
  it('renders a trigger with no listener attribute and starts no timer', async () => {
    const startTimer = vi.spyOn(globalThis, 'setTimeout');
    onTestFinished(() => startTimer.mockRestore());

    const html = await renderToString(createSSRApp(Trigger));

    expect(html).toBe('<button>trigger</button>');
    expect(startTimer).not.toHaveBeenCalled();
  });
});
