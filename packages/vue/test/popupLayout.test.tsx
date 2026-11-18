import { expect, it, onTestFinished } from 'vitest';
import { KeepAlive, nextTick, shallowRef } from 'vue';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  isVaporApp,
  screen,
  waitSingleFrame,
} from '#test-utils';
import { Menu } from '@vase-ui/vue/menu';
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
import { Popover } from '@vase-ui/vue/popover';
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
    await nextTick();
    expect(positioner).toHaveAttribute('hidden');
    expect(positioner.style.height).toBe('');
    expect(screen.getByTestId('popup').style.getPropertyValue('--transform-origin')).toBe('');
    width.value = 240;
    open.value = true;
    await waitSingleFrame();
    expect(positioner).not.toHaveAttribute('hidden');
    expect(parseFloat(positioner.dataset.width ?? '')).toBeGreaterThan(200);
    expect(positioner.dataset.width).toBe(positioner.style.getPropertyValue('--anchor-width'));
    expect(positioner.dataset.origin).toMatch(/px|%/);
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

it('measures the active viewport after switching back to a cached viewport', async () => {
  const page = shallowRef('first');
  await render(() => (
    <Popover.Root defaultOpen defaultTriggerId="anchor">
      <Popover.Trigger id="anchor">Open</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner data-testid="positioner">
          <Popover.Popup>
            <KeepAlive>
              {page.value === 'plain' ? (
                <div>Plain content</div>
              ) : (
                <Popover.Viewport key={page.value}>
                  <div style={{ width: page.value === 'first' ? '120px' : '180px' }} />
                </Popover.Viewport>
              )}
            </KeepAlive>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  ));
  const { style } = screen.getByTestId('positioner');
  await waitSingleFrame();
  expect(style.getPropertyValue('--positioner-width')).toBe('120px');

  page.value = 'second';
  await waitSingleFrame();
  expect(style.getPropertyValue('--positioner-width')).toBe('180px');

  page.value = 'first';
  await waitSingleFrame();
  expect(style.getPropertyValue('--positioner-width')).toBe('120px');

  page.value = 'plain';
  await waitSingleFrame();
  expect(style.getPropertyValue('--positioner-width')).toBe('');
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
