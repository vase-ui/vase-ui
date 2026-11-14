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

describe('<Drawer.Indent />', () => {
  const { render } = createRenderer();

  describeConformance(<Drawer.Indent />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node) => render(<Drawer.Provider>{node}</Drawer.Provider>),
  }));

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
