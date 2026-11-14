import { describe, expect, it } from 'vitest';
import { h, shallowRef } from 'vue';
import type { Component } from 'vue';
import * as Popover from '../index.parts';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  screen,
  waitFor,
  waitForPositioned,
} from '#test-utils';

describe('<Popover.Portal />', () => {
  const { render } = createRenderer();

  describeConformance(<Popover.Portal />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(<Popover.Root open>{node}</Popover.Root>);
      await flushMicrotasks();
      return result;
    },
  }));

  it('keeps a closed popup in the document with keepMounted', async () => {
    await render(
      <Popover.Root>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Portal keepMounted>
          <Popover.Positioner data-testid="positioner">
            <Popover.Popup>Content</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    );
    await flushMicrotasks();

    expect(screen.getByText('Content')).toHaveAttribute('data-closed');
    expect(screen.getByTestId('positioner')).toHaveAttribute('hidden');
  });

  it('gives the positioner the prop, so a closed popup does not keep its last position', async () => {
    const open = shallowRef(true);
    await render(() => (
      <Popover.Root open={open.value}>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Portal keepMounted>
          <Popover.Positioner data-testid="positioner">
            <Popover.Popup>Content</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    const positioner = await screen.findByTestId('positioner');
    await waitForPositioned(positioner);

    open.value = false;
    await waitFor(() => {
      expect(positioner).toHaveAttribute('hidden');
    });

    expect(positioner.style.opacity).toBe('0');
  });

  it('renders the popup in the children component of the #render slot', async () => {
    await render(
      <Popover.Root open>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Portal
          v-slots={{
            render: ({
              props,
              children,
            }: {
              props: Record<string, unknown>;
              children: Component;
            }) => (
              <section {...props} data-testid="portal">
                {h(children, null, () => (
                  <Popover.Positioner>
                    <Popover.Popup>Content</Popover.Popup>
                  </Popover.Positioner>
                ))}
              </section>
            ),
          }}
        />
      </Popover.Root>,
    );
    await flushMicrotasks();

    const portal = screen.getByTestId('portal');
    expect(portal.localName).toBe('section');
    expect(portal.parentElement).toBe(document.body);
    expect(portal.contains(screen.getByRole('dialog'))).toBe(true);
  });
});
