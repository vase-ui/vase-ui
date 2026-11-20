import { expect, it, onTestFinished } from 'vitest';
import { nextTick, shallowRef } from 'vue';
import {
  createRenderer,
  fireEvent,
  isVaporApp,
  screen,
  waitFor,
  waitSingleFrame,
} from '#test-utils';
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
import { recordStyleProperty } from './recordStyleProperty';
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
    await render(() => <SelectLayout open={open.value} aligned={aligned} width={width.value} />);
    const positioner = screen.getByTestId('positioner');

    function expectPlacement() {
      const trigger = screen.getByTestId('trigger').getBoundingClientRect();
      if (aligned) {
        const value = screen.getByTestId('value').getBoundingClientRect();
        const item = screen.getByTestId('selected').getBoundingClientRect();
        expect(Math.abs(item.right - value.right)).toBeLessThan(1);
        expect(Math.abs(item.top + item.height / 2 - value.top - value.height / 2)).toBeLessThan(1);
      } else {
        const box = positioner.getBoundingClientRect();
        expect(Math.abs(box.right - trigger.right)).toBeLessThan(1);
        expect(Math.abs(box.top - trigger.bottom)).toBeLessThan(1);
      }
    }

    open.value = true;
    await waitSingleFrame();

    expectPlacement();
    expect(positioner.dataset.side).toBe(aligned ? 'none' : 'bottom');
    expect(parseFloat(positioner.dataset.width ?? '')).toBeGreaterThan(100);
    expect(positioner.dataset.width).toBe(positioner.style.getPropertyValue('--anchor-width'));
    expect(positioner.dataset.origin).toMatch(/px|%/);
    expect(positioner.dataset.origin).toBe(positioner.style.getPropertyValue('--transform-origin'));
    if (aligned) {
      expect(positioner.dataset.height).toMatch(/px$/);
      expect(parseFloat(positioner.dataset.height ?? '')).toBeCloseTo(
        parseFloat(positioner.style.height),
        3,
      );
    }

    open.value = false;
    await nextTick();
    expect(positioner).toHaveAttribute('hidden');
    expect(positioner.style.height).toBe('');
    expect(screen.getByTestId('popup').style.getPropertyValue('--transform-origin')).toBe('');
    width.value = 240;
    open.value = true;
    await waitSingleFrame();
    expectPlacement();
    expect(positioner).not.toHaveAttribute('hidden');
    expect(parseFloat(positioner.dataset.width ?? '')).toBeGreaterThan(200);
    expect(positioner.dataset.width).toBe(positioner.style.getPropertyValue('--anchor-width'));
    expect(positioner.dataset.origin).toMatch(/px|%/);
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
