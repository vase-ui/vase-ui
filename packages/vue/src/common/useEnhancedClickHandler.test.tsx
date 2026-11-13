import { describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { createRenderer, fireEvent } from '#test-utils';
import { useEnhancedClickHandler } from './useEnhancedClickHandler';

describe('useEnhancedClickHandler', () => {
  const { render } = createRenderer();

  async function renderButton() {
    const handler = vi.fn();
    const Button = defineComponent(() => {
      const handlers = useEnhancedClickHandler(handler);
      return () => <button {...handlers} />;
    });
    const { container, getByRole } = await render(<Button />);
    return { handler, container, button: getByRole('button') };
  }

  const pointerdown = (pointerType: string) =>
    new PointerEvent('pointerdown', { pointerType, bubbles: true, cancelable: true });

  it('gives the pointer type of a pointerdown to the handler', async () => {
    const { handler, button } = await renderButton();

    const event = pointerdown('touch');
    await fireEvent(button, event);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event, 'touch');
  });

  it('ignores a pointerdown that a listener prevented', async () => {
    const { handler, container, button } = await renderButton();
    container.addEventListener('pointerdown', (event) => event.preventDefault(), { capture: true });

    await fireEvent(button, pointerdown('mouse'));

    expect(handler).not.toHaveBeenCalled();
  });

  it('gives the pointer type of a click that is a PointerEvent', async () => {
    const { handler, button } = await renderButton();

    const event = new PointerEvent('click', { pointerType: 'pen', detail: 1, bubbles: true });
    await fireEvent(button, event);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event, 'pen');
  });

  it('gives the type of the last pointerdown to a click that is a MouseEvent', async () => {
    const { handler, button } = await renderButton();

    await fireEvent(button, pointerdown('touch'));
    const click = new MouseEvent('click', { detail: 1, bubbles: true });
    await fireEvent(button, click);

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenLastCalledWith(click, 'touch');
  });

  it('forgets the type of a pointerdown after the click', async () => {
    const { handler, button } = await renderButton();

    await fireEvent(button, pointerdown('mouse'));
    await fireEvent(button, new MouseEvent('click', { detail: 1, bubbles: true }));
    const click = new MouseEvent('click', { detail: 1, bubbles: true });
    await fireEvent(button, click);

    expect(handler).toHaveBeenLastCalledWith(click, '');
  });

  it('gives the keyboard to the handler for a click that has no click count', async () => {
    const { handler, button } = await renderButton();

    await fireEvent(button, pointerdown('mouse'));
    const click = new MouseEvent('click', { detail: 0, bubbles: true });
    await fireEvent(button, click);

    expect(handler).toHaveBeenLastCalledWith(click, 'keyboard');
  });
});
