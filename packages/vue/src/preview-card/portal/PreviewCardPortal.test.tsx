import { expect, describe, it } from 'vitest';
import { h, shallowRef } from 'vue';
import type { Component } from 'vue';
import * as PreviewCard from '../index.parts';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  screen,
  waitFor,
  waitForPositioned,
} from '#test-utils';

type RenderSlotProps = { props: Record<string, unknown>; children: Component };

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

  describe('slot: render', () => {
    it('puts the content of children in the element of the slot', async () => {
      await render(
        <PreviewCard.Root open>
          <PreviewCard.Portal
            v-slots={{
              render: ({ props, children }: RenderSlotProps) => (
                <section {...props} data-testid="portal">
                  {h(children, null, () => (
                    <PreviewCard.Positioner>
                      <PreviewCard.Popup data-testid="popup">Content</PreviewCard.Popup>
                    </PreviewCard.Positioner>
                  ))}
                </section>
              ),
            }}
          />
        </PreviewCard.Root>,
      );
      await flushMicrotasks();

      expect(screen.getByTestId('portal')).toContainElement(screen.getByTestId('popup'));
    });
  });

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
