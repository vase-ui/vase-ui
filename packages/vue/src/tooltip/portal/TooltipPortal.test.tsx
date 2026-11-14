import { expect, describe, it, onTestFinished } from 'vitest';
import { shallowRef } from 'vue';
import * as Tooltip from '../index.parts';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  isInaccessible,
  screen,
  waitFor,
  waitForPositioned,
} from '#test-utils';

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
