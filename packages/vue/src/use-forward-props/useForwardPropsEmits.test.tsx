import { describe, expect, it, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import { Collapsible } from '../collapsible';
import { createRenderer, screen, takeReportedMessages } from '#test-utils';
import ForwardEmits from './ForwardEmits.test.vue';
import ForwardEmitsModel from './ForwardEmitsModel.test.vue';
import { useForwardPropsEmits } from './index';

describe('useForwardPropsEmits', () => {
  const { render } = createRenderer();

  it('gives a listener for each declared event', async () => {
    const change = vi.fn();
    const update = vi.fn();
    const { user, setProps } = await render(() => (
      <ForwardEmitsModel onChange={change} onUpdate={update} />
    ));
    const trigger = screen.getByRole('button', { name: 'Toggle' });
    await user.click(trigger);
    expect(change).toHaveBeenCalledExactlyOnceWith(
      true,
      expect.objectContaining({
        reason: 'trigger-press',
        event: expect.any(MouseEvent),
        cancel: expect.any(Function),
      }),
    );
    expect(update).toHaveBeenCalledExactlyOnceWith(true);
    expect(screen.getByRole('status').textContent).toBe('true');
    expect(screen.getByText('Content')).toBeInTheDocument();
    await setProps({ cancel: true });
    await user.click(trigger);
    expect(change).toHaveBeenCalledTimes(2);
    expect(change.mock.calls[1][0]).toBe(false);
    expect(change.mock.calls[1][1].isCanceled).toBe(true);
    expect(update).toHaveBeenCalledOnce();
    expect(screen.getByRole('status').textContent).toBe('true');
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('keeps the same listeners when props change', async () => {
    const wrapper = shallowRef<{ forwarded: Record<string, unknown> }>();
    const { setProps } = await render(() => <ForwardEmits ref={wrapper} open={false} />);
    const before = wrapper.value?.forwarded;
    expect(before).toEqual({
      open: false,
      onOpenChange: expect.any(Function),
      'onUpdate:open': expect.any(Function),
    });
    await setProps({ open: true });
    expect(wrapper.value?.forwarded.onOpenChange).toBe(before?.onOpenChange);
    expect(wrapper.value?.forwarded['onUpdate:open']).toBe(before?.['onUpdate:open']);
  });

  it('takes the events of an options object', async () => {
    let read: () => object = () => ({});
    const done = vi.fn();
    const Wrapper = defineComponent({
      emits: { done: null, 'after-save': null },
      setup(props, { emit }) {
        const forwarded = useForwardPropsEmits(props, emit);
        read = () => forwarded.value;
        return () => <div />;
      },
    });
    await render(() => <Wrapper onDone={done} />);
    expect(read()).toEqual({ onDone: expect.any(Function), onAfterSave: expect.any(Function) });
    const listeners = read() as Record<string, (...args: unknown[]) => void>;
    listeners.onDone(1, 'value');
    expect(done).toHaveBeenCalledExactlyOnceWith(1, 'value');
  });

  it('without emit it gives the props only', async () => {
    let read: () => object = () => ({});
    const Wrapper = defineComponent({
      props: { id: String },
      emits: ['done'],
      setup(props) {
        const forwarded = useForwardPropsEmits(props);
        read = () => forwarded.value;
        return () => <div />;
      },
    });
    await render(() => <Wrapper id="value" />);
    expect(read()).toEqual({ id: 'value' });
  });

  it('forwards an event of a mixin to the listener of the caller', async () => {
    const change = vi.fn();
    const openChangeMixin = defineComponent({ emits: ['openChange'] });
    const Wrapper = defineComponent({
      mixins: [openChangeMixin],
      emits: ['update:open'],
      setup(props, { emit }) {
        const forwarded = useForwardPropsEmits(props, emit);
        return () => (
          <Collapsible.Root {...forwarded.value}>
            <Collapsible.Trigger>Toggle</Collapsible.Trigger>
          </Collapsible.Root>
        );
      },
    });
    const { user } = await render(() => <Wrapper onOpenChange={change} />);
    await user.click(screen.getByRole('button', { name: 'Toggle' }));
    expect(change).toHaveBeenCalledExactlyOnceWith(
      true,
      expect.objectContaining({ reason: 'trigger-press' }),
    );
  });

  it('takes the props and the events of `extends`', async () => {
    let read: () => object = () => ({});
    const saved = vi.fn();
    const Base = defineComponent({
      props: { id: String },
      emits: { 'after-save': null },
    });
    const Wrapper = defineComponent({
      extends: Base,
      emits: ['done'],
      setup(props, { emit }) {
        const forwarded = useForwardPropsEmits(props, emit);
        read = () => forwarded.value;
        return () => <div />;
      },
    });
    await render(() => <Wrapper id="value" {...{ onAfterSave: saved }} />);
    expect(read()).toEqual({
      id: 'value',
      onAfterSave: expect.any(Function),
      onDone: expect.any(Function),
    });
    const listeners = read() as Record<string, (...args: unknown[]) => void>;
    listeners.onAfterSave('value');
    expect(saved).toHaveBeenCalledExactlyOnceWith('value');
  });

  it('warns when the wrapper declares no event', async () => {
    let read: () => object = () => ({});
    const Wrapper = defineComponent({
      props: { id: String },
      setup(props, { emit }) {
        const forwarded = useForwardPropsEmits(props, emit);
        read = () => forwarded.value;
        return () => <div />;
      },
    });
    await render(() => (
      <>
        <Wrapper id="value" />
        <Wrapper id="value" />
      </>
    ));
    expect(read()).toEqual({ id: 'value' });
    expect(takeReportedMessages()).toEqual([
      'console.warn: Vase UI: `useForwardPropsEmits` received `emit`, but the wrapper declares no event. ' +
        'It has no event to forward. Declare the events with `defineEmits`, or use `useForwardProps`.',
    ]);
  });

  it('warns with no component, and forwards no event', () => {
    const forwarded = useForwardPropsEmits({ id: 'value', open: undefined }, vi.fn());
    expect(forwarded.value).toStrictEqual({ id: 'value' });
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining(
        '`useForwardProps` ran with no virtual DOM component, so it cannot read the props that the caller set.',
      ),
      'console.warn: Vase UI: `useForwardPropsEmits` ran with no virtual DOM component, so it cannot read the events that the wrapper declares. ' +
        'It forwards no event. ' +
        'In a Vapor component, leave the events undeclared and pass `$attrs` to the part. ' +
        'Elsewhere, call it in the `setup` of a component.',
    ]);
  });
});
