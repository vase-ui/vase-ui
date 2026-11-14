import { expect, describe, it } from 'vitest';
import * as Tooltip from '../index.parts';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  isInaccessible,
  screen,
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

    it('unmounts the closed popup by default', async () => {
      await render(<ClosedTooltip />);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup')).toBe(null);
    });
  });
});
