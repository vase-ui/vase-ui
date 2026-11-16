import { describe, expect, it } from 'vitest';
import { shallowRef } from 'vue';
import * as Popover from '../index.parts';
import {
  createHeldBranch,
  createRenderer,
  describeConformance,
  flushMicrotasks,
  screen,
} from '#test-utils';
import type { HTMLProps } from '../../internals/types';
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

  it('does not name the popup with a title that mounts while KeepAlive holds it', async () => {
    const { HeldBranch, mountWhileHeld, show } = createHeldBranch(() => (
      <Popover.Title key="title" id="held-title" />
    ));
    await render(() => (
      <Popover.Root open>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              <HeldBranch />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    await flushMicrotasks();
    const popup = screen.getByRole('dialog');

    await mountWhileHeld();
    expect(popup).not.toHaveAttribute('aria-labelledby');

    await show();
    expect(popup).toHaveAttribute('aria-labelledby', 'held-title');
  });

  it('VUE-119: follows the id that the #render slot gives the title', async () => {
    const id = shallowRef('slot-title');
    await render(() => (
      <Popover.Root open>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              <Popover.Title
                v-slots={{
                  render: ({ props }: { props: HTMLProps }) => (
                    <h2 {...props} id={id.value}>
                      Text
                    </h2>
                  ),
                }}
              />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    await flushMicrotasks();
    const popup = screen.getByRole('dialog');
    expect(popup).toHaveAttribute('aria-labelledby', 'slot-title');

    id.value = 'other-title';
    await flushMicrotasks();
    expect(popup).toHaveAttribute('aria-labelledby', 'other-title');

    id.value = '';
    await flushMicrotasks();
    expect(screen.getByText('Text').id).toBe('');
    expect(popup).not.toHaveAttribute('aria-labelledby');
  });
});
