import { expect, it, onTestFinished } from 'vitest';
import { shallowRef } from 'vue';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  isVaporApp,
  screen,
  waitSingleFrame,
} from '#test-utils';
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
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
    await render(() => <SelectLayout open={open.value} aligned={aligned} />);
    const positioner = screen.getByTestId('positioner');

    open.value = true;
    await waitSingleFrame();

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
    await waitSingleFrame();
    expect(positioner).toHaveAttribute('hidden');
    expect(positioner.style.height).toBe('');
    expect(screen.getByTestId('popup').style.getPropertyValue('--transform-origin')).toBe('');
  },
);

it('VUE-94: keeps the author pointer style when a hover block moves between triggers', async () => {
  const pointerEvents = shallowRef<'inherit' | 'all'>('inherit');
  await render(() => (
    <NavigationMenu.Root delay={0}>
      <NavigationMenu.List data-testid="list">
        {['One', 'Two'].map((value) => (
          <NavigationMenu.Item value={value}>
            <NavigationMenu.Trigger style={{ pointerEvents: pointerEvents.value }}>
              {value}
            </NavigationMenu.Trigger>
            <NavigationMenu.Content>{value}</NavigationMenu.Content>
          </NavigationMenu.Item>
        ))}
      </NavigationMenu.List>
      <NavigationMenu.Portal keepMounted>
        <NavigationMenu.Positioner>
          <NavigationMenu.Popup>
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  ));
  const one = screen.getByRole('button', { name: 'One' });
  const two = screen.getByRole('button', { name: 'Two' });
  await fireEvent.mouseEnter(one);
  await fireEvent.mouseMove(one);
  await flushMicrotasks();
  expect(screen.getByTestId('list').style.pointerEvents).toBe('none');
  expect(one.style.pointerEvents).toBe('inherit');
  pointerEvents.value = 'all';
  await fireEvent.mouseEnter(two);
  await fireEvent.mouseMove(two);
  await flushMicrotasks();
  expect(two.style.pointerEvents).toBe('all');
  await fireEvent.pointerDown(two);
  expect(screen.getByTestId('list').style.pointerEvents).toBe('');
  expect(one.style.pointerEvents).toBe('all');
  expect(two.style.pointerEvents).toBe('all');
});

it.runIf(isVaporApp)(
  'applies viewport dimensions to the popup of a Vapor render slot',
  async () => {
    await render(<VaporPopupLayout />);
    const positioner = screen.getByTestId('positioner');
    const popup = screen.getByTestId('popup');
    await waitSingleFrame();
    expect(positioner.style.getPropertyValue('--positioner-width')).toBe('120px');
    expect(popup.style.getPropertyValue('--popup-width')).toBe('auto');
    await fireEvent.click(screen.getByRole('button', { name: 'Resize' }));
    await waitSingleFrame();
    expect(positioner.style.getPropertyValue('--positioner-width')).toBe('180px');
    expect(popup.style.getPropertyValue('--popup-width')).toBe('auto');
  },
);
