import { expect, describe, it } from 'vitest';
import * as Tooltip from '../index.parts';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  isJSDOM,
  screen,
  waitFor,
} from '#test-utils';

describe('<Tooltip.Arrow />', () => {
  const { render } = createRenderer();

  describeConformance(<Tooltip.Arrow />, () => ({
    refInstanceof: window.Element,
    async render(node) {
      const result = await render(
        <Tooltip.Root open>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>{node}</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));

  function ArrowTooltip({
    arrowPadding,
    triggerWidth = 20,
  }: {
    arrowPadding?: number;
    triggerWidth?: number;
  }) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0 }}>
        <Tooltip.Root open>
          <Tooltip.Trigger style={{ width: `${triggerWidth}px`, height: '20px' }}>
            T
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner side="bottom" arrowPadding={arrowPadding}>
              <Tooltip.Popup style={{ width: '200px', height: '40px' }}>
                <Tooltip.Arrow data-testid="arrow" style={{ width: '10px', height: '10px' }} />
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </div>
    );
  }

  // The arrow has a place only after the first position pass, which also decides if it is
  // centered.
  async function waitForArrowPlaced() {
    const arrow = await screen.findByTestId('arrow');
    await waitFor(() => {
      expect(arrow.style.left).toMatch(/px$/);
    });
    return arrow;
  }

  it('is hidden from assistive technology and mirrors the resolved side', async () => {
    await render(<ArrowTooltip />);
    await flushMicrotasks();

    const arrow = screen.getByTestId('arrow');

    expect(arrow).toHaveAttribute('aria-hidden', 'true');
    expect(arrow).toHaveAttribute('data-side', 'bottom');
    expect(arrow).toHaveAttribute('data-open');
  });

  it.skipIf(isJSDOM)('is marked uncentered when it cannot point at the anchor', async () => {
    await render(<ArrowTooltip arrowPadding={40} />);

    const arrow = await waitForArrowPlaced();

    expect(arrow).toHaveAttribute('data-uncentered');
  });

  it.skipIf(isJSDOM)('is not marked uncentered when it can point at the anchor', async () => {
    await render(<ArrowTooltip arrowPadding={0} triggerWidth={200} />);

    const arrow = await waitForArrowPlaced();

    expect(arrow).not.toHaveAttribute('data-uncentered');
  });
});
