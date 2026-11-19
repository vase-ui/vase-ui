import { expect, it } from 'vitest';
import { shallowRef } from 'vue';
import { PreviewCard } from '@vase-ui/vue/preview-card';
import { createRenderer, fireEvent, screen, waitFor } from '#test-utils';

const { render } = createRenderer();

it('VUE-160: keeps the replacement arrow at the center when the old arrow leaves', async () => {
  const first = shallowRef(true);
  const second = shallowRef(false);
  const offset = shallowRef(0);
  await render(() => (
    <PreviewCard.Root>
      <PreviewCard.Trigger
        data-testid="trigger"
        delay={0}
        style={{ position: 'fixed', top: '80px', left: '150px', width: '80px', height: '20px' }}
      >
        Preview
      </PreviewCard.Trigger>
      <PreviewCard.Portal>
        <PreviewCard.Positioner data-testid="positioner" sideOffset={offset.value}>
          <PreviewCard.Popup style={{ width: '100px', height: '50px' }}>
            {first.value && (
              <PreviewCard.Arrow key="first" style={{ width: '8px', height: '8px' }} />
            )}
            {second.value && (
              <PreviewCard.Arrow
                key="second"
                data-testid="arrow"
                style={{ width: '20px', height: '8px' }}
              />
            )}
            <PreviewCard.Viewport data-testid="viewport">Details</PreviewCard.Viewport>
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  ));
  const trigger = screen.getByTestId('trigger');
  await fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
  await fireEvent.mouseEnter(trigger);
  expect(screen.getByTestId('viewport').querySelector('[data-current]')).toHaveTextContent(
    'Details',
  );
  const anchor = trigger.getBoundingClientRect();
  second.value = true;
  function expectArrow() {
    const arrow = screen.getByTestId('arrow');
    const rect = arrow.getBoundingClientRect();
    expect(arrow).toHaveAttribute('aria-hidden', 'true');
    expect(Math.abs(rect.left + rect.width / 2 - (anchor.left + anchor.width / 2))).toBeLessThan(1);
  }
  await waitFor(expectArrow);
  first.value = false;
  offset.value = 12;
  await waitFor(() => {
    expect(screen.getByTestId('positioner').getBoundingClientRect().top).toBe(anchor.bottom + 12);
    expectArrow();
  });
});
