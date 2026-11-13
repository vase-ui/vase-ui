import { expect, describe, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
import { createRenderer, describeConformance, screen } from '#test-utils';

// A link component of a router renders one `a` element and takes the `href` from a prop.
const RouterLinkLike = defineComponent({
  props: { to: { type: String, required: true } },
  setup(props, { slots }) {
    return () => <a href={props.to}>{slots.default?.()}</a>;
  },
});

describe('<NavigationMenu.Link />', () => {
  const { render } = createRenderer();

  describeConformance(<NavigationMenu.Link />, () => ({
    refInstanceof: window.HTMLAnchorElement,
    render(node) {
      return render(
        <NavigationMenu.Root>
          <NavigationMenu.List>{node}</NavigationMenu.List>
        </NavigationMenu.Root>,
      );
    },
  }));

  describe('prop: active', () => {
    it('when `true`, renders with aria-current="page"', async () => {
      await render(
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Link href="#" active>
                active
              </NavigationMenu.Link>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>,
      );
      expect(screen.getByRole('link', { name: 'active' })).toHaveAttribute('aria-current', 'page');
    });

    it('when `false`, does not render with aria-current="page"', async () => {
      await render(
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Link href="#" active={false}>
                inactive
              </NavigationMenu.Link>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>,
      );
      expect(screen.getByRole('link', { name: 'inactive' })).not.toHaveAttribute('aria-current');
    });
  });

  describe('attributes', () => {
    it('has data-active only when active', async () => {
      await render(
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Link href="#active" active>
                Active
              </NavigationMenu.Link>
            </NavigationMenu.Item>
            <NavigationMenu.Item>
              <NavigationMenu.Link href="#inactive">Inactive</NavigationMenu.Link>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>,
      );

      expect(screen.getByRole('link', { name: 'Active' })).toHaveAttribute('data-active');
      expect(screen.getByRole('link', { name: 'Inactive' })).not.toHaveAttribute('data-active');
    });

    it('has no tabindex, so each link is a tab stop of the page', async () => {
      await render(
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Link href="#one">One</NavigationMenu.Link>
            </NavigationMenu.Item>
            <NavigationMenu.Item>
              <NavigationMenu.Link href="#two">Two</NavigationMenu.Link>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>,
      );

      expect(screen.getByRole('link', { name: 'One' })).not.toHaveAttribute('tabindex');
      expect(screen.getByRole('link', { name: 'Two' })).not.toHaveAttribute('tabindex');
    });
  });

  describe('link press', () => {
    it('closes the menu with the reason link-press when closeOnClick is set', async () => {
      const handleValueChange = vi.fn();
      const handleUpdateValue = vi.fn();
      const { user } = await render(
        <NavigationMenu.Root
          defaultValue="item-1"
          onValueChange={handleValueChange}
          onUpdate:value={handleUpdateValue}
        >
          <NavigationMenu.List>
            <NavigationMenu.Item value="item-1">
              <NavigationMenu.Link href="#close" closeOnClick>
                Close
              </NavigationMenu.Link>
              <NavigationMenu.Icon data-testid="icon" />
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>,
      );
      expect(screen.getByTestId('icon')).toHaveAttribute('data-popup-open');

      await user.click(screen.getByRole('link', { name: 'Close' }));

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(handleValueChange.mock.calls[0][0]).toBe(null);
      expect(handleValueChange.mock.calls[0][1].reason).toBe('link-press');
      expect(handleUpdateValue).toHaveBeenCalledExactlyOnceWith(null);
      expect(screen.getByTestId('icon')).not.toHaveAttribute('data-popup-open');
    });

    it('does not close the menu when closeOnClick is not set', async () => {
      const handleValueChange = vi.fn();
      const { user } = await render(
        <NavigationMenu.Root defaultValue="item-1" onValueChange={handleValueChange}>
          <NavigationMenu.List>
            <NavigationMenu.Item value="item-1">
              <NavigationMenu.Link href="#stay">Stay</NavigationMenu.Link>
              <NavigationMenu.Icon data-testid="icon" />
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>,
      );

      await user.click(screen.getByRole('link', { name: 'Stay' }));

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(screen.getByTestId('icon')).toHaveAttribute('data-popup-open');
    });

    it('closes a nested root and the root above it', async () => {
      const handleOuterChange = vi.fn();
      const handleInnerChange = vi.fn();
      const { user } = await render(
        <NavigationMenu.Root defaultValue="outer" onValueChange={handleOuterChange}>
          <NavigationMenu.List>
            <NavigationMenu.Item value="outer">
              <NavigationMenu.Root defaultValue="inner" onValueChange={handleInnerChange}>
                <NavigationMenu.List>
                  <NavigationMenu.Item value="inner">
                    <NavigationMenu.Link href="#nested" closeOnClick>
                      Nested
                    </NavigationMenu.Link>
                  </NavigationMenu.Item>
                </NavigationMenu.List>
              </NavigationMenu.Root>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>,
      );

      await user.click(screen.getByRole('link', { name: 'Nested' }));

      expect(handleInnerChange).toHaveBeenCalledTimes(1);
      expect(handleInnerChange.mock.calls[0][0]).toBe(null);
      expect(handleInnerChange.mock.calls[0][1].reason).toBe('link-press');
      expect(handleOuterChange).toHaveBeenCalledTimes(1);
      expect(handleOuterChange.mock.calls[0][0]).toBe(null);
      expect(handleOuterChange.mock.calls[0][1].reason).toBe('link-press');
    });
  });

  describe('prop: as', () => {
    it('renders one a element when `as` is a component that renders an a', async () => {
      const { container } = await render(
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Link as={RouterLinkLike} {...{ to: '/about' }} active>
                About
              </NavigationMenu.Link>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>,
      );

      expect(container.querySelectorAll('a')).toHaveLength(1);
      const link = screen.getByRole('link', { name: 'About' });
      expect(link).toHaveAttribute('href', '/about');
      expect(link).toHaveAttribute('aria-current', 'page');
      expect(link).toHaveAttribute('data-active');
    });

    it('renders the same element when the #render slot renders that component', async () => {
      const { container } = await render(
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Link
                active
                v-slots={{
                  render: ({ props }: { props: Record<string, unknown> }) => (
                    <RouterLinkLike {...props} to="/about">
                      About
                    </RouterLinkLike>
                  ),
                }}
              />
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>,
      );

      expect(container.querySelectorAll('a')).toHaveLength(1);
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/about');
      expect(link).toHaveAttribute('aria-current', 'page');
      expect(link).toHaveAttribute('data-active');
    });
  });
});
