import { describe, expect, it } from 'vitest';
import { defineComponent, KeepAlive, onMounted, shallowRef } from 'vue';
import type { VNode } from 'vue';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  positionerConformanceTests,
  screen,
  waitFor,
} from '#test-utils';
import ComboboxTriggerPart from '../../../test/fixtures/ComboboxTriggerPart.vue';
import { getScrollLockRegistry } from '../../../test/fixtures/scrollDocument';
import type { OffsetFunction } from '../../internals/useAnchorPositioning';
import * as Combobox from '../index.parts';

describe('<Combobox.Positioner />', () => {
  const { render } = createRenderer();

  it('should not lock body scroll when controlled value={[]} triggers a re-render', async () => {
    document.body.removeAttribute('style');
    document.documentElement.removeAttribute('style');

    const Test = defineComponent(() => {
      const renderCount = shallowRef(0);
      onMounted(() => {
        renderCount.value = 1;
      });

      return () => (
        <Combobox.Root multiple value={[]}>
          <Combobox.Input data-render={renderCount.value} />
          <Combobox.Portal>
            <Combobox.Positioner />
          </Combobox.Portal>
        </Combobox.Root>
      );
    });

    const { unmount } = await render(<Test />);

    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });

    const bodyOverflowX = document.body.style.overflowX;
    const bodyOverflowY = document.body.style.overflowY;
    const htmlOverflowX = document.documentElement.style.overflowX;
    const htmlOverflowY = document.documentElement.style.overflowY;

    unmount();
    document.body.removeAttribute('style');
    document.documentElement.removeAttribute('style');

    expect(bodyOverflowX).not.toBe('hidden');
    expect(bodyOverflowY).not.toBe('hidden');
    expect(htmlOverflowX).not.toBe('hidden');
    expect(htmlOverflowY).not.toBe('hidden');
  });

  describeConformance(<Combobox.Positioner />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(
        <Combobox.Root open>
          <Combobox.Portal>{node}</Combobox.Portal>
        </Combobox.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));

  positionerConformanceTests({
    render,
    stableState: false,
    createComponent: ({
      root,
      trigger,
      positioner: { render: renderPositioner, ...positioner },
      popup,
    }) => (
      <Combobox.Root {...root}>
        <Combobox.Input {...trigger} />
        <Combobox.Portal>
          <Combobox.Positioner
            {...positioner}
            v-slots={renderPositioner ? { render: renderPositioner } : undefined}
          >
            <Combobox.Popup {...popup}>Popup</Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ),
  });

  describe('the anchor', () => {
    it.each([
      {
        name: 'the input with no input group',
        inputInPopup: false,
        content: (positioner: VNode) => (
          <>
            <Combobox.Input data-testid="anchor" style={{ width: '120px' }} />
            <ComboboxTriggerPart style={{ width: '240px' }}>Open</ComboboxTriggerPart>
            {positioner}
          </>
        ),
      },
      {
        name: 'the input group',
        inputInPopup: false,
        content: (positioner: VNode) => (
          <>
            <Combobox.InputGroup data-testid="anchor" style={{ width: '240px' }}>
              <Combobox.Input style={{ width: '120px' }} />
            </Combobox.InputGroup>
            {positioner}
          </>
        ),
      },
      {
        name: 'the trigger for an input in the popup',
        inputInPopup: true,
        content: (positioner: VNode) => (
          <>
            <ComboboxTriggerPart data-testid="anchor" style={{ width: '200px' }}>
              Open
            </ComboboxTriggerPart>
            {positioner}
          </>
        ),
      },
    ])('anchors to $name', async ({ inputInPopup, content }) => {
      let anchorWidth = 0;
      const recordAnchorWidth: OffsetFunction = (data) => {
        anchorWidth = data.anchor.width;
        return 0;
      };

      await render(
        <Combobox.Root open>
          {content(
            <Combobox.Portal>
              <Combobox.Positioner sideOffset={recordAnchorWidth}>
                <Combobox.Popup>
                  {inputInPopup ? <Combobox.Input /> : null}
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>,
          )}
        </Combobox.Root>,
      );

      const { width } = screen.getByTestId('anchor').getBoundingClientRect();
      await waitFor(() => {
        expect(anchorWidth).toBeCloseTo(width, 0);
      });
    });
  });

  it('writes the side of the popup to the input', async () => {
    await render(
      <Combobox.Root open>
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner side="right">
            <Combobox.Popup />
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('input')).toHaveAttribute('data-popup-side', 'right');
    });
  });

  it.each([
    { name: 'no items', items: [], empty: true },
    { name: 'an item', items: ['Apple'], empty: false },
  ])('sets data-empty to $empty for $name', async ({ items, empty }) => {
    await render(
      <Combobox.Root open items={items}>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner data-testid="positioner">
            <Combobox.Popup />
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );
    await flushMicrotasks();

    expect(screen.getByTestId('positioner').hasAttribute('data-empty')).toBe(empty);
  });

  describe('prop: modal', () => {
    function renderModal(shown = shallowRef(true)) {
      return render(() => (
        <KeepAlive>
          {shown.value ? (
            <Combobox.Root key="root" modal defaultOpen>
              <Combobox.Input data-testid="input" />
              <Combobox.Portal>
                <Combobox.Positioner data-testid="positioner">
                  <Combobox.Popup />
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          ) : null}
        </KeepAlive>
      ));
    }

    it('renders a backdrop with a cutout of the input before the positioner', async () => {
      await renderModal();
      await flushMicrotasks();

      const backdrop = screen.getByTestId('positioner').previousElementSibling as HTMLElement;
      expect(backdrop).toHaveAttribute('role', 'presentation');
      expect(backdrop).toHaveAttribute('data-vase-ui-inert');
      const { left, top } = screen.getByTestId('input').getBoundingClientRect();
      expect(backdrop.style.clipPath).toContain(`${left}px ${top}px`);
    });

    it('locks the scroll of the page while the popup is open', async () => {
      await renderModal();

      await waitFor(() => {
        expect(getScrollLockRegistry()?.lockCount).toBe(1);
      });
    });

    it('releases the scroll lock while KeepAlive holds it, and takes it back', async () => {
      const shown = shallowRef(true);
      await renderModal(shown);
      await waitFor(() => {
        expect(getScrollLockRegistry()?.lockCount).toBe(1);
      });

      shown.value = false;
      await flushMicrotasks();

      expect(getScrollLockRegistry()?.lockCount).toBe(0);

      shown.value = true;
      await waitFor(() => {
        expect(getScrollLockRegistry()?.lockCount).toBe(1);
      });
    });
  });
});
