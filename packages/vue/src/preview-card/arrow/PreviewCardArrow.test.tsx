import { expect, describe, it } from 'vitest';
import * as PreviewCard from '../index.parts';
import { createRenderer, describeConformance, flushMicrotasks, screen, waitFor } from '#test-utils';

describe('<PreviewCard.Arrow />', () => {
  const { render } = createRenderer();

  describeConformance(<PreviewCard.Arrow />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(
        <PreviewCard.Root open>
          <PreviewCard.Portal>
            <PreviewCard.Positioner>
              <PreviewCard.Popup>{node}</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));

  it('is hidden from assistive technology and points at the center of the link', async () => {
    await render(
      <div style={{ position: 'fixed', top: 0, left: 0 }}>
        <PreviewCard.Root open>
          <PreviewCard.Trigger
            href="#link"
            data-testid="link"
            style={{ display: 'inline-block', width: '200px', height: '20px' }}
          >
            L
          </PreviewCard.Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner>
              <PreviewCard.Popup style={{ width: '100px', height: '40px' }}>
                <PreviewCard.Arrow data-testid="arrow" style={{ width: '10px', height: '10px' }} />
              </PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      </div>,
    );
    const arrow = await screen.findByTestId('arrow');
    const link = screen.getByTestId('link').getBoundingClientRect();

    // The positioner measures the arrow, so the center of the arrow is on the center of the link.
    await waitFor(() => {
      const { left, width } = arrow.getBoundingClientRect();
      expect(Math.abs(left + width / 2 - (link.left + link.width / 2))).toBeLessThanOrEqual(1);
    });

    expect(arrow).toHaveAttribute('aria-hidden', 'true');
    expect(arrow).toHaveAttribute('data-side', 'bottom');
    expect(arrow).toHaveAttribute('data-open');
  });
});
