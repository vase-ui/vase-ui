import { expect, describe, it } from 'vitest';
import { shallowRef } from 'vue';
import * as PreviewCard from '../index.parts';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  screen,
  waitFor,
  waitForPositioned,
} from '#test-utils';

describe('<PreviewCard.Portal />', () => {
  const { render } = createRenderer();

  describeConformance(<PreviewCard.Portal keepMounted />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(<PreviewCard.Root open>{node}</PreviewCard.Root>);
      await flushMicrotasks();
      return result;
    },
  }));

  describe('prop: keepMounted', () => {
    it('gives the positioner the prop, so a closed popup does not keep its last position', async () => {
      const open = shallowRef(true);
      await render(() => (
        <PreviewCard.Root open={open.value}>
          <PreviewCard.Trigger href="#link">Link</PreviewCard.Trigger>
          <PreviewCard.Portal keepMounted>
            <PreviewCard.Positioner data-testid="positioner">
              <PreviewCard.Popup>Content</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      ));
      const positioner = await screen.findByTestId('positioner');
      await waitForPositioned(positioner);

      open.value = false;
      await waitFor(() => {
        expect(positioner).toHaveAttribute('hidden');
      });

      expect(positioner.style.opacity).toBe('0');
    });
  });
});
