import { describe, expect, it } from 'vitest';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
} from '#test-utils';
import * as NavigationMenu from '../index.parts';

describe('<NavigationMenu.Viewport />', () => {
  const { render } = createRenderer();

  describeConformance(<NavigationMenu.Viewport />, () => ({
    refInstanceof: window.HTMLDivElement,
    childrenSelector: 'div',
    render(node) {
      return render(<NavigationMenu.Root>{node}</NavigationMenu.Root>);
    },
  }));

  function renderMenu(viewportProps: Record<string, unknown> = {}) {
    return render(
      <NavigationMenu.Root>
        <NavigationMenu.List>
          <NavigationMenu.Item value="one">
            <NavigationMenu.Trigger data-testid="trigger">One</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#first">First link</NavigationMenu.Link>
              <NavigationMenu.Link href="#second">Second link</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
        <NavigationMenu.Viewport data-testid="viewport" {...viewportProps} />
      </NavigationMenu.Root>,
    );
  }

  function getOwner(trigger: HTMLElement) {
    return trigger.parentElement!.querySelector('[aria-owns]');
  }

  it('has an id that the owner element of the active trigger names', async () => {
    await renderMenu();
    const trigger = screen.getByTestId('trigger');
    const viewport = screen.getByTestId('viewport');
    expect(viewport.id).not.toBe('');

    await fireEvent.click(trigger);

    expect(getOwner(trigger)).toHaveAttribute('aria-owns', viewport.id);
  });

  it('takes the id of its prop', async () => {
    await renderMenu({ id: 'menu-viewport' });
    const trigger = screen.getByTestId('trigger');

    await fireEvent.click(trigger);

    expect(screen.getByTestId('viewport')).toHaveAttribute('id', 'menu-viewport');
    expect(getOwner(trigger)).toHaveAttribute('aria-owns', 'menu-viewport');
  });

  it('renders the focus guards around its content only while an item is active', async () => {
    await renderMenu();
    const viewport = screen.getByTestId('viewport');
    const target = viewport.firstElementChild!;
    expect(viewport.querySelectorAll('[data-vase-ui-focus-guard]')).toHaveLength(0);

    await fireEvent.click(screen.getByTestId('trigger'));

    const [before, middle, after] = Array.from(viewport.children);
    expect(viewport.children).toHaveLength(3);
    expect(before).toHaveAttribute('data-vase-ui-focus-guard');
    expect(middle).toBe(target);
    expect(after).toHaveAttribute('data-vase-ui-focus-guard');
    expect(target).toContainElement(screen.getByRole('link', { name: 'First link' }));
  });

  it('sends the focus from the guard before the content to the first link', async () => {
    await renderMenu();
    await fireEvent.click(screen.getByTestId('trigger'));
    const guard = screen.getByTestId('viewport').firstElementChild as HTMLElement;

    guard.focus();
    await flushMicrotasks();

    expect(screen.getByRole('link', { name: 'First link' })).toHaveFocus();
  });
});
