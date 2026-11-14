import { describe, expect, it, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import { Menu } from '@vase-ui/vue/menu';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  isJSDOM,
  screen,
  waitFor,
} from '#test-utils';
import { createMenuStoreProbe } from '../../../test/fixtures/MenuStoreProbe';
import { REASONS } from '../../internals/reasons';

describe('<Menu.LinkItem />', () => {
  const { render } = createRenderer();

  describeConformance(<Menu.LinkItem />, () => ({
    refInstanceof: window.HTMLAnchorElement,
    render: (node) => {
      return render(<Menu.Root open>{node}</Menu.Root>);
    },
  }));

  describe('rendering links', () => {
    // A link of a router: it changes the location and does not load a page.
    const location = shallowRef('/');
    const Link = defineComponent({
      inheritAttrs: false,
      props: { to: { type: String, required: true } },
      setup(props, { attrs, slots }) {
        return () => (
          <a
            {...attrs}
            href={props.to}
            onClick={(event: MouseEvent) => {
              event.preventDefault();
              location.value = props.to;
            }}
          >
            {slots.default?.()}
          </a>
        );
      },
    });

    it.skipIf(isJSDOM)('react-router <Link> activates with Enter and Space', async () => {
      location.value = '/';
      const { user } = await render(() => (
        <div>
          <div data-testid="location">{location.value}</div>
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.LinkItem
                    v-slots={{
                      render: ({ props }: { props: Record<string, unknown> }) => (
                        <Link {...props} to="/">
                          link 1
                        </Link>
                      ),
                    }}
                  />
                  <Menu.LinkItem
                    v-slots={{
                      render: ({ props }: { props: Record<string, unknown> }) => (
                        <Link {...props} to="/two">
                          link 2
                        </Link>
                      ),
                    }}
                  />
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      ));

      const [link1, link2] = screen.getAllByRole('menuitem');
      const locationDisplay = screen.getByTestId('location');
      expect(locationDisplay).toHaveTextContent('/');

      link2.focus();
      await waitFor(() => {
        expect(link2).toHaveFocus();
      });
      await user.keyboard('[Enter]');
      expect(locationDisplay).toHaveTextContent('/two');

      link1.focus();
      await waitFor(() => {
        expect(link1).toHaveFocus();
      });
      await user.keyboard('[Enter]');
      expect(locationDisplay).toHaveTextContent('/');

      link2.focus();
      await waitFor(() => {
        expect(link2).toHaveFocus();
      });
      await user.keyboard('[Space]');
      expect(locationDisplay).toHaveTextContent('/two');

      link1.focus();
      await waitFor(() => {
        expect(link1).toHaveFocus();
      });
      await user.keyboard('[Space]');
      expect(locationDisplay).toHaveTextContent('/');
    });
  });

  describe('attributes and state', () => {
    it('is a link with the menuitem role, and it is highlighted with the active index', async () => {
      const probe = createMenuStoreProbe();
      await render(
        <Menu.Root open>
          <probe.Probe />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.LinkItem href="#profile">Profile</Menu.LinkItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );
      const link = screen.getByRole('menuitem', { name: 'Profile' });
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', '#profile');
      expect(link).toHaveAttribute('tabindex', '-1');
      expect(link).not.toHaveAttribute('data-highlighted');

      probe.store.setActiveIndex(0, REASONS.keyboard);
      await flushMicrotasks();

      expect(link).toHaveAttribute('data-highlighted');
      expect(link).toHaveAttribute('tabindex', '0');
    });
  });

  describe('prop: closeOnClick', () => {
    it.each([
      { name: 'does not close', closeOnClick: undefined, open: true },
      { name: 'closes', closeOnClick: true, open: false },
    ])('$name the menu when it is clicked', async ({ closeOnClick, open }) => {
      const onOpenChange = vi.fn();
      const { user } = await render(
        <Menu.Root defaultOpen onOpenChange={onOpenChange}>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.LinkItem href="#profile" closeOnClick={closeOnClick}>
                  Profile
                </Menu.LinkItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      await user.click(screen.getByRole('menuitem'));

      if (open) {
        expect(onOpenChange).not.toHaveBeenCalled();
        expect(screen.queryByRole('menu')).not.toBe(null);
      } else {
        await waitFor(() => {
          expect(screen.queryByRole('menu')).toBe(null);
        });
        expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.itemPress);
      }
    });
  });
});
