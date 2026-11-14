import { describe, expect, it } from 'vitest';
import { shallowRef } from 'vue';
import * as Popover from '../index.parts';
import { createRenderer, describeConformance, flushMicrotasks, screen } from '#test-utils';
import PopoverTitleReplacement from './PopoverTitleReplacement.test.vue';

describe('<Popover.Title />', () => {
  const { render } = createRenderer();

  describeConformance(<Popover.Title />, () => ({
    refInstanceof: window.HTMLHeadingElement,
    async render(node) {
      const result = await render(
        <Popover.Root open>
          <Popover.Trigger>Trigger</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>{node}</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));

  it('labels the popup element with its id', async () => {
    await render(
      <Popover.Root open>
        <Popover.Trigger>Trigger</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              <Popover.Title>Title</Popover.Title>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    );
    await flushMicrotasks();

    const id = document.querySelector('h2')?.id;
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', id);
  });

  it('VUE-45: names the title that stays when the last of two titles unmounts', async () => {
    const secondMounted = shallowRef(true);
    await render(() => (
      <Popover.Root open>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              <Popover.Title data-testid="first" />
              {secondMounted.value ? <Popover.Title data-testid="second" /> : null}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    await flushMicrotasks();
    const popup = screen.getByRole('dialog');
    expect(popup).toHaveAttribute('aria-labelledby', screen.getByTestId('second').id);

    secondMounted.value = false;
    await flushMicrotasks();

    expect(popup).toHaveAttribute('aria-labelledby', screen.getByTestId('first').id);
  });

  // The compiled template of the fixture mounts the new title before it unmounts the old title.
  // A render function in TSX reuses the title component, so it does not show this order.
  it('VUE-45: names the new title when a template replaces the title', async () => {
    const { setProps } = await render(<PopoverTitleReplacement first />);
    await flushMicrotasks();

    await setProps({ first: false });

    expect(screen.getByRole('dialog')).toHaveAttribute(
      'aria-labelledby',
      screen.getByText('Title 2').id,
    );
  });
});
