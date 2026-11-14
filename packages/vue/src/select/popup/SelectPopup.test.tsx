import { afterEach, expect, describe, it, vi } from 'vitest';
import { defineComponent, h, KeepAlive, shallowRef } from 'vue';
import type { Component, CSSProperties } from 'vue';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import { Toolbar } from '@vase-ui/vue/toolbar';
import { platform } from '../../common/platform';
import * as Select from '../index.parts';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  isJSDOM,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';

const isWebKit = platform.engine.webkit;

interface RenderArguments {
  props: Record<string, any>;
  children?: Component;
}

/**
 * Gives a part a `#render` slot whose element gets the `ref` of the part and then `act`, one time.
 * `children` renders the content of the element.
 */
function actOnElement(
  tag: string,
  act: (element: HTMLElement) => void,
  children?: (args: RenderArguments) => unknown,
) {
  let acted = false;
  return {
    render: (args: RenderArguments) =>
      h(
        tag,
        {
          ...args.props,
          ref: (element: unknown) => {
            args.props.ref(element);
            if (element && !acted) {
              acted = true;
              act(element as HTMLElement);
            }
          },
        },
        children?.(args) as any,
      ),
  };
}

describe('<Select.Popup />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.Popup />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(
        <Select.Root open>
          <Select.Portal>
            <Select.Positioner>{node}</Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));

  it('keeps arrow keys inside the popup when the trigger lives in a toolbar', async () => {
    const onToolbarKeyDown = vi.fn();
    const { user } = await render(
      <Toolbar.Root onKeydown={onToolbarKeyDown}>
        <Select.Root defaultValue="a">
          <Toolbar.Button
            v-slots={{
              render: ({ props }: { props: Record<string, unknown> }) => (
                <Select.Trigger {...props} data-testid="trigger">
                  <Select.Value />
                </Select.Trigger>
              ),
            }}
          />
          {/* Rendered inline rather than portaled, so the popup sits inside the toolbar's own
              DOM subtree and its composite key handling actually sees these events. */}
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="a">a</Select.Item>
              <Select.Item value="b">b</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Root>
        <Toolbar.Button data-testid="next">Next</Toolbar.Button>
      </Toolbar.Root>,
    );

    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    await flushMicrotasks();

    // Opening with the keyboard moves focus onto the selected item inside the popup.
    await user.keyboard('{Enter}');
    await screen.findByRole('listbox');
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'a' })).toHaveFocus();
    });

    // Enter isn't a composite key, so opening legitimately reaches the toolbar.
    onToolbarKeyDown.mockClear();

    // A horizontal toolbar navigates with ArrowRight. While the select popup owns focus that key
    // belongs to the popup, so it must not bubble out and move focus off the toolbar button.
    await user.keyboard('{ArrowRight}');

    expect(onToolbarKeyDown).not.toHaveBeenCalled();
    expect(screen.getByTestId('next')).not.toHaveFocus();
  });

  it('moves focus into the items when the boundary item is already highlighted', async () => {
    const { user } = await render(
      <Select.Root defaultValue="a">
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <button type="button">Select all</button>
              <Select.List>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );

    screen.getByTestId('trigger').focus();
    await flushMicrotasks();
    await user.keyboard('[Enter]');

    const a = await screen.findByRole('option', { name: 'a' });
    await waitFor(() => expect(a).toHaveAttribute('data-highlighted'));
    screen.getByRole('button', { name: 'Select all' }).focus();
    await flushMicrotasks();
    expect(a).toHaveAttribute('data-highlighted');

    await user.keyboard('[ArrowDown]');
    await waitFor(() => expect(a).toHaveFocus());

    await user.keyboard('[ArrowDown]');
    await waitFor(() => expect(screen.getByRole('option', { name: 'b' })).toHaveFocus());
  });

  it('has aria attributes when no Select.List is present', async () => {
    const { user } = await render(
      <Select.Root multiple>
        <Select.Trigger>Trigger</Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup data-testid="popup">Popup</Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );

    const trigger = screen.getByRole('combobox');

    expect(trigger).not.toHaveAttribute('aria-controls');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);

    const popup = await screen.findByTestId('popup');
    const listbox = await screen.findByRole('listbox');

    expect(popup).toBe(listbox);
    expect(popup.id).not.toBe('');
    expect(popup).toHaveAttribute('aria-multiselectable', 'true');
    expect(trigger).toHaveAttribute('aria-controls', popup.id);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
  });

  it('places aria attributes on Select.List instead if it is present', async () => {
    const { user } = await render(
      <Select.Root multiple>
        <Select.Trigger>Trigger</Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup data-testid="popup">
              <Select.List data-testid="list">
                <Select.Item value="1">Item 1</Select.Item>
                <Select.Item value="2">Item 2</Select.Item>
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );

    const trigger = screen.getByRole('combobox');

    expect(trigger).not.toHaveAttribute('aria-controls');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');

    await user.click(trigger);

    const popup = await screen.findByTestId('popup');
    const list = await screen.findByTestId('list');
    const listbox = await screen.findByRole('listbox');

    expect(list).toBe(listbox);
    expect(list).toHaveAttribute('aria-multiselectable');
    expect(popup).toHaveAttribute('role', 'presentation');
    expect(popup).not.toHaveAttribute('aria-multiselectable');
    expect(list.id).not.toBe('');
    expect(trigger).toHaveAttribute('aria-controls', list.id);
    expect(trigger).not.toHaveAttribute('aria-controls', popup.id);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
  });

  it('restores transform-related inline styles after measurement', async () => {
    let popupElement: HTMLElement | null = null;

    await render(
      <Select.Root open>
        <Select.Trigger>Trigger</Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup
              v-slots={actOnElement(
                'div',
                (node) => {
                  node.style.setProperty('transform', 'translateX(10px)');
                  node.style.setProperty('scale', '0.8');
                  node.style.setProperty('translate', '1px 2px');
                  popupElement = node;
                },
                () => (
                  <Select.Item value="1">
                    <Select.ItemText>Item 1</Select.ItemText>
                  </Select.Item>
                ),
              )}
            />
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );

    await flushMicrotasks();

    expect(popupElement).not.toBe(null);
    expect(popupElement!.style.getPropertyValue('transform')).toBe('translateX(10px)');
    expect(popupElement!.style.getPropertyValue('scale')).toBe('0.8');
    expect(popupElement!.style.getPropertyValue('translate')).toBe('1px 2px');
  });

  it.skipIf(isJSDOM)('keeps alignItemWithTrigger active at browser zoom', async () => {
    const docEl = document.documentElement;
    const previousZoom = docEl.style.zoom;

    try {
      docEl.style.zoom = '0.9';

      await render(
        <div style={{ paddingTop: '100px', paddingLeft: '10px' }}>
          <Select.Root open defaultValue="css-modules">
            <Select.Trigger data-testid="trigger" style={{ width: '108px', height: '30px' }}>
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner data-testid="positioner">
                <Select.Popup data-testid="popup" style={{ maxHeight: 'none' }}>
                  <Select.Item value="css-modules">
                    <Select.ItemText>CSS Modules</Select.ItemText>
                  </Select.Item>
                  <Select.Item value="tailwind-v4">
                    <Select.ItemText>Tailwind v4</Select.ItemText>
                  </Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </div>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('positioner')).toHaveAttribute('data-side', 'none');
      });
    } finally {
      docEl.style.zoom = previousZoom;
    }
  });

  it.skipIf(isJSDOM)('aligns the selected item with the trigger inline start in ltr', async () => {
    await render(
      <div
        dir="ltr"
        style={{
          marginLeft: '100px',
          minHeight: '600px',
          paddingTop: '96px',
        }}
      >
        <DirectionProvider direction="ltr">
          <Select.Root open defaultValue="with-longer-label">
            <Select.Trigger
              style={{
                width: '160px',
                display: 'flex',
                justifyContent: 'flex-start',
                paddingInlineStart: '12px',
                paddingInlineEnd: '28px',
              }}
            >
              <Select.Value data-testid="value">With longer label</Select.Value>
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner data-testid="positioner">
                <Select.Popup style={{ width: '180px', maxHeight: 'none' }}>
                  <Select.Item value="with-longer-label">
                    <Select.ItemText
                      data-testid="item-text"
                      style={{
                        paddingInlineStart: '24px',
                        paddingInlineEnd: '8px',
                      }}
                    >
                      With longer label
                    </Select.ItemText>
                  </Select.Item>
                  <Select.Item value="other">
                    <Select.ItemText>Other option</Select.ItemText>
                  </Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </DirectionProvider>
      </div>,
    );
    await flushMicrotasks();

    const positioner = screen.getByTestId('positioner');
    const value = screen.getByTestId('value');
    const itemText = screen.getByTestId('item-text');

    await waitFor(() => {
      expect(positioner).toHaveAttribute('data-side', 'none');
    });
    await waitFor(() => {
      expect(
        Math.abs(value.getBoundingClientRect().left - itemText.getBoundingClientRect().left),
      ).toBeLessThan(1);
    });
  });

  it.skipIf(isJSDOM)(
    'aligns the selected item with the trigger inline start in ltr when popup padding shifts the item text',
    async () => {
      await render(
        <div
          dir="ltr"
          style={{
            marginLeft: '100px',
            minHeight: '600px',
            paddingTop: '96px',
          }}
        >
          <DirectionProvider direction="ltr">
            <Select.Root open defaultValue="with-longer-label">
              <Select.Trigger
                style={{
                  width: '160px',
                  display: 'flex',
                  justifyContent: 'flex-start',
                  paddingInlineStart: '12px',
                  paddingInlineEnd: '28px',
                }}
              >
                <Select.Value data-testid="value">With longer label</Select.Value>
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner data-testid="positioner">
                  <Select.Popup
                    style={{
                      width: '220px',
                      maxHeight: 'none',
                      boxSizing: 'border-box',
                      border: '4px solid transparent',
                      paddingInlineStart: '20px',
                      paddingInlineEnd: '12px',
                    }}
                  >
                    <Select.Item value="with-longer-label">
                      <Select.ItemText
                        data-testid="item-text"
                        style={{
                          paddingInlineStart: '24px',
                          paddingInlineEnd: '8px',
                        }}
                      >
                        With longer label
                      </Select.ItemText>
                    </Select.Item>
                    <Select.Item value="other">
                      <Select.ItemText>Other option</Select.ItemText>
                    </Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </DirectionProvider>
        </div>,
      );
      await flushMicrotasks();

      const positioner = screen.getByTestId('positioner');
      const value = screen.getByTestId('value');
      const itemText = screen.getByTestId('item-text');

      await waitFor(() => {
        expect(positioner).toHaveAttribute('data-side', 'none');
      });
      await waitFor(() => {
        expect(
          Math.abs(value.getBoundingClientRect().left - itemText.getBoundingClientRect().left),
        ).toBeLessThan(1);
      });
    },
  );

  it.skipIf(isJSDOM)('aligns the selected item with the trigger inline end in rtl', async () => {
    await render(
      <div
        dir="rtl"
        style={{
          marginLeft: '100px',
          minHeight: '600px',
          paddingTop: '96px',
        }}
      >
        <DirectionProvider direction="rtl">
          <Select.Root open defaultValue="with-longer-label">
            <Select.Trigger
              style={{
                width: '160px',
                display: 'flex',
                justifyContent: 'flex-end',
                paddingInlineStart: '28px',
                paddingInlineEnd: '12px',
              }}
            >
              <Select.Value data-testid="value">With longer label</Select.Value>
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner data-testid="positioner">
                <Select.Popup style={{ width: '180px', maxHeight: 'none' }}>
                  <Select.Item value="with-longer-label">
                    <Select.ItemText
                      data-testid="item-text"
                      style={{
                        paddingInlineStart: '8px',
                        paddingInlineEnd: '24px',
                      }}
                    >
                      With longer label
                    </Select.ItemText>
                  </Select.Item>
                  <Select.Item value="other">
                    <Select.ItemText>Other option</Select.ItemText>
                  </Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </DirectionProvider>
      </div>,
    );
    await flushMicrotasks();

    const positioner = screen.getByTestId('positioner');
    const value = screen.getByTestId('value');
    const itemText = screen.getByTestId('item-text');

    await waitFor(() => {
      expect(positioner).toHaveAttribute('data-side', 'none');
    });
    await waitFor(() => {
      expect(
        Math.abs(value.getBoundingClientRect().right - itemText.getBoundingClientRect().right),
      ).toBeLessThan(1);
    });
  });

  it.skipIf(isJSDOM)(
    'aligns the popup with the trigger inline end in rtl when no selected item text is available',
    async () => {
      await render(
        <div
          dir="rtl"
          style={{
            width: '280px',
            marginLeft: '100px',
            minHeight: '600px',
            paddingTop: '96px',
          }}
        >
          <DirectionProvider direction="rtl">
            <Select.Root open>
              <Select.Trigger
                data-testid="trigger"
                style={{
                  width: '160px',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  paddingInlineStart: '28px',
                  paddingInlineEnd: '12px',
                }}
              >
                <Select.Value placeholder="اختر لهجة" />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner data-testid="positioner">
                  <Select.Popup style={{ width: '180px', maxHeight: 'none' }}>
                    <Select.Item value="with-longer-label">With longer label</Select.Item>
                    <Select.Item value="other">Other option</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </DirectionProvider>
        </div>,
      );
      await flushMicrotasks();

      const trigger = screen.getByTestId('trigger');
      const positioner = screen.getByTestId('positioner');

      await waitFor(() => {
        expect(positioner).toHaveAttribute('data-side', 'none');
      });
      await waitFor(() => {
        expect(
          Math.abs(
            trigger.getBoundingClientRect().right - positioner.getBoundingClientRect().right,
          ),
        ).toBeLessThan(1);
      });
    },
  );

  it.skipIf(isJSDOM)('keeps item text aligned with the trigger after reopening', async () => {
    function getCenterY(rect: DOMRect) {
      return rect.top + rect.height / 2;
    }

    const itemStyle: CSSProperties = {
      padding: '8px 16px 8px 10px',
      fontSize: '14px',
      lineHeight: '16px',
    };

    const { user } = await render(
      <div style={{ marginLeft: '100px', minHeight: '600px', paddingTop: '96px' }}>
        <Select.Root>
          <Select.Trigger
            data-testid="trigger"
            style={{
              boxSizing: 'border-box',
              width: '176px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              paddingInlineStart: '14px',
            }}
          >
            <Select.Value data-testid="value" placeholder="Select produce" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner data-testid="positioner">
              <Select.Popup style={{ width: '220px', maxHeight: 'none' }}>
                <Select.List style={{ paddingBlock: '4px', overflowY: 'auto' }}>
                  <Select.Group>
                    <Select.GroupLabel
                      style={{
                        padding: '8px 16px 4px 30px',
                        fontSize: '11px',
                        lineHeight: '16px',
                      }}
                    >
                      Fruits
                    </Select.GroupLabel>
                    <Select.Item value="apple" style={itemStyle}>
                      <Select.ItemText data-testid="first-item-text">Apple</Select.ItemText>
                    </Select.Item>
                    <Select.Item value="banana" style={itemStyle}>
                      <Select.ItemText data-testid="selected-item-text">Banana</Select.ItemText>
                    </Select.Item>
                  </Select.Group>
                </Select.List>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      </div>,
    );

    const trigger = screen.getByTestId('trigger');

    async function expectItemAligned(testId: string) {
      const value = screen.getByTestId('value');
      const itemText = screen.getByTestId(testId);

      await waitFor(() => {
        expect(screen.getByTestId('positioner')).toHaveAttribute('data-side', 'none');
      });
      await waitFor(() => {
        expect(
          Math.abs(
            getCenterY(value.getBoundingClientRect()) -
              getCenterY(itemText.getBoundingClientRect()),
          ),
        ).toBeLessThan(1);
      });
    }

    await user.click(trigger);
    await expectItemAligned('first-item-text');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));

    await user.click(trigger);
    await expectItemAligned('first-item-text');

    await user.click(screen.getByTestId('selected-item-text'));
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));

    await user.click(trigger);
    await expectItemAligned('selected-item-text');
  });

  describe.skipIf(isJSDOM)('rtl alignment', () => {
    const RTL_FIXTURE_OPTIONS = [
      { value: 'first', label: 'الخيار الأول' },
      { value: 'selected', label: 'الخيار المحدد' },
      { value: 'third', label: 'الخيار الثالث' },
    ];

    const RTL_FIXTURE_CSS = `
      .rtlFixtureRoot {
        width: 240px;
        margin-left: 100px;
        padding-top: 96px;
        direction: rtl;
      }

      .rtlFixtureTrigger {
        box-sizing: border-box;
        display: flex;
        justify-content: flex-end;
        height: 2.5rem;
        width: 160px;
        padding-inline-start: 28px;
        padding-inline-end: 12px;
        font-size: 1rem;
        line-height: 1.5rem;
        direction: rtl;
      }

      .rtlFixturePositioner,
      .rtlFixturePopup,
      .rtlFixtureItem {
        direction: rtl;
      }

      .rtlFixturePopup {
        box-sizing: border-box;
        min-width: var(--anchor-width);
      }

      .rtlFixturePopup[data-side='none'] {
        min-width: calc(var(--anchor-width) + 1rem);
      }

      .rtlFixtureList {
        padding-block: 0.25rem;
        max-height: var(--available-height);
      }

      .rtlFixtureItem {
        box-sizing: border-box;
        padding-block: 0.5rem;
        padding-inline-start: 1rem;
        padding-inline-end: 0.625rem;
        display: grid;
        gap: 0.5rem;
        align-items: center;
        grid-template-columns: 0.75rem 1fr;
      }

      [data-side='none'] .rtlFixtureItem {
        padding-inline-start: 3rem;
      }

      .rtlFixtureIndicator {
        grid-column: 1;
      }

      .rtlFixtureText {
        grid-column: 2;
      }
    `;

    const RtlAlignmentSelect = defineComponent({
      props: {
        defaultValue: { type: String, required: true },
        withAnchor: Boolean,
        anchorStyle: Object as () => CSSProperties,
      },
      setup(props) {
        const open = shallowRef(false);
        const anchorRef = shallowRef<HTMLDivElement | null>(null);

        return () => (
          <div
            dir="rtl"
            class="rtlFixtureRoot"
            ref={props.withAnchor ? anchorRef : undefined}
            style={props.anchorStyle}
          >
            <style>{RTL_FIXTURE_CSS}</style>
            <DirectionProvider direction="rtl">
              <Select.Root
                defaultValue={props.defaultValue}
                open={open.value}
                onOpenChange={(nextOpen: boolean) => {
                  open.value = nextOpen;
                }}
              >
                <Select.Trigger class="rtlFixtureTrigger">
                  <Select.Value
                    data-testid="value"
                    v-slots={{
                      default: ({ value }: { value: unknown }) =>
                        RTL_FIXTURE_OPTIONS.find((option) => option.value === value)?.label ??
                        'اختر',
                    }}
                  />
                </Select.Trigger>

                <Select.Portal>
                  <Select.Positioner
                    anchor={props.withAnchor ? anchorRef : undefined}
                    class="rtlFixturePositioner"
                    data-testid="positioner"
                    dir="rtl"
                    sideOffset={8}
                  >
                    <Select.Popup class="rtlFixturePopup" dir="rtl">
                      <Select.List class="rtlFixtureList">
                        {RTL_FIXTURE_OPTIONS.map(({ label, value }) => (
                          <Select.Item key={value} value={value} class="rtlFixtureItem">
                            <Select.ItemIndicator class="rtlFixtureIndicator">
                              ✓
                            </Select.ItemIndicator>
                            <Select.ItemText
                              class="rtlFixtureText"
                              data-testid={value === props.defaultValue ? 'item-text' : undefined}
                            >
                              {label}
                            </Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.List>
                    </Select.Popup>
                  </Select.Positioner>
                </Select.Portal>
              </Select.Root>
            </DirectionProvider>
          </div>
        );
      },
    });

    it('aligns the selected item with the trigger inline end on first open in the docs-style rtl layout', async () => {
      const { user } = await render(<RtlAlignmentSelect defaultValue="selected" />);

      await user.click(screen.getByRole('combobox'));

      const positioner = await screen.findByTestId('positioner');
      const value = screen.getByTestId('value');
      const itemText = screen.getByTestId('item-text');

      await waitFor(() => {
        expect(positioner).toHaveAttribute('data-side', 'none');
      });
      await waitFor(() => {
        expect(
          Math.abs(value.getBoundingClientRect().right - itemText.getBoundingClientRect().right),
        ).toBeLessThan(1);
      });
    });

    it('seeds anchor width from the custom anchor on first open', async () => {
      const { user } = await render(
        <RtlAlignmentSelect defaultValue="selected" withAnchor anchorStyle={{ width: '240px' }} />,
      );

      await user.click(screen.getByRole('combobox'));

      const positioner = await screen.findByTestId('positioner');

      await waitFor(() => {
        expect(positioner).toHaveAttribute('data-side', 'none');
      });
      await waitFor(() => {
        expect(positioner.style.getPropertyValue('--anchor-width')).toBe('240px');
      });
    });
  });

  it.skipIf(isJSDOM)(
    'keeps scrolling the aligned list at browser zoom after the popup fills the available height',
    async () => {
      const docEl = document.documentElement;
      const previousZoom = docEl.style.zoom;
      const createRect = (left: number, top: number, width: number, height: number) => ({
        x: left,
        y: top,
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        toJSON: () => ({}),
      });

      try {
        docEl.style.zoom = '0.9';

        await render(
          <div style={{ paddingTop: '100px', paddingLeft: '10px' }}>
            <Select.Root open defaultValue="item-1">
              <Select.Trigger data-testid="trigger" style={{ width: '108px', height: '30px' }}>
                <Select.Value />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner data-testid="positioner">
                  <Select.Popup data-testid="popup" style={{ maxHeight: '225.538px' }}>
                    <Select.List data-testid="list">
                      <Select.Item value="item-1">Item 1</Select.Item>
                      <Select.Item value="item-2">Item 2</Select.Item>
                    </Select.List>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>,
        );
        await flushMicrotasks();

        const positioner = screen.getByTestId('positioner');
        const list = screen.getByTestId('list');

        await waitFor(() => {
          expect(positioner).toHaveAttribute('data-side', 'none');
        });

        let scrollTop = 0;

        Object.defineProperty(positioner, 'getBoundingClientRect', {
          value: () => createRect(10, 0, 108, 202.984375),
          configurable: true,
        });
        Object.defineProperty(list, 'scrollTop', {
          configurable: true,
          get: () => scrollTop,
          set: (value: number) => {
            scrollTop = value;
          },
        });
        Object.defineProperty(list, 'scrollHeight', {
          value: 598,
          configurable: true,
        });
        Object.defineProperty(list, 'clientHeight', {
          value: 226,
          configurable: true,
        });

        positioner.style.height = '225.538px';
        positioner.style.bottom = '0px';

        list.scrollTop = 14;
        await fireEvent.scroll(list);

        await waitFor(() => {
          expect(positioner.style.height).toBe('226px');
        });
        expect(scrollTop).toBe(14);
      } finally {
        docEl.style.zoom = previousZoom;
      }
    },
  );

  it.skipIf(isJSDOM)(
    'treats short popups as top-positioned when maxScrollTop is off by 1px',
    async () => {
      const docEl = document.documentElement;
      const clientHeightDescriptor = Object.getOwnPropertyDescriptor(docEl, 'clientHeight');
      const clientWidthDescriptor = Object.getOwnPropertyDescriptor(docEl, 'clientWidth');

      const restoreDescriptor = (
        target: object,
        property: 'clientHeight' | 'clientWidth',
        descriptor: PropertyDescriptor | undefined,
      ) => {
        if (descriptor) {
          Object.defineProperty(target, property, descriptor);
        } else {
          delete (target as Record<string, unknown>)[property];
        }
      };

      const createRect = (left: number, top: number, width: number, height: number) => ({
        x: left,
        y: top,
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        toJSON: () => ({}),
      });

      try {
        Object.defineProperty(docEl, 'clientHeight', { value: 646, configurable: true });
        Object.defineProperty(docEl, 'clientWidth', { value: 300, configurable: true });

        await render(
          <Select.Root open defaultValue="1">
            <Select.Trigger
              data-testid="trigger"
              v-slots={actOnElement(
                'button',
                (node) => {
                  Object.defineProperty(node, 'offsetWidth', { value: 80, configurable: true });
                  Object.defineProperty(node, 'offsetHeight', { value: 30, configurable: true });
                  Object.defineProperty(node, 'getBoundingClientRect', {
                    value: () => createRect(10, 170.3793487548828, 80, 30),
                    configurable: true,
                  });
                },
                () => 'Trigger',
              )}
            />
            <Select.Portal>
              <Select.Positioner
                data-testid="positioner"
                v-slots={actOnElement(
                  'div',
                  (node) => {
                    Object.defineProperty(node, 'getBoundingClientRect', {
                      value: () => createRect(10, 0, 108, 63.96739196777344),
                      configurable: true,
                    });
                  },
                  () => (
                    <Select.Popup
                      data-testid="popup"
                      v-slots={actOnElement(
                        'div',
                        (node) => {
                          Object.defineProperty(node, 'scrollHeight', {
                            value: 64,
                            configurable: true,
                          });
                          Object.defineProperty(node, 'clientHeight', {
                            value: 63,
                            configurable: true,
                          });
                        },
                        () => [
                          <Select.Item value="1">Item 1</Select.Item>,
                          <Select.Item value="2">Item 2</Select.Item>,
                        ],
                      )}
                    />
                  ),
                )}
              />
            </Select.Portal>
          </Select.Root>,
        );
        await flushMicrotasks();

        const positioner = screen.getByTestId('positioner');

        // Check the side and the inset styles together so they come from the same layout pass.
        await waitFor(() => {
          expect({
            side: positioner.getAttribute('data-side'),
            hasTop: positioner.style.top !== '',
            bottom: positioner.style.bottom,
          }).toEqual({ side: 'none', hasTop: true, bottom: '' });
        });
      } finally {
        restoreDescriptor(docEl, 'clientHeight', clientHeightDescriptor);
        restoreDescriptor(docEl, 'clientWidth', clientWidthDescriptor);
      }
    },
  );

  it.skipIf(isJSDOM)(
    'keeps alignItemWithTrigger active when the aligned height is fractionally below minHeight',
    async () => {
      const docEl = document.documentElement;
      const clientHeightDescriptor = Object.getOwnPropertyDescriptor(docEl, 'clientHeight');
      const clientWidthDescriptor = Object.getOwnPropertyDescriptor(docEl, 'clientWidth');

      const restoreDescriptor = (
        target: object,
        property: 'clientHeight' | 'clientWidth',
        descriptor: PropertyDescriptor | undefined,
      ) => {
        if (descriptor) {
          Object.defineProperty(target, property, descriptor);
        } else {
          delete (target as Record<string, unknown>)[property];
        }
      };

      const createRect = (left: number, top: number, width: number, height: number) => ({
        x: left,
        y: top,
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        toJSON: () => ({}),
      });

      try {
        Object.defineProperty(docEl, 'clientHeight', { value: 646, configurable: true });
        Object.defineProperty(docEl, 'clientWidth', { value: 300, configurable: true });

        await render(
          <Select.Root open defaultValue="1">
            <Select.Trigger
              data-testid="trigger"
              v-slots={actOnElement(
                'button',
                (node) => {
                  Object.defineProperty(node, 'offsetWidth', { value: 80, configurable: true });
                  Object.defineProperty(node, 'offsetHeight', { value: 30, configurable: true });
                  Object.defineProperty(node, 'getBoundingClientRect', {
                    value: () => createRect(10, 170.3793487548828, 80, 30),
                    configurable: true,
                  });
                },
                () => 'Trigger',
              )}
            />
            <Select.Portal>
              <Select.Positioner
                data-testid="positioner"
                v-slots={actOnElement(
                  'div',
                  (node) => {
                    Object.defineProperty(node, 'getBoundingClientRect', {
                      value: () => createRect(10, 0, 108, 63.96739196777344),
                      configurable: true,
                    });
                  },
                  () => (
                    <Select.Popup
                      data-testid="popup"
                      style={{ minHeight: '65px' }}
                      v-slots={actOnElement(
                        'div',
                        (node) => {
                          Object.defineProperty(node, 'scrollHeight', {
                            value: 64,
                            configurable: true,
                          });
                          Object.defineProperty(node, 'clientHeight', {
                            value: 63,
                            configurable: true,
                          });
                        },
                        () => [
                          <Select.Item value="1">Item 1</Select.Item>,
                          <Select.Item value="2">Item 2</Select.Item>,
                        ],
                      )}
                    />
                  ),
                )}
              />
            </Select.Portal>
          </Select.Root>,
        );
        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.getByTestId('positioner')).toHaveAttribute('data-side', 'none');
        });
      } finally {
        restoreDescriptor(docEl, 'clientHeight', clientHeightDescriptor);
        restoreDescriptor(docEl, 'clientWidth', clientWidthDescriptor);
      }
    },
  );

  describe.skipIf(isJSDOM)('aligned popup scroll resizing', () => {
    const docEl = document.documentElement;
    const restores: Array<() => void> = [];

    function stubProperty(target: object, property: string, value: unknown) {
      const descriptor = Object.getOwnPropertyDescriptor(target, property);
      Object.defineProperty(target, property, { value, configurable: true });
      restores.push(() => {
        if (descriptor) {
          Object.defineProperty(target, property, descriptor);
        } else {
          delete (target as Record<string, unknown>)[property];
        }
      });
    }

    function stubRect(node: HTMLElement, left: number, top: number, width: number, height: number) {
      stubProperty(node, 'getBoundingClientRect', () => ({
        x: left,
        y: top,
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        toJSON: () => ({}),
      }));
      // Floating UI derives the element scale by comparing the rect against the offset box, so
      // both have to agree or the stubbed geometry reads back as if the page were zoomed.
      stubProperty(node, 'offsetWidth', width);
      stubProperty(node, 'offsetHeight', height);
    }

    afterEach(() => {
      while (restores.length > 0) {
        restores.pop()!();
      }
    });

    /**
     * Renders an item-aligned select whose viewport and element geometry are fully stubbed, so
     * the height-on-scroll behavior is reproducible instead of depending on the runner's window.
     */
    async function renderAligned(options: {
      viewportHeight: number;
      triggerTop: number;
      positionerHeight: number;
      listScrollHeight: number;
      listClientHeight: number;
      /** Vertical distance from the positioner top to the selected item's text. */
      selectedTextTop?: number;
      popupMaxHeight?: string;
      /** Use uncontrolled open state so the component can close itself. */
      uncontrolledOpen?: boolean;
    }) {
      const {
        viewportHeight,
        triggerTop,
        positionerHeight,
        listScrollHeight,
        listClientHeight,
        selectedTextTop,
        popupMaxHeight = 'none',
        uncontrolledOpen = false,
      } = options;

      stubProperty(docEl, 'clientHeight', viewportHeight);
      stubProperty(docEl, 'clientWidth', 400);

      let listScrollTop = 0;

      await render(
        <Select.Root
          open={uncontrolledOpen ? undefined : true}
          defaultOpen={uncontrolledOpen}
          defaultValue="selected"
        >
          <Select.Trigger
            data-testid="trigger"
            v-slots={actOnElement(
              'button',
              (node) => stubRect(node, 10, triggerTop, 80, 30),
              () => (
                <Select.Value
                  data-testid="value"
                  v-slots={actOnElement(
                    'span',
                    (node) => stubRect(node, 10, triggerTop, 60, 30),
                    ({ children: Children }) => (Children ? <Children /> : null),
                  )}
                />
              ),
            )}
          />
          <Select.Portal>
            <Select.Positioner
              data-testid="positioner"
              v-slots={actOnElement(
                'div',
                (node) => stubRect(node, 10, 0, 108, positionerHeight),
                () => (
                  <Select.Popup data-testid="popup" style={{ maxHeight: popupMaxHeight }}>
                    <Select.List
                      data-testid="list"
                      v-slots={actOnElement(
                        'div',
                        (node) => {
                          Object.defineProperty(node, 'scrollTop', {
                            configurable: true,
                            get: () => listScrollTop,
                            set: (value: number) => {
                              listScrollTop = value;
                            },
                          });
                          stubProperty(node, 'scrollHeight', listScrollHeight);
                          stubProperty(node, 'clientHeight', listClientHeight);
                        },
                        () => [
                          <Select.Item value="selected">
                            <Select.ItemText
                              data-testid="selected-text"
                              v-slots={actOnElement(
                                'div',
                                (node) => {
                                  if (selectedTextTop != null) {
                                    stubRect(node, 10, selectedTextTop, 80, 30);
                                  }
                                },
                                () => 'Selected',
                              )}
                            />
                          </Select.Item>,
                          <Select.Item value="other">
                            <Select.ItemText>Other</Select.ItemText>
                          </Select.Item>,
                        ],
                      )}
                    />
                  </Select.Popup>
                ),
              )}
            />
          </Select.Portal>
        </Select.Root>,
      );
      await flushMicrotasks();

      const positioner = screen.getByTestId('positioner');
      const list = screen.getByTestId('list');

      await waitFor(() => {
        expect(positioner).toHaveAttribute('data-side', 'none');
      });

      return {
        positioner,
        list,
        getListScrollTop: () => listScrollTop,
        setListScrollTop: (value: number) => {
          listScrollTop = value;
        },
      };
    }

    it('anchors the popup to the viewport bottom when the selection sits near the list top', async () => {
      const { positioner } = await renderAligned({
        viewportHeight: 720,
        triggerTop: 300,
        positionerHeight: 200,
        listScrollHeight: 400,
        listClientHeight: 200,
      });

      await waitFor(() => {
        expect(positioner.style.bottom).toBe('0px');
      });
      expect(positioner.style.top).toBe('');
    });

    it('grows a bottom-anchored popup as the list is scrolled and re-pins it to the top', async () => {
      const { positioner, list, getListScrollTop, setListScrollTop } = await renderAligned({
        viewportHeight: 720,
        triggerTop: 300,
        positionerHeight: 200,
        listScrollHeight: 400,
        listClientHeight: 200,
      });

      await waitFor(() => {
        expect(positioner.style.bottom).toBe('0px');
      });

      setListScrollTop(100);
      await fireEvent.scroll(list);

      // The scrolled distance is converted into extra popup height, and the list snaps back so
      // the newly revealed rows appear by growing rather than by scrolling.
      await waitFor(() => {
        expect(positioner.style.height).toBe('300px');
      });
      expect(getListScrollTop()).toBe(0);
    });

    it('consumes a sub-pixel overscroll into the popup height', async () => {
      const { positioner, list, getListScrollTop, setListScrollTop } = await renderAligned({
        viewportHeight: 720,
        triggerTop: 300,
        positionerHeight: 200,
        listScrollHeight: 400,
        listClientHeight: 200,
      });

      await waitFor(() => {
        expect(positioner.style.bottom).toBe('0px');
      });

      setListScrollTop(0.5);
      await fireEvent.scroll(list);

      await waitFor(() => {
        expect(positioner.style.height).toBe('200.5px');
      });
      expect(getListScrollTop()).toBe(0);
    });

    it('leaves the popup height alone when the list is already at the anchored edge', async () => {
      const { positioner, list, setListScrollTop } = await renderAligned({
        viewportHeight: 720,
        triggerTop: 300,
        positionerHeight: 200,
        listScrollHeight: 400,
        listClientHeight: 200,
      });

      await waitFor(() => {
        expect(positioner.style.bottom).toBe('0px');
      });

      const heightBefore = positioner.style.height;

      setListScrollTop(0);
      await fireEvent.scroll(list);

      await waitFor(() => {
        expect(positioner.style.height).toBe(heightBefore);
      });
    });

    it('grows a top-anchored popup upward and keeps the list pinned to the bottom', async () => {
      const { positioner, list, getListScrollTop, setListScrollTop } = await renderAligned({
        viewportHeight: 400,
        triggerTop: 200,
        positionerHeight: 200,
        listScrollHeight: 400,
        listClientHeight: 300,
        selectedTextTop: 300,
      });

      await waitFor(() => {
        expect(positioner.style.top).toBe('0px');
      });
      expect(positioner.style.bottom).toBe('');

      setListScrollTop(0);
      await fireEvent.scroll(list);

      await waitFor(() => {
        expect(positioner.style.height).toBe('300px');
      });
      expect(getListScrollTop()).toBe(100);
    });

    it('stops growing a top-anchored popup once it fills the available height', async () => {
      const { positioner, list, setListScrollTop } = await renderAligned({
        viewportHeight: 400,
        triggerTop: 200,
        positionerHeight: 300,
        listScrollHeight: 400,
        listClientHeight: 300,
        selectedTextTop: 300,
      });

      await waitFor(() => {
        expect(positioner.style.top).toBe('0px');
      });

      setListScrollTop(0);
      await fireEvent.scroll(list);

      // 300px of popup plus 100px of remaining scroll saturates the 380px of available height,
      // so it clamps instead of overshooting the viewport.
      await waitFor(() => {
        expect(positioner.style.height).toBe('380px');
      });

      // Once saturated, further scrolling must not keep resizing.
      setListScrollTop(50);
      await fireEvent.scroll(list);

      await waitFor(() => {
        expect(positioner.style.height).toBe('380px');
      });
    });

    it('pins a top-anchored popup that already fills the viewport to the end of the list', async () => {
      const { positioner, list, getListScrollTop, setListScrollTop } = await renderAligned({
        viewportHeight: 400,
        triggerTop: 200,
        positionerHeight: 380,
        listScrollHeight: 400,
        listClientHeight: 300,
        selectedTextTop: 300,
      });

      // A popup at least as tall as the usable viewport is flush with its top edge.
      await waitFor(() => {
        expect(positioner.style.top).toBe('0px');
      });

      const heightBefore = positioner.style.height;

      setListScrollTop(100);
      await fireEvent.scroll(list);

      await waitFor(() => {
        expect(getListScrollTop()).toBe(100);
      });
      expect(positioner.style.height).toBe(heightBefore);

      // Having reached its maximum, the popup stops taking over scrolling entirely: a later
      // sub-pixel scroll is left to the list instead of being snapped back to the edge.
      setListScrollTop(99.5);
      await fireEvent.scroll(list);

      await waitFor(() => {
        expect(positioner.style.height).toBe(heightBefore);
      });
      expect(getListScrollTop()).toBe(99.5);
    });

    it('stops resizing once a max-height constrained popup is fully grown', async () => {
      const { positioner, list, setListScrollTop } = await renderAligned({
        viewportHeight: 720,
        triggerTop: 300,
        positionerHeight: 200,
        listScrollHeight: 400,
        listClientHeight: 200,
        popupMaxHeight: '100px',
      });

      await waitFor(() => {
        expect(positioner.style.bottom).toBe('0px');
      });

      const heightBefore = positioner.style.height;

      setListScrollTop(100);
      await fireEvent.scroll(list);

      await waitFor(() => {
        expect(positioner.style.height).toBe(heightBefore);
      });
    });

    it('treats a zero max-height as unconstrained rather than collapsing the popup', async () => {
      const { positioner, list, setListScrollTop } = await renderAligned({
        viewportHeight: 720,
        triggerTop: 300,
        positionerHeight: 200,
        listScrollHeight: 400,
        listClientHeight: 200,
        popupMaxHeight: '0px',
      });

      await waitFor(() => {
        expect(positioner.style.bottom).toBe('0px');
      });

      setListScrollTop(100);
      await fireEvent.scroll(list);

      // `max-height: 0` is treated as unset, matching the margin/min-height fallbacks, so the
      // popup still grows by the scrolled distance instead of clamping to nothing.
      await waitFor(() => {
        expect(positioner.style.height).toBe('300px');
      });
    });

    it('centers the transform origin when the positioner has no measurable height', async () => {
      const { positioner } = await renderAligned({
        viewportHeight: 720,
        triggerTop: 300,
        positionerHeight: 0,
        listScrollHeight: 400,
        listClientHeight: 200,
        selectedTextTop: 100,
      });

      await waitFor(() => {
        expect(positioner.style.bottom).toBe('0px');
      });

      expect(screen.getByTestId('popup').style.getPropertyValue('--transform-origin')).toBe(
        '50% 50%',
      );
    });

    it('never applies a non-positive height when the viewport collapses below the margins', async () => {
      const { positioner, list, setListScrollTop } = await renderAligned({
        viewportHeight: 720,
        triggerTop: 300,
        positionerHeight: 200,
        listScrollHeight: 400,
        listClientHeight: 200,
      });

      await waitFor(() => {
        expect(positioner.style.bottom).toBe('0px');
      });

      const heightBefore = positioner.style.height;

      // The viewport shrinks to less than the popup's own margins after placement.
      stubProperty(docEl, 'clientHeight', 20);

      setListScrollTop(100);
      await fireEvent.scroll(list);

      await waitFor(() => {
        expect(positioner.style.height).toBe(heightBefore);
      });
    });

    // In WebKit, a pinch-zoomed popup uses the anchored placement by design.
    // https://github.com/mui/base-ui/pull/1139
    it.skipIf(isWebKit)('ignores a pinch-zoomed visual viewport outside WebKit', async () => {
      const { visualViewport } = window;
      if (visualViewport) {
        stubProperty(visualViewport, 'scale', 1.5);
      }

      const { positioner } = await renderAligned({
        viewportHeight: 720,
        triggerTop: 300,
        positionerHeight: 200,
        listScrollHeight: 400,
        listClientHeight: 200,
      });

      // Only WebKit mispositions pinch-zoomed popups, so other engines keep item alignment.
      await waitFor(() => {
        expect(positioner).toHaveAttribute('data-side', 'none');
      });
    });

    it('ignores scroll events bubbling to the popup while a Select.List owns scrolling', async () => {
      const { positioner, list, setListScrollTop } = await renderAligned({
        viewportHeight: 720,
        triggerTop: 300,
        positionerHeight: 200,
        listScrollHeight: 400,
        listClientHeight: 200,
      });

      await waitFor(() => {
        expect(positioner.style.bottom).toBe('0px');
      });

      const heightBefore = positioner.style.height;

      // Give the popup its own (different) scroll geometry so handling it would be detectable.
      const popup = screen.getByTestId('popup');
      Object.defineProperty(popup, 'scrollTop', { value: 50, configurable: true });
      Object.defineProperty(popup, 'scrollHeight', { value: 400, configurable: true });
      Object.defineProperty(popup, 'clientHeight', { value: 200, configurable: true });

      setListScrollTop(100);
      // The list, not the popup, is the scroll container here. Handling the bubbled event on the
      // popup as well would resize using the wrong element's offsets.
      await fireEvent.scroll(popup);

      await waitFor(() => {
        expect(positioner.style.height).toBe(heightBefore);
      });

      await fireEvent.scroll(list);

      await waitFor(() => {
        expect(positioner.style.height).toBe('300px');
      });
    });

    it('grows the popup when it is itself the scroll container', async () => {
      stubProperty(docEl, 'clientHeight', 720);
      stubProperty(docEl, 'clientWidth', 400);

      let popupScrollTop = 0;

      await render(
        <Select.Root open defaultValue="selected">
          <Select.Trigger
            data-testid="trigger"
            v-slots={actOnElement(
              'button',
              (node) => stubRect(node, 10, 300, 80, 30),
              () => (
                <Select.Value
                  v-slots={actOnElement(
                    'span',
                    (node) => stubRect(node, 10, 300, 60, 30),
                    ({ children: Children }) => (Children ? <Children /> : null),
                  )}
                />
              ),
            )}
          />
          <Select.Portal>
            <Select.Positioner
              data-testid="positioner"
              v-slots={actOnElement(
                'div',
                (node) => stubRect(node, 10, 0, 108, 200),
                () => (
                  <Select.Popup
                    data-testid="popup"
                    style={{ maxHeight: 'none' }}
                    v-slots={actOnElement(
                      'div',
                      (node) => {
                        Object.defineProperty(node, 'scrollTop', {
                          configurable: true,
                          get: () => popupScrollTop,
                          set: (value: number) => {
                            popupScrollTop = value;
                          },
                        });
                        stubProperty(node, 'scrollHeight', 400);
                        stubProperty(node, 'clientHeight', 200);
                      },
                      () => [
                        <Select.Item value="selected">
                          <Select.ItemText>Selected</Select.ItemText>
                        </Select.Item>,
                        <Select.Item value="other">
                          <Select.ItemText>Other</Select.ItemText>
                        </Select.Item>,
                      ],
                    )}
                  />
                ),
              )}
            />
          </Select.Portal>
        </Select.Root>,
      );
      await flushMicrotasks();

      const positioner = screen.getByTestId('positioner');
      const popup = screen.getByTestId('popup');

      await waitFor(() => {
        expect(positioner.style.bottom).toBe('0px');
      });

      popupScrollTop = 100;
      await fireEvent.scroll(popup);

      await waitFor(() => {
        expect(positioner.style.height).toBe('300px');
      });
      expect(popupScrollTop).toBe(0);
    });

    it('closes the aligned popup when the window is resized', async () => {
      const { positioner } = await renderAligned({
        viewportHeight: 720,
        triggerTop: 300,
        positionerHeight: 200,
        listScrollHeight: 400,
        listClientHeight: 200,
        uncontrolledOpen: true,
      });

      await waitFor(() => {
        expect(positioner.style.bottom).toBe('0px');
      });

      // The aligned geometry is measured once, so a resize invalidates it entirely.
      await fireEvent(window, new UIEvent('resize'));

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
    });
  });

  it('passes the keyboard close type of an item press to a finalFocus function', async () => {
    const finalFocus = vi.fn(() => true);

    const { user } = await render(
      <Select.Root>
        <Select.Trigger data-testid="trigger">Open</Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup finalFocus={finalFocus}>
              <Select.Item value="a">a</Select.Item>
              <Select.Item value="b">b</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );

    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    await flushMicrotasks();
    await user.keyboard('{ArrowDown}');
    await screen.findByRole('listbox');
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'a' })).toHaveFocus();
    });
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
    expect(finalFocus).toHaveBeenLastCalledWith('keyboard');
  });

  it('hides the native scrollbar of a popup that is placed over the trigger', async () => {
    await render(
      <div style={{ paddingTop: '200px', minHeight: '600px' }}>
        <Select.Root defaultOpen defaultValue="a">
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner data-testid="positioner">
              <Select.Popup data-testid="popup">
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      </div>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('positioner')).toHaveAttribute('data-side', 'none');
    });
    expect(screen.getByTestId('popup')).toHaveClass('vase-ui-disable-scrollbar');
    const styles = Array.from(document.querySelectorAll('style'));
    expect(
      styles.some((element) => element.textContent?.includes('.vase-ui-disable-scrollbar')),
    ).toBe(true);
  });

  it('VUE-5: closes a popup that is placed over the trigger for a window resize only while KeepAlive shows it', async () => {
    const changes: Array<[boolean, string]> = [];
    const Page = defineComponent({
      name: 'Page',
      setup() {
        return () => (
          <div style={{ paddingTop: '200px', minHeight: '600px' }}>
            <Select.Root
              defaultOpen
              defaultValue="a"
              onOpenChange={(open: boolean, details: Select.Root.OpenChangeEventDetails) => {
                changes.push([open, details.reason]);
              }}
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner data-testid="positioner">
                  <Select.Popup>
                    <Select.Item value="a">a</Select.Item>
                    <Select.Item value="b">b</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>
        );
      },
    });
    const visible = shallowRef(true);
    await render(() => (
      <KeepAlive>{visible.value ? <Page key="page" /> : <p key="other">other</p>}</KeepAlive>
    ));
    await waitFor(() => {
      expect(screen.getByTestId('positioner')).toHaveAttribute('data-side', 'none');
    });

    visible.value = false;
    await flushMicrotasks();
    await fireEvent(window, new UIEvent('resize'));
    expect(changes).toEqual([]);

    visible.value = true;
    await flushMicrotasks();
    await fireEvent(window, new UIEvent('resize'));
    expect(changes).toEqual([[false, 'window-resize']]);
  });

  it('VUE-5: keeps its open state under KeepAlive and hears no Escape while deactivated', async () => {
    const changes: Array<[boolean, string]> = [];
    const Page = defineComponent({
      name: 'Page',
      setup() {
        return () => (
          <Select.Root
            defaultOpen
            onOpenChange={(open: boolean, details: Select.Root.OpenChangeEventDetails) => {
              changes.push([open, details.reason]);
            }}
          >
            <Select.Trigger data-testid="trigger">Trigger</Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup data-testid="popup">
                  <Select.Item value="a">a</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        );
      },
    });
    const visible = shallowRef(true);
    const { user } = await render(() => (
      <KeepAlive>{visible.value ? <Page key="page" /> : <p key="other">other</p>}</KeepAlive>
    ));
    await flushMicrotasks();
    const popup = screen.getByTestId('popup');

    visible.value = false;
    await flushMicrotasks();
    expect(popup.isConnected).toBe(false);
    await user.keyboard('[Escape]');
    expect(changes).toEqual([]);

    visible.value = true;
    await flushMicrotasks();
    expect(screen.getByTestId('popup')).toBe(popup);
    expect(popup).toHaveAttribute('data-open');

    await user.keyboard('[Escape]');
    expect(changes).toEqual([[false, 'escape-key']]);
    expect(screen.getByTestId('trigger')).toHaveAttribute('aria-expanded', 'false');
  });

  // In Vue 3.5.12, a `setup` that throws leaves the current instance set, and a later slot then
  // gives a warning. The case that throws thus comes last.
  it('throws a descriptive error when rendered outside <Select.Positioner>', async () => {
    await expect(
      render(
        <Select.Root open>
          <Select.Popup />
        </Select.Root>,
      ),
    ).rejects.toThrow('Vase UI: A popup or an arrow of Select must be inside <Select.Positioner>.');
    expect(takeReportedMessages()).toHaveLength(1);
  });
});
