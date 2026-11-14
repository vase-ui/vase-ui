import { describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';
import { createRenderer, describeConformance, screen } from '#test-utils';
import * as Drawer from '../index.parts';

const TestCase = defineComponent({
  props: { open: { type: Boolean, required: true } },
  setup(props) {
    return () => (
      <Drawer.Provider>
        <Drawer.IndentBackground data-testid="bg" />
        <Drawer.Root open={props.open}>
          <Drawer.Trigger>Open</Drawer.Trigger>
        </Drawer.Root>
      </Drawer.Provider>
    );
  },
});

describe('<Drawer.IndentBackground />', () => {
  const { render } = createRenderer();

  describeConformance(<Drawer.IndentBackground />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node) => render(<Drawer.Provider>{node}</Drawer.Provider>),
  }));

  it('sets data-active when any drawer is open', async () => {
    const { setProps } = await render(<TestCase open={false} />);

    const background = screen.getByTestId('bg');

    expect(background.getAttribute('data-inactive')).toBe('');
    expect(background.getAttribute('data-active')).toBeNull();

    await setProps({ open: true });

    expect(background.getAttribute('data-active')).toBe('');
    expect(background.getAttribute('data-inactive')).toBeNull();
  });
});
