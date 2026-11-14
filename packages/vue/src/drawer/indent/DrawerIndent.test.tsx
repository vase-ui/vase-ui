import { describe, expect, it } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import type { PropType } from 'vue';
import { createRenderer, describeConformance, flushMicrotasks, screen } from '#test-utils';
import * as Drawer from '../index.parts';
import { useDrawerProviderContext } from '../provider/DrawerProviderContext';
import type { DrawerProviderContext } from '../provider/DrawerProviderContext';

const ProviderProbe = defineComponent({
  props: {
    onContext: {
      type: Function as PropType<(context: DrawerProviderContext) => void>,
      required: true,
    },
  },
  setup(props) {
    props.onContext(useDrawerProviderContext()!);
    return () => null;
  },
});

const TestCase = defineComponent({
  props: { open: { type: Boolean, required: true } },
  setup(props) {
    return () => (
      <Drawer.Provider>
        <Drawer.IndentBackground data-testid="bg" />
        <Drawer.Indent data-testid="indent">
          <Drawer.Root open={props.open}>
            <Drawer.Trigger>Open</Drawer.Trigger>
          </Drawer.Root>
        </Drawer.Indent>
      </Drawer.Provider>
    );
  },
});

describe('<Drawer.Indent />', () => {
  const { render } = createRenderer();

  describeConformance(<Drawer.Indent />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node) => render(<Drawer.Provider>{node}</Drawer.Provider>),
  }));

  it('sets data-active when any drawer is open', async () => {
    const { setProps } = await render(<TestCase open={false} />);

    expect(screen.getByTestId('indent')).toHaveAttribute('data-inactive', '');
    expect(screen.getByTestId('indent')).not.toHaveAttribute('data-active');

    await setProps({ open: true });

    expect(screen.getByTestId('indent')).toHaveAttribute('data-active', '');
    expect(screen.getByTestId('indent')).not.toHaveAttribute('data-inactive');
    expect(screen.getByTestId('bg')).toHaveAttribute('data-active', '');
  });

  it('keeps the swipe progress of the gesture when it renders again', async () => {
    let context!: DrawerProviderContext;
    const open = shallowRef(false);
    await render(() => (
      <Drawer.Provider>
        <ProviderProbe onContext={(value) => (context = value)} />
        <Drawer.Indent data-testid="indent" />
        <Drawer.Root open={open.value} />
      </Drawer.Provider>
    ));
    const indent = screen.getByTestId('indent');

    context.visualStateStore.set({ swipeProgress: 0.5, frontmostHeight: 120 });
    expect(indent.style.getPropertyValue('--drawer-swipe-progress')).toBe('0.5');

    open.value = true;
    await flushMicrotasks();
    expect(indent).toHaveAttribute('data-active', '');
    expect(indent.style.getPropertyValue('--drawer-swipe-progress')).toBe('0.5');
    expect(indent.style.getPropertyValue('--drawer-height')).toBe('120px');
  });
});
