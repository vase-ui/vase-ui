import { describe, expect, it } from 'vitest';
import { shallowRef } from 'vue';
import * as Popover from '../index.parts';
import { createRenderer, describeConformance, flushMicrotasks, screen } from '#test-utils';

describe('<Popover.Description />', () => {
  const { render } = createRenderer();

  describeConformance(<Popover.Description />, () => ({
    refInstanceof: window.HTMLParagraphElement,
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

  it('describes the popup element with its id', async () => {
    await render(
      <Popover.Root open>
        <Popover.Trigger>Trigger</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              <Popover.Description>Title</Popover.Description>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    );
    await flushMicrotasks();

    const id = document.querySelector('p')?.id;
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-describedby', id);
  });

  it('VUE-45: names the description that stays when the first of two descriptions unmounts', async () => {
    const firstMounted = shallowRef(true);
    await render(() => (
      <Popover.Root open>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              {firstMounted.value ? <Popover.Description data-testid="first" /> : null}
              <Popover.Description data-testid="second" />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    await flushMicrotasks();
    const popup = screen.getByRole('dialog');
    expect(popup).toHaveAttribute('aria-describedby', screen.getByTestId('second').id);

    firstMounted.value = false;
    await flushMicrotasks();

    expect(popup).toHaveAttribute('aria-describedby', screen.getByTestId('second').id);
  });
});
