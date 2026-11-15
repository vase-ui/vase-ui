import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { KeepAlive, defineComponent, h, shallowRef } from 'vue';
import { createRenderer, flushMicrotasks, recordInputEvents, screen } from '#test-utils';
import { useFormRestore, useFormRestoreAsInput } from './useFormRestore';

function renderInput(input: { value: HTMLInputElement | null }) {
  return h('input', {
    value: 'handled',
    'data-testid': 'input',
    ref: (element) => {
      input.value = element as HTMLInputElement | null;
    },
  });
}

function createRestorable(onRestore: (event: PageTransitionEvent) => void) {
  return defineComponent(() => {
    const input = shallowRef<HTMLInputElement | null>(null);
    useFormRestore(input, onRestore);
    return () => renderInput(input);
  });
}

function createRestorableInput(leaves: boolean) {
  return defineComponent(() => {
    const input = shallowRef<HTMLInputElement | null>(null);
    useFormRestoreAsInput(input, () => 'handled', leaves);
    return () => renderInput(input);
  });
}

describe('useFormRestore', () => {
  const { render } = createRenderer();

  it('calls the callback with the event of a restore', async () => {
    const handleRestore = vi.fn();
    const Restorable = createRestorable(handleRestore);
    await render(<Restorable />);
    const event = new PageTransitionEvent('pageshow');

    window.dispatchEvent(event);

    expect(handleRestore.mock.calls).toEqual([[event]]);
  });

  it('does not call the callback for a page from the back/forward cache', async () => {
    const handleRestore = vi.fn();
    const Restorable = createRestorable(handleRestore);
    await render(<Restorable />);

    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));

    expect(handleRestore).not.toHaveBeenCalled();
  });

  it('removes the pageshow listener while deactivated', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    onTestFinished(() => {
      addSpy.mockRestore();
      removeSpy.mockRestore();
    });
    const count = (spy: typeof addSpy | typeof removeSpy) =>
      spy.mock.calls.filter(([eventType]) => eventType === 'pageshow').length;
    const Restorable = createRestorable(() => {});
    const shown = shallowRef(true);
    await render(() => <KeepAlive>{shown.value ? <Restorable key="restorable" /> : null}</KeepAlive>);
    expect([count(addSpy), count(removeSpy)]).toEqual([1, 0]);

    shown.value = false;
    await flushMicrotasks();

    expect([count(addSpy), count(removeSpy)]).toEqual([1, 1]);

    shown.value = true;
    await flushMicrotasks();

    expect([count(addSpy), count(removeSpy)]).toEqual([2, 1]);
  });
});

describe('useFormRestoreAsInput', () => {
  const { render } = createRenderer();

  async function restore(leaves: boolean, restored: string) {
    const RestorableInput = createRestorableInput(leaves);
    const { container } = await render(<RestorableInput />);
    const events = recordInputEvents(container);
    screen.getByTestId<HTMLInputElement>('input').value = restored;

    window.dispatchEvent(new PageTransitionEvent('pageshow'));
    await flushMicrotasks();
    return events;
  }

  it('sends the events of an input only for a value that the part did not handle', async () => {
    expect(await restore(true, 'handled')).toEqual([]);
  });

  it('sends change, blur and focusout after the input event when the control leaves', async () => {
    expect(await restore(true, 'restored')).toEqual(['input', 'change', 'blur', 'focusout']);
  });

  it('sends only the input event to a hidden input', async () => {
    expect(await restore(false, 'restored')).toEqual(['input']);
  });

  it('sends only the input event to a control that has the focus', async () => {
    const RestorableInput = createRestorableInput(true);
    await render(<RestorableInput />);
    const input = screen.getByTestId<HTMLInputElement>('input');
    input.focus();
    const events = recordInputEvents(input);
    input.value = 'restored';

    window.dispatchEvent(new PageTransitionEvent('pageshow'));
    await flushMicrotasks();

    expect(events).toEqual(['input']);
  });
});
