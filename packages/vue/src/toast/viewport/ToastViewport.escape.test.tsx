import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { createRenderer, fireEvent, flushMicrotasks, screen } from '#test-utils';
import { Toast } from '@vase-ui/vue/toast';
import ToastTextList from '../../../test/fixtures/ToastTextList.vue';
import { platform } from '../../common/platform';

describe.each(['root', 'viewport'] as const)('Escape in the toast %s', (part) => {
  const { render } = createRenderer();

  async function focusInput() {
    const manager = Toast.createToastManager();
    const onClose = vi.fn();
    await render(
      <Toast.Provider toastManager={manager}>
        <button data-testid="origin">Show notifications</button>
        <Toast.Viewport>
          <ToastTextList />
          <input aria-label="viewport" />
        </Toast.Viewport>
      </Toast.Provider>,
    );
    manager.add({ id: 'edit', title: () => <input aria-label="root" />, timeout: 0, onClose });
    await flushMicrotasks();
    const origin = screen.getByTestId('origin');
    origin.focus();
    await fireEvent.keyDown(origin, { key: 'F6' });
    const input = screen.getByRole('textbox', { name: part });
    input.focus();
    return { input, origin, onClose };
  }

  it.each([
    { signal: 'isComposing', init: { isComposing: true } },
    { signal: 'key code 229', init: { keyCode: 229 } },
  ])('VUE-183: leaves Escape to the input method for $signal', async ({ init }) => {
    const { input, origin, onClose } = await focusInput();
    const escape = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
      ...init,
    });
    const listener = vi.fn();
    onTestFinished(() => document.removeEventListener('keydown', listener));
    document.addEventListener('keydown', listener);
    input.dispatchEvent(escape);

    expect(listener).toHaveBeenCalledOnce();
    expect(escape.defaultPrevented).toBe(false);
    expect(input).toHaveFocus();
    expect(onClose).not.toHaveBeenCalled();

    await fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(part === 'root' ? 1 : 0);
    expect(origin).toHaveFocus();
  });

  it('VUE-183: respects the browser event order at the end of composition', async () => {
    const { input, origin, onClose } = await focusInput();
    vi.useFakeTimers();
    onTestFinished(() => {
      vi.useRealTimers();
    });

    await fireEvent.compositionEnd(input);
    if (platform.engine.webkit) {
      vi.advanceTimersByTime(4);
      await fireEvent.keyDown(input, { key: 'Escape' });
      expect(input).toHaveFocus();
      expect(onClose).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
    }
    await fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(part === 'root' ? 1 : 0);
    expect(origin).toHaveFocus();
  });
});
