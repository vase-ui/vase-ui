import { expect, it, onTestFinished } from 'vitest';
import { nextTick, shallowRef } from 'vue';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  isVaporApp,
  screen,
  waitFor,
  waitSingleFrame,
} from '#test-utils';
import { Menu } from '@vase-ui/vue/menu';
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
    await render(() => <SelectLayout open={open.value} aligned={aligned} width={width.value} inPlace />);
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
    await waitFor(() => expect(positioner().style.visibility).toBe(''));

    expectPlacement();
    expect(positioner().dataset.side).toBe(aligned ? 'none' : 'bottom');
    expect(parseFloat(positioner().dataset.width ?? '')).toBeGreaterThan(100);
    expect(positioner().dataset.width).toBe(positioner().style.getPropertyValue('--anchor-width'));
    expect(positioner().dataset.origin).toMatch(/px|%/);
    expect(positioner().dataset.origin).toBe(positioner().style.getPropertyValue('--transform-origin'));
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

it('VUE-94: keeps the author pointer style when a hover block moves between triggers', async () => {
  const pointerEvents = shallowRef<'none' | 'all'>('none');
  await render(() => (
    <NavigationMenu.Root delay={0}>
      <NavigationMenu.List data-testid="list">
        {['One', 'Two'].map((value) => (
          <NavigationMenu.Item value={value}>
            <NavigationMenu.Trigger
              style={{ pointerEvents: value === 'One' ? 'all' : pointerEvents.value }}
            >
              {value}
            </NavigationMenu.Trigger>
            <NavigationMenu.Content>{value}</NavigationMenu.Content>
          </NavigationMenu.Item>
        ))}
      </NavigationMenu.List>
      <NavigationMenu.Portal keepMounted>
        <NavigationMenu.Positioner data-testid="positioner" style={{ pointerEvents: 'all' }}>
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
  expect(one.style.pointerEvents).toBe('all');
  expect(two.style.pointerEvents).toBe('none');
  expect(screen.getByTestId('positioner').style.pointerEvents).toBe('all');
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

it('VUE-94: keeps the author pointer style on the parent menu of an open submenu', async () => {
  const { user } = await render(
    <Menu.Root defaultOpen>
      <Menu.Trigger>Actions</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup data-testid="parent" style={{ pointerEvents: 'all' }}>
            <Menu.SubmenuRoot>
              <Menu.SubmenuTrigger delay={0}>More</Menu.SubmenuTrigger>
              <Menu.Portal>
                <Menu.Positioner data-testid="submenu-positioner">
                  <Menu.Popup>
                    <Menu.Item>Details</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.SubmenuRoot>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>,
  );
  const parent = screen.getByTestId('parent');
  const previousStyles: (string | null)[] = [];
  const observer = new MutationObserver((records) => {
    previousStyles.push(...records.map((record) => record.oldValue));
  });
  observer.observe(parent, {
    attributes: true,
    attributeFilter: ['style'],
    attributeOldValue: true,
  });
  onTestFinished(() => observer.disconnect());
  await user.hover(screen.getByRole('menuitem', { name: 'More' }));
  await screen.findByRole('menuitem', { name: 'Details' });
  await waitSingleFrame();
  expect(screen.getByTestId('submenu-positioner').style.pointerEvents).toBe('auto');
  expect(previousStyles.join(' ')).not.toMatch(/pointer-events:\s*none/);
  expect(parent.style.pointerEvents).toBe('all');
});

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
  await waitSingleFrame();
  expect(style.getPropertyValue('--positioner-width')).toBe('120px');

  const popup = screen.getByTestId('popup');
  await waitFor(() => expect(popup.style.getPropertyValue('--popup-width')).toBe('auto'));
  const widths = recordStyleProperty(popup, '--popup-width');
  active.value = 'two';
  await waitSingleFrame();
  expect(widths).toContain('120px');
  expect(style.getPropertyValue('--positioner-width')).toBe('180px');

  active.value = 'one';
  await waitSingleFrame();
  expect(style.getPropertyValue('--positioner-width')).toBe('120px');
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
