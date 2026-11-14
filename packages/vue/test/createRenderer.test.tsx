import { expect, describe, it, vi, afterEach } from 'vitest';
import { defineComponent, nextTick, onMounted, onUnmounted, ref } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { createRenderer, flushMicrotasks, screen } from '#test-utils';

describe('createRenderer', () => {
  const { render } = createRenderer();

  afterEach(() => {
    vi.useRealTimers();
  });

  const Part = defineComponent({
    props: { label: { type: String, default: 'first' } },
    setup: (props) => () => <button type="button">{props.label}</button>,
  });

  it('keeps a ref on a vnode that a function makes', async () => {
    let instance: ComponentPublicInstance | null = null;

    await render(() => (
      <Part
        ref={(value) => {
          instance = value as ComponentPublicInstance | null;
        }}
      />
    ));

    expect(instance).not.toBeNull();
    expect(instance!.$el).toBe(screen.getByRole('button'));
  });

  it('patches the component and does not mount it again on rerender', async () => {
    const mounted = vi.fn();
    const Counted = defineComponent({
      props: { label: { type: String, default: 'first' } },
      setup(props) {
        onMounted(mounted);
        return () => <button type="button">{props.label}</button>;
      },
    });

    const { rerender } = await render(<Counted label="first" />);
    const button = screen.getByRole('button');

    await rerender(<Counted label="second" />);

    expect(mounted).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button')).toBe(button);
    expect(button).toHaveTextContent('second');
  });

  it('replaces a prop with setProps and does not keep the props of an earlier call', async () => {
    const { setProps } = await render(<Part data-first="a" />);

    expect(screen.getByRole('button')).toHaveAttribute('data-first', 'a');

    await setProps({ label: 'second', 'data-second': 'b' });
    expect(screen.getByRole('button')).toHaveTextContent('second');
    expect(screen.getByRole('button')).toHaveAttribute('data-second', 'b');

    await setProps({ label: 'third' });
    expect(screen.getByRole('button')).toHaveTextContent('third');
    expect(screen.getByRole('button')).not.toHaveAttribute('data-second');
  });

  it('gives a user that sends input to the document', async () => {
    const handleClick = vi.fn();
    const { user } = await render(
      <button type="button" onClick={handleClick}>
        Press
      </button>,
    );

    await user.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('keeps the vnode of a render function in setProps', async () => {
    const { setProps } = await render(() => <Part data-first="a" />);

    await setProps({ label: 'second' });

    expect(screen.getByRole('button')).toHaveTextContent('second');
    expect(screen.getByRole('button')).toHaveAttribute('data-first', 'a');
  });

  describe('a click right after the mount', () => {
    async function mountAndClick() {
      const capture = vi.fn();
      const bubble = vi.fn();
      const { container, unmount } = await render(
        <div data-testid="target" {...{ onClickCapture: capture }} onClick={bubble} />,
      );

      (container.firstElementChild as HTMLElement).click();
      unmount();

      return capture.mock.calls.length === 1 && bubble.mock.calls.length === 1;
    }

    it('runs the capture listener and the bubble listener of one element', async () => {
      let failures = 0;
      for (let index = 0; index < 100; index += 1) {
        if (!(await mountAndClick())) {
          failures += 1;
        }
      }

      expect(failures).toBe(0);
    });

    it('runs both listeners under fake timers, and render resolves', async () => {
      vi.useFakeTimers();

      expect(await mountAndClick()).toBe(true);
    });
  });

  it('shows the last state of a component that writes state after two ticks with flushMicrotasks', async () => {
    const Late = defineComponent(() => {
      const text = ref('start');
      async function change() {
        await nextTick();
        await nextTick();
        text.value = 'end';
      }
      return () => (
        <button type="button" onClick={() => void change()}>
          {text.value}
        </button>
      );
    });

    await render(<Late />);
    const button = screen.getByRole('button');

    button.click();
    await nextTick();
    expect(button).toHaveTextContent('start');

    await flushMicrotasks();
    expect(button).toHaveTextContent('end');
  });

  it('unmounts the app and removes the container after the test', async ({ onTestFinished }) => {
    let unmountCount = 0;
    const Counted = defineComponent(() => {
      onUnmounted(() => {
        unmountCount += 1;
      });
      return () => <button type="button">Press</button>;
    });
    const { container } = await render(<Counted />);

    expect(container.isConnected).toBe(true);
    expect(unmountCount).toBe(0);

    // A hook of `onTestFinished` runs after the hooks of `afterEach`.
    onTestFinished(() => {
      expect(unmountCount).toBe(1);
      expect(container.isConnected).toBe(false);
    });
  });
});
