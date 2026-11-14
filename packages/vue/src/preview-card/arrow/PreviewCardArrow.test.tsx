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

  it('is hidden from assistive technology and placed by the positioner', async () => {
    await render(
      <PreviewCard.Root open>
        <PreviewCard.Trigger href="#link">Link</PreviewCard.Trigger>
        <PreviewCard.Portal>
          <PreviewCard.Positioner>
            <PreviewCard.Popup style={{ width: '200px', height: '40px' }}>
              <PreviewCard.Arrow data-testid="arrow" style={{ width: '10px', height: '10px' }} />
            </PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>,
    );
    const arrow = await screen.findByTestId('arrow');

    // The arrow has a place only after the first position pass.
    await waitFor(() => {
      expect(arrow.style.left).toMatch(/px$/);
    });

    expect(arrow).toHaveAttribute('aria-hidden', 'true');
    expect(arrow).toHaveAttribute('data-side', 'bottom');
    expect(arrow).toHaveAttribute('data-open');
  });
});
