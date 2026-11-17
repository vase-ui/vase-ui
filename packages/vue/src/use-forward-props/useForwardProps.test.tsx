import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, shallowRef, toRef } from 'vue';
import { Accordion } from '../accordion';
import { Collapsible } from '../collapsible';
import { createRenderer, isVaporApp, screen, takeReportedMessages } from '#test-utils';
import WrapperForward from '../internals/WrapperForward.test.vue';
import ForwardVapor from './ForwardVapor.test.vue';
import { useForwardProps } from './index';

function createProbe(mode: 'object' | 'getter' | 'ref' | 'attrs' = 'object') {
  let read: () => object = () => ({});
  const Probe = defineComponent({
    props: { keepMounted: Boolean, id: String },
    setup(props, { attrs }) {
      const source =
        mode === 'getter'
          ? () => props
          : mode === 'ref'
            ? toRef(() => props)
            : mode === 'attrs'
              ? () => ({ ...props, ...attrs })
              : props;
      const forwarded = useForwardProps(source);
      read = () => forwarded.value;
      return () => h('button', forwarded.value, 'Target');
    },
  });
  return { Probe, read: () => read() };
}

const NO_COMPONENT_MESSAGE =
  'console.warn: Vase UI: `useForwardProps` ran with no virtual DOM component. ' +
  'It cannot read the props that the caller set. It forwards each prop that is not `undefined`. ' +
  'An absent Boolean prop can thus keep the value `false`. ' +
  'Call it in the `setup` of a component that is not a Vapor component.';

describe('useForwardProps', () => {
  const { render } = createRenderer();

  it('VUE-126: forwards no Boolean prop that the caller did not set', async () => {
    await render(() => (
      <Accordion.Root keepMounted>
        <Accordion.Item>
          <WrapperForward>Content</WrapperForward>
        </Accordion.Item>
      </Accordion.Root>
    ));
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(takeReportedMessages()).toEqual([]);
  });

  it('forwards an explicit false', async () => {
    const { Probe, read } = createProbe();
    await render(() => <Probe keepMounted={false} />);
    expect(read()).toStrictEqual({ keepMounted: false });
    await render(() => (
      <Accordion.Root keepMounted>
        <Accordion.Item>
          <WrapperForward keepMounted={false}>Content</WrapperForward>
        </Accordion.Item>
      </Accordion.Root>
    ));
    expect(screen.queryByText('Content')).toBeNull();
  });

  it('forwards a bare attribute as true, in kebab case too', async () => {
    const { Probe, read } = createProbe();
    const { rerender } = await render(() =>
      h(Probe, { keepMounted: '' } as Record<string, unknown>),
    );
    expect(read()).toStrictEqual({ keepMounted: true });
    await rerender(() => h(Probe, { 'keep-mounted': '' }));
    expect(read()).toStrictEqual({ keepMounted: true });
  });

  it('forwards a prop that has a default in the wrapper', async () => {
    let read: () => object = () => ({});
    const Wrapper = defineComponent({
      props: {
        disabled: { type: Boolean, default: false },
        id: { type: String, default: 'x' },
        open: { type: Boolean, default: undefined },
      },
      setup(props) {
        const forwarded = useForwardProps(props);
        read = () => forwarded.value;
        return () => <div />;
      },
    });
    await render(() => <Wrapper />);
    expect(read()).toStrictEqual({ disabled: false, id: 'x' });
  });

  it('leaves out a prop with the value undefined', async () => {
    const { Probe, read } = createProbe();
    await render(() => <Probe id={undefined} keepMounted={undefined} />);
    expect(read()).toStrictEqual({});
  });

  it('leaves out an attribute and a listener that the wrapper does not declare', async () => {
    const { Probe, read } = createProbe('attrs');
    const click = vi.fn();
    const { user } = await render(() =>
      h(Probe, { class: 'outer', 'data-x': 'value', onClick: click }),
    );
    expect(read()).toStrictEqual({});
    const button = screen.getByRole('button', { name: 'Target' });
    expect(button).toHaveClass('outer');
    expect(button).toHaveAttribute('data-x', 'value');
    await user.click(button);
    expect(click).toHaveBeenCalledOnce();
  });

  it('follows a new value of a prop', async () => {
    const { Probe, read } = createProbe();
    const { setProps } = await render(() => <Probe id="first" />);
    expect(read()).toStrictEqual({ id: 'first' });
    await setProps({ id: 'second' });
    expect(read()).toStrictEqual({ id: 'second' });
    expect(screen.getByRole('button', { name: 'Target' })).toHaveAttribute('id', 'second');
  });

  it('follows a caller that starts to set a Boolean prop to false, and that stops', async () => {
    const { Probe, read } = createProbe();
    const bound = shallowRef<Record<string, unknown>>({});
    await render(() => <Probe {...bound.value} />);
    expect(read()).toStrictEqual({});
    bound.value = { keepMounted: false };
    await nextTick();
    expect(read()).toStrictEqual({ keepMounted: false });
    bound.value = {};
    await nextTick();
    expect(read()).toStrictEqual({});
  });

  it.each([{ name: 'getter' }, { name: 'ref' }] as const)(
    'takes the props as a $name',
    async ({ name }) => {
      const { Probe, read } = createProbe(name);
      const { setProps } = await render(() => <Probe id="first" />);
      expect(read()).toStrictEqual({ id: 'first' });
      await setProps({ id: 'second' });
      expect(read()).toStrictEqual({ id: 'second' });
    },
  );

  it('stays uncontrolled: a wrapper of Collapsible.Root opens on a click', async () => {
    const Wrapper = defineComponent({
      props: { open: Boolean },
      setup(props) {
        const forwarded = useForwardProps(props);
        return () => (
          <Collapsible.Root {...forwarded.value}>
            <Collapsible.Trigger>Toggle</Collapsible.Trigger>
            <Collapsible.Panel>Content</Collapsible.Panel>
          </Collapsible.Root>
        );
      },
    });
    const { user } = await render(() => <Wrapper />);
    expect(screen.queryByText('Content')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Toggle' }));
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('warns with no component, and forwards each prop that is not undefined', () => {
    const source = shallowRef({ a: 1, b: false, c: undefined });
    const forwarded = useForwardProps(source);
    useForwardProps(source);
    expect(takeReportedMessages()).toEqual([NO_COMPONENT_MESSAGE]);
    expect(forwarded.value).toStrictEqual({ a: 1, b: false });
    source.value = { a: 2, b: true, c: undefined };
    expect(forwarded.value).toStrictEqual({ a: 2, b: true });
  });

  it.runIf(isVaporApp)('a Vapor wrapper gets the warning and its set props', async () => {
    await render(() => <ForwardVapor open id="vapor-root" />);
    expect(takeReportedMessages()).toEqual([NO_COMPONENT_MESSAGE]);
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(document.getElementById('vapor-root')).toBeInTheDocument();
  });
});
