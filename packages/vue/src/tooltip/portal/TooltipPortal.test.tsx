import { expect, describe, it, onTestFinished } from 'vitest';
import { h, shallowRef } from 'vue';
import type { Component } from 'vue';
import { Tooltip } from '@vase-ui/vue/tooltip';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  isInaccessible,
  screen,
  waitFor,
  waitForPositioned,
} from '#test-utils';

type RenderSlotProps = { props: Record<string, unknown>; children: Component };

describe('<Tooltip.Portal />', () => {
  const { render } = createRenderer();

  describeConformance(<Tooltip.Portal />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(<Tooltip.Root open>{node}</Tooltip.Root>);
      await flushMicrotasks();
      return result;
    },
  }));

  describe('slot: render', () => {
    it('puts the content of children in the element of the slot', async () => {
      await render(
        <Tooltip.Root open>
          <Tooltip.Portal
            v-slots={{
              render: ({ props, children }: RenderSlotProps) => (
                <section {...props} data-testid="portal">
                  {h(children, null, () => (
                    <Tooltip.Positioner>
                      <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>
                    </Tooltip.Positioner>
                  ))}
                </section>
              ),
            }}
          />
        </Tooltip.Root>,
      );
      await flushMicrotasks();

      expect(screen.getByTestId('portal')).toContainElement(screen.getByTestId('popup'));
    });
  });

  describe('prop: container', () => {
    it('renders the portal element into the container', async () => {
      const container = document.createElement('div');
      document.body.append(container);
      onTestFinished(() => container.remove());

      await render(
        <Tooltip.Root open>
          <Tooltip.Portal container={container} data-testid="portal" />
        </Tooltip.Root>,
      );
      await flushMicrotasks();

      expect(screen.getByTestId('portal').parentElement).toBe(container);
    });
  });

  describe('prop: keepMounted', () => {
    function ClosedTooltip({ keepMounted }: { keepMounted?: boolean }) {
      return (
        <Tooltip.Root>
          <Tooltip.Trigger>Trigger</Tooltip.Trigger>
          <Tooltip.Portal keepMounted={keepMounted}>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      );
    }

    it('renders the closed popup as hidden instead of unmounting it', async () => {
      await render(<ClosedTooltip keepMounted />);
      await flushMicrotasks();

      expect(isInaccessible(screen.getByTestId('popup'))).toBe(true);
    });

    it('gives the positioner the prop, so a closed popup does not keep its last position', async () => {
      const open = shallowRef(true);
      await render(() => (
        <Tooltip.Root open={open.value}>
          <Tooltip.Trigger>Trigger</Tooltip.Trigger>
          <Tooltip.Portal keepMounted>
            <Tooltip.Positioner data-testid="positioner">
              <Tooltip.Popup>Content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ));
      const positioner = await screen.findByTestId('positioner');
      await waitForPositioned(positioner);

      open.value = false;
      await waitFor(() => {
        expect(positioner).toHaveAttribute('hidden');
      });

      expect(positioner.style.opacity).toBe('0');
    });

    it('unmounts the closed popup by default', async () => {
      await render(<ClosedTooltip />);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup')).toBe(null);
    });
  });
});
