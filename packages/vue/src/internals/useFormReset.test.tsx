import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { KeepAlive, Teleport, Transition, defineComponent, nextTick, shallowRef } from 'vue';
import {
  createHeldBranch,
  createRenderer,
  fireEvent,
  flushMicrotasks,
  screen,
  wait,
  waitFor,
} from '#test-utils';
import { TestElement } from '../../test/testElement';
import { useFormReset } from './useFormReset';

// A switch with a hidden input whose reset gives the default state again.
const ResetSwitch = defineComponent(() => {
  const checked = shallowRef(true);
  const input = shallowRef<HTMLInputElement | null>(null);
  useFormReset(input, () => {
    checked.value = true;
  });
  return () => (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={String(checked.value)}
        onClick={() => (checked.value = !checked.value)}
      >
        Notifications
      </button>
      <input
        ref={input}
        type="checkbox"
        name="notifications"
        checked={checked.value}
        hidden
        aria-hidden="true"
      />
    </>
  );
});

function renderSwitchForm() {
  return (
    <form data-testid="form">
      <ResetSwitch />
    </form>
  );
}

describe('useFormReset', () => {
  const { render } = createRenderer();

  afterEach(() => {
    vi.useRealTimers();
  });

  it('follows a getter from an existing input to a different form', async () => {
    const onReset = vi.fn();
    const { container } = await render(
      <div>
        <form>
          <input name="first" />
        </form>
        <form>
          <input name="second" />
        </form>
      </div>,
    );
    const [first, second] = container.querySelectorAll('input');
    if (!first?.form || !second?.form) {
      throw new Error('Both inputs need a form.');
    }
    const input = shallowRef(first);
    const setupElement = () => {
      useFormReset(() => input.value, onReset);
    };
    const { unmount } = await render(<TestElement setupElement={setupElement} />);
    vi.useFakeTimers();
    first.form.reset();
    vi.advanceTimersByTime(0);
    expect(onReset).toHaveBeenCalledTimes(1);

    input.value = second;
    await flushMicrotasks();
    first.form.reset();
    vi.advanceTimersByTime(0);
    expect(onReset).toHaveBeenCalledTimes(1);
    second.form.reset();
    vi.advanceTimersByTime(0);
    expect(onReset).toHaveBeenCalledTimes(2);

    unmount();
    second.form.reset();
    vi.advanceTimersByTime(0);
    expect(onReset).toHaveBeenCalledTimes(2);
  });

  it('drops a reset that waits when its input changes', async () => {
    const onReset = vi.fn();
    const inputKey = shallowRef('first');
    const Control = defineComponent(() => {
      const input = shallowRef<HTMLInputElement | null>(null);
      useFormReset(input, onReset);
      return () => (
        <input
          key={inputKey.value}
          name="comment"
          ref={(element) => {
            input.value = element as HTMLInputElement | null;
          }}
        />
      );
    });
    await render(
      <form data-testid="form">
        <Control />
      </form>,
    );
    const form = screen.getByTestId<HTMLFormElement>('form');

    vi.useFakeTimers();
    form.reset();
    inputKey.value = 'second';
    await flushMicrotasks();
    vi.advanceTimersByTime(0);
    expect(onReset).not.toHaveBeenCalled();

    form.reset();
    vi.advanceTimersByTime(0);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('BUG-6206: follows each reset even if a later reset is canceled in the same task', async () => {
    const onReset = vi.fn<(event: Event) => void>();
    const Control = defineComponent(() => {
      const input = shallowRef<HTMLInputElement | null>(null);
      useFormReset(input, onReset);
      return () => <input ref={input} />;
    });
    const { unmount } = await render(
      <form data-testid="form">
        <Control />
      </form>,
    );
    const form = screen.getByTestId<HTMLFormElement>('form');
    const events: Event[] = [];
    form.addEventListener('reset', (event) => events.push(event));
    vi.useFakeTimers();
    form.reset();
    form.reset();
    form.ownerDocument.addEventListener('reset', (event) => event.preventDefault(), { once: true });
    form.reset();

    expect(onReset).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0);
    expect(onReset.mock.calls.map(([event]) => events.indexOf(event))).toEqual([0, 1]);

    form.reset();
    form.reset();
    unmount();
    vi.advanceTimersByTime(0);
    expect(onReset).toHaveBeenCalledTimes(2);
  });

  it.each([
    { name: 'after the microtasks', afterMove: flushMicrotasks },
    { name: 'at the next Vue tick', afterMove: nextTick },
  ])(
    'follows a reset after `Teleport` moves the form into a shadow root: $name',
    async ({ afterMove }) => {
      const host = document.createElement('div');
      const container = document.createElement('div');
      const shadowRoot = host.attachShadow({ mode: 'open' });
      shadowRoot.append(container);
      document.body.append(host);
      onTestFinished(() => host.remove());
      const moved = shallowRef(false);
      await render(() => (
        <Teleport to={container} disabled={!moved.value}>
          {renderSwitchForm()}
        </Teleport>
      ));
      const form = screen.getByTestId<HTMLFormElement>('form');
      const control = screen.getByRole('switch');
      await fireEvent.click(control);
      expect(control).toHaveAttribute('aria-checked', 'false');

      moved.value = true;
      await afterMove();
      expect(form.getRootNode()).toBe(shadowRoot);
      form.reset();
      await wait(0);

      expect(control).toHaveAttribute('aria-checked', 'true');
    },
  );

  describe('BUG-6206: a native reset under KeepAlive', () => {
    it('keeps a reset that waits while KeepAlive hides and shows the branch', async () => {
      const { HeldBranch, hide, show } = createHeldBranch(renderSwitchForm, { mounted: true });
      await render(<HeldBranch />);
      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute('aria-checked', 'true');
      await fireEvent.click(switchElement);
      expect(switchElement).toHaveAttribute('aria-checked', 'false');

      vi.useFakeTimers();
      screen.getByTestId<HTMLFormElement>('form').reset();
      await hide();
      await show();
      vi.advanceTimersByTime(0);
      vi.useRealTimers();
      await flushMicrotasks();

      expect(switchElement).toHaveAttribute('aria-checked', 'true');
    });

    it.each([{ name: 'mounted shown' }, { name: 'mounted while held' }])(
      'follows a program reset of a form that KeepAlive holds with the control: $name',
      async ({ name }) => {
        const { HeldBranch, mountWhileHeld, hide, show } = createHeldBranch(renderSwitchForm, {
          mounted: name === 'mounted shown',
        });
        await render(<HeldBranch />);
        if (name === 'mounted while held') {
          await mountWhileHeld();
          await show();
        }
        // A query cannot find the form while `KeepAlive` holds it.
        const form = screen.getByTestId<HTMLFormElement>('form');
        const switchElement = screen.getByRole('switch');
        expect(switchElement).toHaveAttribute('aria-checked', 'true');
        await fireEvent.click(switchElement);
        expect(switchElement).toHaveAttribute('aria-checked', 'false');

        await hide();
        vi.useFakeTimers();
        form.reset();
        vi.advanceTimersByTime(0);
        vi.useRealTimers();
        await flushMicrotasks();
        await show();

        expect({
          part: switchElement.getAttribute('aria-checked'),
          input: (form.elements.namedItem('notifications') as HTMLInputElement).checked,
        }).toEqual({ part: 'true', input: true });
      },
    );

    it('follows a program reset of a held form after a leave transition', async () => {
      const visible = shallowRef(true);
      const Branch = defineComponent(() => renderSwitchForm);
      await render(() => (
        <Transition>
          <KeepAlive>{visible.value ? <Branch /> : null}</KeepAlive>
        </Transition>
      ));
      const form = screen.getByTestId<HTMLFormElement>('form');
      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute('aria-checked', 'true');
      await fireEvent.click(switchElement);
      expect(switchElement).toHaveAttribute('aria-checked', 'false');

      visible.value = false;
      await waitFor(() => {
        expect(form).not.toBeInTheDocument();
      });
      expect(screen.queryByTestId('form')).toBeNull();
      vi.useFakeTimers();
      form.reset();
      vi.advanceTimersByTime(0);
      vi.useRealTimers();
      await flushMicrotasks();
      visible.value = true;
      await flushMicrotasks();

      expect(switchElement).toHaveAttribute('aria-checked', 'true');
    });
  });
});
