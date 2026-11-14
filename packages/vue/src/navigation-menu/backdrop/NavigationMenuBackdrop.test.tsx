import { describe, expect, it } from 'vitest';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
} from '#test-utils';
import * as NavigationMenu from '../index.parts';

describe('<NavigationMenu.Backdrop />', () => {
  const { render } = createRenderer();

  describeConformance(<NavigationMenu.Backdrop />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<NavigationMenu.Root>{node}</NavigationMenu.Root>);
    },
  }));

  it('is hidden while the popup is not mounted, and shows with the open state while it is', async () => {
    await render(
      <NavigationMenu.Root>
        <NavigationMenu.List>
          <NavigationMenu.Item value="one">
            <NavigationMenu.Trigger data-testid="trigger">One</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#one">Link of one</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
        <NavigationMenu.Backdrop data-testid="backdrop" />
        <NavigationMenu.Portal>
          <NavigationMenu.Positioner>
            <NavigationMenu.Popup>
              <NavigationMenu.Viewport />
            </NavigationMenu.Popup>
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>,
    );
    const backdrop = screen.getByTestId('backdrop');
    expect(backdrop).toHaveAttribute('hidden');
    expect(backdrop).toHaveAttribute('role', 'presentation');
    expect(backdrop).toHaveAttribute('data-closed');
    expect(backdrop).toHaveStyle({ userSelect: 'none' });

    await fireEvent.click(screen.getByTestId('trigger'));
    await flushMicrotasks();

    expect(backdrop).not.toHaveAttribute('hidden');
    expect(backdrop).toHaveAttribute('data-open');
  });
});
