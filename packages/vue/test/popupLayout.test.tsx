import { describe, expect, it, onTestFinished } from 'vitest';
import { defineComponent, nextTick, onMounted, shallowRef } from 'vue';
import type { VNode } from 'vue';
import {
  createRenderer,
  fireEvent,
  isVaporApp,
  screen,
  waitFor,
  waitSingleFrame,
} from '#test-utils';
import { Autocomplete } from '@vase-ui/vue/autocomplete';
import { Combobox } from '@vase-ui/vue/combobox';
import { ContextMenu } from '@vase-ui/vue/context-menu';
import { Menu } from '@vase-ui/vue/menu';
import { Menubar } from '@vase-ui/vue/menubar';
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
import { PreviewCard } from '@vase-ui/vue/preview-card';
import { Select } from '@vase-ui/vue/select';
import { Toast } from '@vase-ui/vue/toast';
import { Tooltip } from '@vase-ui/vue/tooltip';
import { recordStyleProperty } from './recordStyleProperty';
import { scaleOrigin } from './scaleOrigin';
import SelectLayout from './fixtures/SelectLayout.vue';
import VaporPopupLayout from './fixtures/VaporPopupLayout.vue';

const { render } = createRenderer();

it.each([true, false])(
  'publishes the first Select frame at zoom in RTL with item alignment %s',
  async (aligned) => {
    const style = document.documentElement.style;
    const zoom = style.zoom;
    style.zoom = '0.9';
    onTestFinished(() => {
      style.zoom = zoom;
    });
    const open = shallowRef(false);
    const width = shallowRef(160);
    await render(() => (
      <SelectLayout open={open.value} aligned={aligned} width={width.value} inPlace />
    ));
    const positioner = () => screen.getByTestId('positioner');

    function expectPlacement() {
      const trigger = screen.getByTestId('trigger').getBoundingClientRect();
      if (aligned) {
        const value = screen.getByTestId('value').getBoundingClientRect();
        const item = screen.getByTestId('selected').getBoundingClientRect();
        expect(Math.abs(item.right - value.right)).toBeLessThan(1);
        expect(Math.abs(item.top + item.height / 2 - value.top - value.height / 2)).toBeLessThan(1);
      } else {
        const box = positioner().getBoundingClientRect();
        expect(Math.abs(box.right - trigger.right)).toBeLessThan(1);
        expect(Math.abs(box.top - trigger.bottom)).toBeLessThan(1);
      }
    }

    open.value = true;
    // The positioner is hidden until its first place.
    await waitFor(() => expect(positioner().style.opacity).toBe(''));

    expectPlacement();
    expect(positioner().dataset.side).toBe(aligned ? 'none' : 'bottom');
    expect(parseFloat(positioner().dataset.width ?? '')).toBeGreaterThan(100);
    expect(positioner().dataset.width).toBe(positioner().style.getPropertyValue('--anchor-width'));
    expect(positioner().dataset.origin).toMatch(/px|%/);
    expect(positioner().dataset.origin).toBe(
      positioner().style.getPropertyValue('--transform-origin'),
    );
    if (aligned) {
      expect(positioner().dataset.height).toMatch(/px$/);
      expect(parseFloat(positioner().dataset.height ?? '')).toBeCloseTo(
        parseFloat(positioner().style.height),
        3,
      );
    }

    open.value = false;
    await nextTick();
    expect(screen.getByTestId('popup')).not.toBeVisible();
    expect(positioner().style.pointerEvents).toBe('none');
    width.value = 240;
    open.value = true;
    await waitSingleFrame();
    expectPlacement();
    expect(screen.getByTestId('popup')).toBeVisible();
    expect(parseFloat(positioner().dataset.width ?? '')).toBeGreaterThan(200);
    expect(positioner().dataset.width).toBe(positioner().style.getPropertyValue('--anchor-width'));
    expect(positioner().dataset.origin).toMatch(/px|%/);
  },
);

it('updates the positioner when the controlled Navigation Menu value changes', async () => {
  const active = shallowRef('one');
  await render(() => (
    <NavigationMenu.Root modelValue={active.value}>
      <NavigationMenu.List>
        {['one', 'two'].map((value) => (
          <NavigationMenu.Item key={value} value={value}>
            <NavigationMenu.Trigger>{value}</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <div style={{ width: value === 'one' ? '120px' : '180px', height: '40px' }} />
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        ))}
      </NavigationMenu.List>
      <NavigationMenu.Portal>
        <NavigationMenu.Positioner data-testid="positioner">
          <NavigationMenu.Popup data-testid="popup" style={{ width: 'var(--popup-width)' }}>
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  ));
  const { style } = screen.getByTestId('positioner');
  await waitFor(() => expect(style.getPropertyValue('--positioner-width')).toBe('120px'));

  const popup = screen.getByTestId('popup');
  expect(popup.style.getPropertyValue('--popup-width')).toBe('');
  const widths = recordStyleProperty(popup, '--popup-width');
  active.value = 'two';
  await waitFor(() => expect(style.getPropertyValue('--positioner-width')).toBe('180px'));
  expect(widths).toContain('120px');

  active.value = 'one';
  await waitFor(() => expect(style.getPropertyValue('--positioner-width')).toBe('120px'));
});

it.runIf(isVaporApp)(
  'gives the size of the popup of a Vapor element slot to the positioner',
  async () => {
    await render(<VaporPopupLayout />);
    const positioner = screen.getByTestId('positioner');
    const popup = screen.getByTestId('popup');
    await waitSingleFrame();
    expect(positioner.style.getPropertyValue('--positioner-width')).toBe('120px');
    expect(popup.style.getPropertyValue('--popup-width')).toBe('');
    await fireEvent.click(screen.getByRole('button', { name: 'Resize' }));
    await waitFor(() =>
      expect(positioner.style.getPropertyValue('--positioner-width')).toBe('180px'),
    );
    expect(popup.style.getPropertyValue('--popup-width')).toBe('');
  },
);

describe('VUE-194: the transform origin of a popup with a margin', () => {
  const popup = { 'data-testid': 'popup', style: 'width: 120px; margin: 16px' };
  const placement = (anchor: HTMLElement) => ({
    'data-testid': 'positioner',
    anchor,
    side: 'bottom' as const,
    align: 'center' as const,
    sideOffset: 8,
  });
  const toastManager = Toast.createToastManager();
  // The toast opens after the provider mounts.
  const AnchoredToast = defineComponent({
    props: { anchor: { type: Object as () => HTMLElement, required: true } },
    setup(props) {
      const { toasts } = Toast.useToastManager();
      onMounted(async () => {
        await nextTick();
        const id = toastManager.add({
          description: 'Copied',
          timeout: 0,
          positionerProps: { anchor: props.anchor, side: 'bottom', align: 'center', sideOffset: 8 },
        });
        onTestFinished(() => toastManager.close(id));
      });
      return () => (
        <Toast.Portal>
          <Toast.Viewport>
            {toasts.value.map((toast) => (
              <Toast.Positioner key={toast.id} toast={toast} data-testid="positioner">
                <Toast.Root toast={toast} {...popup}>
                  <Toast.Description />
                </Toast.Root>
              </Toast.Positioner>
            ))}
          </Toast.Viewport>
        </Toast.Portal>
      );
    },
  });
  const families: [string, (anchor: HTMLElement) => VNode][] = [
    [
      'Tooltip',
      (anchor) => (
        <Tooltip.Root defaultOpen>
          <Tooltip.Portal>
            <Tooltip.Positioner {...placement(anchor)}>
              <Tooltip.Popup {...popup}>Tip</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ),
    ],
    [
      'Preview Card',
      (anchor) => (
        <PreviewCard.Root defaultOpen>
          <PreviewCard.Portal>
            <PreviewCard.Positioner {...placement(anchor)}>
              <PreviewCard.Popup {...popup}>Card</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      ),
    ],
    [
      'Menu',
      (anchor) => (
        <Menu.Root defaultOpen>
          <Menu.Portal>
            <Menu.Positioner {...placement(anchor)}>
              <Menu.Popup {...popup}>
                <Menu.Item>Item</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ),
    ],
    [
      'Context Menu',
      (anchor) => (
        <ContextMenu.Root defaultOpen>
          <ContextMenu.Portal>
            <ContextMenu.Positioner {...placement(anchor)}>
              <ContextMenu.Popup {...popup}>
                <ContextMenu.Item>Item</ContextMenu.Item>
              </ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ),
    ],
    [
      'a submenu of a Menubar',
      (anchor) => (
        <Menubar>
          <Menu.Root defaultOpen>
            <Menu.Trigger>File</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.SubmenuRoot defaultOpen>
                    <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
                    <Menu.Portal>
                      <Menu.Positioner {...placement(anchor)}>
                        <Menu.Popup {...popup}>
                          <Menu.Item>Item</Menu.Item>
                        </Menu.Popup>
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.SubmenuRoot>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menubar>
      ),
    ],
    [
      'Navigation Menu',
      (anchor) => (
        <NavigationMenu.Root defaultValue="one">
          <NavigationMenu.List>
            <NavigationMenu.Item value="one">
              <NavigationMenu.Trigger>One</NavigationMenu.Trigger>
              <NavigationMenu.Content>Content</NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Portal>
            <NavigationMenu.Positioner {...placement(anchor)}>
              <NavigationMenu.Popup {...popup}>
                <NavigationMenu.Viewport />
              </NavigationMenu.Popup>
            </NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>
      ),
    ],
    [
      'Select',
      (anchor) => (
        <Select.Root defaultOpen defaultValue="a">
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner {...placement(anchor)} alignItemWithTrigger={false}>
              <Select.Popup {...popup}>
                <Select.List>
                  <Select.Item value="a">
                    <Select.ItemText>A</Select.ItemText>
                  </Select.Item>
                </Select.List>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ),
    ],
    [
      'Combobox',
      (anchor) => (
        <Combobox.Root defaultOpen items={['a']}>
          <Combobox.Input aria-label="Fruit" />
          <Combobox.Portal>
            <Combobox.Positioner {...placement(anchor)}>
              <Combobox.Popup {...popup}>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item value={item}>{item}</Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ),
    ],
    [
      'Autocomplete',
      (anchor) => (
        <Autocomplete.Root defaultOpen items={['a']}>
          <Autocomplete.Input aria-label="Fruit" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner {...placement(anchor)}>
              <Autocomplete.Popup {...popup}>
                <Autocomplete.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Autocomplete.Item value={item}>{item}</Autocomplete.Item>
                    ),
                  }}
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>
      ),
    ],
    [
      'an anchored Toast',
      (anchor) => (
        <Toast.Provider toastManager={toastManager}>
          <AnchoredToast anchor={anchor} />
        </Toast.Provider>
      ),
    ],
  ];

  it.each(families)(
    '%s: the popup grows from the center of the anchor, on its edge',
    async (_, element) => {
      const anchor = document.body.appendChild(document.createElement('div'));
      anchor.style.cssText = 'position: fixed; left: 100px; top: 200px; width: 50px; height: 20px';
      onTestFinished(() => anchor.remove());
      await render(() => element(anchor));
      const positioner = () => screen.getByTestId('positioner');
      await waitFor(() => expect(positioner().style.opacity).toBe(''));
      await waitFor(() =>
        expect(positioner().style.getPropertyValue('--transform-origin')).toMatch(/px/),
      );
      const box = anchor.getBoundingClientRect();
      const origin = scaleOrigin(screen.getByTestId('popup'));
      expect(Math.abs(origin.x - (box.left + box.width / 2))).toBeLessThanOrEqual(0.5);
      expect(Math.abs(origin.y - box.bottom)).toBeLessThanOrEqual(0.5);
    },
  );
});
