import { describe, expect, it, vi } from 'vitest';
import { computed, defineComponent, provide, inject, shallowRef } from 'vue';
import type { InjectionKey, Ref } from 'vue';
import * as Menu from '../index.parts';
import { createRenderer, describeConformance, flushMicrotasks, isJSDOM, screen } from '#test-utils';
import { REASONS } from '../../internals/reasons';

// A memory router: the link component writes its `to` to the location and prevents the navigation
// of the browser, as the link of a router does.
const LocationKey: InjectionKey<Ref<string>> = Symbol();

const MemoryRouter = defineComponent({
  props: { initialEntry: { type: String, required: true } },
  setup(props, { slots }) {
    provide(LocationKey, shallowRef(props.initialEntry));
    return () => slots.default?.();
  },
});

const Link = defineComponent({
  props: { to: { type: String, required: true } },
  setup(props, { slots }) {
    const location = inject(LocationKey)!;
    function navigate(event: MouseEvent) {
      event.preventDefault();
      location.value = props.to;
    }
    return () => (
      <a href={props.to} onClick={navigate}>
        {slots.default?.()}
      </a>
    );
  },
});

const Routes = defineComponent({
  setup() {
    const location = inject(LocationKey)!;
    const page = computed(() => (location.value === '/two' ? 'page two' : 'page one'));
    return () => <div>{page.value}</div>;
  },
});

const LocationDisplay = defineComponent({
  setup() {
    const location = inject(LocationKey)!;
    return () => <div data-testid="location">{location.value}</div>;
  },
});

describe('<Menu.LinkItem />', () => {
  const { render } = createRenderer();

  describeConformance(<Menu.LinkItem />, () => ({
    refInstanceof: window.HTMLAnchorElement,
    render: (node) => {
      return render(<Menu.Root open>{node}</Menu.Root>);
    },
  }));

  describe('rendering links', () => {
    it.skipIf(isJSDOM)('react-router <Link> activates with Enter and Space', async () => {
      const { user } = await render(
        <MemoryRouter initialEntry="/">
          <Routes />

          <LocationDisplay />

          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.LinkItem as={Link} {...{ to: '/' }}>
                    link 1
                  </Menu.LinkItem>
                  <Menu.LinkItem as={Link} {...{ to: '/two' }}>
                    link 2
                  </Menu.LinkItem>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </MemoryRouter>,
      );

      const [link1, link2] = screen.getAllByRole('menuitem');

      const locationDisplay = screen.getByTestId('location');

      expect(screen.getByText(/page one/i)).not.toBe(null);

      expect(locationDisplay).toHaveTextContent('/');

      link2.focus();
      await flushMicrotasks();
      expect(link2).toHaveFocus();

      await user.keyboard('[Enter]');

      expect(locationDisplay).toHaveTextContent('/two');

      expect(screen.getByText(/page two/i)).not.toBe(null);

      link1.focus();
      await flushMicrotasks();
      expect(link1).toHaveFocus();

      await user.keyboard('[Enter]');

      expect(screen.getByText(/page one/i)).not.toBe(null);

      expect(locationDisplay).toHaveTextContent('/');

      link2.focus();
      await flushMicrotasks();
      expect(link2).toHaveFocus();

      await user.keyboard('[Space]');

      expect(locationDisplay).toHaveTextContent('/two');

      expect(screen.getByText(/page two/i)).not.toBe(null);

      link1.focus();
      await flushMicrotasks();
      expect(link1).toHaveFocus();

      await user.keyboard('[Space]');

      expect(screen.getByText(/page one/i)).not.toBe(null);

      expect(locationDisplay).toHaveTextContent('/');
    });
  });

  it.each([
    { name: 'by default', closeOnClick: undefined, closes: false },
    { name: 'with closeOnClick', closeOnClick: true, closes: true },
  ])('closes the menu for a click $name only when it must', async (testCase) => {
    const onOpenChange = vi.fn();
    const { user } = await render(
      <Menu.Root defaultOpen onOpenChange={onOpenChange}>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.LinkItem
                href="#section"
                closeOnClick={testCase.closeOnClick}
                onClick={(event: MouseEvent) => event.preventDefault()}
              >
                Link
              </Menu.LinkItem>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    await user.click(screen.getByRole('menuitem'));

    if (testCase.closes) {
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.itemPress);
      expect(screen.queryByRole('menu')).toBe(null);
    } else {
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.queryByRole('menu')).not.toBe(null);
    }
  });
});
