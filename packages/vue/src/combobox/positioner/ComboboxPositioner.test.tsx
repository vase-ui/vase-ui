import { describe, expect, it } from 'vitest';
import { defineComponent, KeepAlive, nextTick, onMounted, shallowRef } from 'vue';
import type { VNode } from 'vue';
import { Combobox } from '@vase-ui/vue/combobox';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  isJSDOM,
  positionerConformanceTests,
  screen,
  waitFor,
} from '#test-utils';
import { isScrollLocked } from '../../../test/fixtures/scrollDocument';
import type { OffsetFunction } from '../../internals/useAnchorPositioning';
import ComboboxPositionerScoped from './ComboboxPositionerScoped.test.vue';

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
        <Combobox.Root multiple modelValue={[]}>
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

  // https://github.com/mui/base-ui/issues/5118
  it.skipIf(isJSDOM)(
    'keeps the popup on the preferred side when its capped height fits below tall content',
    async () => {
      const items = Array.from({ length: 40 }, (_, index) => `item-${index}`);

      await render(
        // Anchor fixed near the bottom of the viewport: less room below than above,
        // but still more than the List's capped height.
        <div style={{ position: 'fixed', bottom: '120px', left: '100px' }}>
          <Combobox.Root open items={items}>
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner data-testid="positioner" side="bottom" sideOffset={0}>
                <Combobox.Popup>
                  <Combobox.List
                    style={{ maxHeight: 'min(80px, var(--available-height))', overflowY: 'auto' }}
                  >
                    {{
                      item: ({ item }: { item: string }) => (
                        <Combobox.Item key={item} value={item} style={{ height: '30px' }}>
                          {item}
                        </Combobox.Item>
                      ),
                    }}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </div>,
      );

      // The 40-item list (~1200px) overflows the room below the anchor, but the List is
      // capped to 80px which fits. The `--available-height` var must be seeded before
      // `size()` runs, otherwise `min(80px, var(--available-height))` is invalid on the
      // first `flip()` pass, the list is measured at full height, and the popup flips up.
      await waitFor(() => {
        expect(screen.getByTestId('positioner')).toHaveAttribute('data-side', 'bottom');
      });
    },
  );

  describe.skipIf(isJSDOM)('default anchor', () => {
    it('uses the input when input group is absent', async () => {
      const inputWidth = 120;
      const triggerWidth = 240;
      let anchorWidth = 0;
      const recordAnchorWidth: OffsetFunction = (data) => {
        anchorWidth = data.anchor.width;
        return 0;
      };

      await render(
        <Combobox.Root open>
          <Combobox.Input style={{ width: `${inputWidth}px` }} />
          <Combobox.Trigger style={{ width: `${triggerWidth}px` }}>Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner sideOffset={recordAnchorWidth}>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="One">One</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      await waitFor(() => {
        expect(anchorWidth).toBeCloseTo(
          screen.getByRole('combobox').getBoundingClientRect().width,
          0,
        );
      });
      expect(anchorWidth).not.toBeCloseTo(triggerWidth, 0);
    });

    it('uses the input group when present', async () => {
      const inputGroupWidth = 240;
      const inputWidth = 120;
      let anchorWidth = 0;
      const recordAnchorWidth: OffsetFunction = (data) => {
        anchorWidth = data.anchor.width;
        return 0;
      };

      await render(
        <Combobox.Root open>
          <Combobox.InputGroup style={{ width: `${inputGroupWidth}px` }}>
            <Combobox.Input style={{ width: `${inputWidth}px` }} />
            <Combobox.Trigger>Open</Combobox.Trigger>
          </Combobox.InputGroup>
          <Combobox.Portal>
            <Combobox.Positioner sideOffset={recordAnchorWidth}>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="One">One</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      await waitFor(() => {
        expect(anchorWidth).toBeCloseTo(inputGroupWidth, 0);
      });
    });
  });

  describe('the anchor', () => {
    it.each([
      {
        name: 'the input with no input group',
        inputInPopup: false,
        content: (positioner: VNode) => (
          <>
            <Combobox.Input data-testid="anchor" style={{ width: '120px' }} />
            <Combobox.Trigger style={{ width: '240px' }}>Open</Combobox.Trigger>
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
            <Combobox.Trigger data-testid="anchor" style={{ width: '200px' }}>
              Open
            </Combobox.Trigger>
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
                <Combobox.Popup>{inputInPopup ? <Combobox.Input /> : null}</Combobox.Popup>
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

  it('writes the side of a popup that flips to the input', async () => {
    await render(
      <div style={{ position: 'fixed', bottom: '0px', left: '0px' }}>
        <Combobox.Root open>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner side="bottom">
              <Combobox.Popup style={{ height: '100px' }} />
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </div>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('input')).toHaveAttribute('data-popup-side', 'top');
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

  describe('VUE-61: the positioner of a modal combobox has one root node', () => {
    it('gives the scope id, v-show and a custom directive of the consumer to the positioner', async () => {
      const shown = shallowRef(true);
      await render(() => <ComboboxPositionerScoped shown={shown.value} />);
      const positioner = screen.getByTestId('positioner');

      expect(positioner.previousElementSibling).toHaveAttribute('role', 'presentation');
      expect(getComputedStyle(positioner).outlineStyle).toBe('dashed');
      expect(positioner).toHaveAttribute('data-mark', 'marked');
      expect(positioner.style.display).not.toBe('none');

      shown.value = false;
      await nextTick();

      expect(positioner.style.display).toBe('none');
    });
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
        expect(isScrollLocked()).toBe(true);
      });
    });

    it('does not lock the scroll of the page for a popup that is not modal', async () => {
      await render(
        <Combobox.Root defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup />
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );
      // The positioner writes the side in the flush that also takes the lock of a modal popup.
      await waitFor(() => {
        expect(screen.getByTestId('input')).toHaveAttribute('data-popup-side', 'bottom');
      });

      expect(isScrollLocked()).toBe(false);
    });

  });
});
