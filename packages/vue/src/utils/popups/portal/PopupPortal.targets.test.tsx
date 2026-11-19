import { describe, expect, it, onTestFinished } from 'vitest';
import {
  defineComponent,
  KeepAlive,
  nextTick,
  onMounted,
  onUnmounted,
  shallowRef,
} from 'vue';
import {
  createHeldBranch,
  createRenderer,
  describeConformance,
  hydrate,
  renderOnServer,
  screen,
} from '#test-utils';
import { usePortalFocus } from './usePortalFocus';
import PopupPortal from './PopupPortal.vue';
import PopupPortalBareHydration from './PopupPortalBareHydration.test.vue';

const HYDRATION_FILE = 'src/utils/popups/portal/PopupPortalBareHydration.test.vue';

function addContainer() {
  const container = document.createElement('div');
  document.body.append(container);
  onTestFinished(() => container.remove());
  return container;
}

describe('FloatingPortalLite', () => {
  const { render } = createRenderer();

  describeConformance(<PopupPortal />, () => ({
    elementIsRoot: false,
    render,
    refInstanceof: window.HTMLDivElement,
  }));

  it('renders the portal element in the body, with an id and the portal attribute', async () => {
    await render(
      <PopupPortal data-testid="portal">
        <div data-testid="content" />
      </PopupPortal>,
    );

    const portal = screen.getByTestId('portal');
    expect(portal.parentElement).toBe(document.body);
    expect(portal).toContainElement(screen.getByTestId('content'));
    expect(portal).toHaveAttribute('data-vase-ui-portal', '');
    expect(portal.id).not.toBe('');
  });

  it('lets an id attribute replace the generated id of the portal element', async () => {
    await render(<PopupPortal id="custom-portal" data-testid="portal" />);

    expect(screen.getByTestId('portal')).toHaveAttribute('id', 'custom-portal');
  });

  describe('prop: to', () => {
    it('VUE-168: renders the portal element in a target selected by CSS', async () => {
      const target = addContainer();
      target.id = 'popup-target';
      await render(<PopupPortal to="#popup-target" data-testid="portal">content</PopupPortal>);
      expect(screen.getByTestId('portal').parentNode).toBe(target);
    });

    it('renders the portal element in a shadow root', async () => {
      const shadowRoot = addContainer().attachShadow({ mode: 'open' });

      await render(<PopupPortal to={shadowRoot} data-testid="portal" />);

      expect(shadowRoot.querySelector('[data-testid="portal"]')?.parentNode).toBe(shadowRoot);
    });

    it('renders no portal element while the container is null', async () => {
      const container = addContainer();
      const view = await render(<PopupPortal to={null} data-testid="portal" />);
      expect(screen.queryByTestId('portal')).toBe(null);

      await view.setProps({ to: container });
      expect(screen.getByTestId('portal').parentElement).toBe(container);

      await view.setProps({ to: null });
      expect(screen.queryByTestId('portal')).toBe(null);
    });

    it('VUE-20: moves the portal element with its content when the container changes', async () => {
      const first = addContainer();
      const second = addContainer();
      const counts = { mounted: 0, unmounted: 0 };
      const Content = defineComponent({
        setup() {
          onMounted(() => {
            counts.mounted += 1;
          });
          onUnmounted(() => {
            counts.unmounted += 1;
          });
          return () => <div data-testid="content" />;
        },
      });
      const view = await render(
        <PopupPortal to={first} data-testid="portal">
          <Content />
        </PopupPortal>,
      );
      const portal = screen.getByTestId('portal');
      expect(portal.parentElement).toBe(first);

      await view.setProps({ to: second });
      expect(screen.getByTestId('portal')).toBe(portal);
      expect(portal.parentElement).toBe(second);

      await view.setProps({ to: undefined });
      expect(screen.getByTestId('portal')).toBe(portal);
      expect(portal.parentElement).toBe(document.body);
      expect(counts).toEqual({ mounted: 1, unmounted: 0 });
    });


  });

  describe('portal above', () => {
    it.each<{ name: string; hasContainer: boolean }>([
      { name: 'it has no container', hasContainer: false },
      { name: 'it has a container', hasContainer: true },
    ])(
      'renders in the container, or else in the portal element above, when $name',
      async ({ hasContainer }) => {
        const container = addContainer();

        await render(
          <PopupPortal guards={usePortalFocus} data-testid="above">
            <PopupPortal
              to={hasContainer ? container : undefined}
              data-testid="portal"
            />
          </PopupPortal>,
        );

        expect(screen.getByTestId('portal').parentElement).toBe(
          hasContainer ? container : screen.getByTestId('above'),
        );
      },
    );

    it('VUE-167: nests a guard-free portal in the nearest portal', async () => {
      await render(
        <PopupPortal data-testid="outer">
          <PopupPortal data-testid="inner" />
        </PopupPortal>,
      );

      expect(screen.getByTestId('inner').parentElement).toBe(screen.getByTestId('outer'));
    });
  });

  it('VUE-5: takes the portal element out of the document while KeepAlive holds the part, and puts the same element back', async () => {
    const Page = defineComponent({
      name: 'Page',
      setup: () => () => (
        <PopupPortal data-testid="portal">
          <input data-testid="input" />
        </PopupPortal>
      ),
    });
    const Other = defineComponent({ name: 'Other', setup: () => () => <p /> });
    const showPage = shallowRef(true);
    await render(() => (
      <KeepAlive>{showPage.value ? <Page key="page" /> : <Other key="other" />}</KeepAlive>
    ));
    const portal = screen.getByTestId('portal');
    const input = screen.getByTestId<HTMLInputElement>('input');
    input.value = 'typed';
    input.focus();
    expect(portal.parentElement).toBe(document.body);
    expect(document.activeElement).toBe(input);

    showPage.value = false;
    await nextTick();

    expect(portal.isConnected).toBe(false);
    expect(input.isConnected).toBe(false);
    expect(document.activeElement).toBe(document.body);

    showPage.value = true;
    await nextTick();

    expect(screen.getByTestId('portal')).toBe(portal);
    expect(portal.parentElement).toBe(document.body);
    expect(screen.getByTestId('input')).toBe(input);
    expect(input.value).toBe('typed');
  });

  it('VUE-5: keeps the portal element out of the document when the part mounts while KeepAlive holds its branch', async () => {
    const counts = { mounted: 0, unmounted: 0 };
    const Content = defineComponent({
      name: 'Content',
      setup() {
        onMounted(() => {
          counts.mounted += 1;
        });
        onUnmounted(() => {
          counts.unmounted += 1;
        });
        return () => <div data-testid="content" />;
      },
    });
    const { HeldBranch, hide, mountWhileHeld, show } = createHeldBranch(() => (
      <PopupPortal data-testid="portal">
        <Content />
      </PopupPortal>
    ));
    await render(() => <HeldBranch />);

    await mountWhileHeld();

    expect(screen.queryByTestId('portal')).toBe(null);
    expect(counts).toEqual({ mounted: 1, unmounted: 0 });

    await show();

    const portal = screen.getByTestId('portal');
    expect(portal.parentElement).toBe(document.body);
    expect(portal).toContainElement(screen.getByTestId('content'));

    await hide();

    expect(portal.isConnected).toBe(false);

    await show();

    expect(screen.getByTestId('portal')).toBe(portal);
    expect(portal.parentElement).toBe(document.body);
    expect(counts).toEqual({ mounted: 1, unmounted: 0 });
  });

  describe('hydration', () => {
    it('renders no portal element on a server, and hydrates with no message', async () => {
      const serverHtml = await renderOnServer(HYDRATION_FILE);
      expect(serverHtml).not.toContain('data-vase-ui-portal');
      expect(serverHtml).not.toContain('content');

      await hydrate(PopupPortalBareHydration, { serverHtml });

      const portal = screen.getByTestId('portal');
      expect(portal.parentElement).toBe(screen.getByTestId('target'));
      expect(portal).toContainElement(screen.getByTestId('content'));
    });
  });
});
