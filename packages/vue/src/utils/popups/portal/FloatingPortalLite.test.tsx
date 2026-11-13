import { describe, expect, it, onTestFinished } from 'vitest';
import {
  defineComponent,
  KeepAlive,
  nextTick,
  onMounted,
  onUnmounted,
  provide,
  shallowRef,
  watch,
} from 'vue';
import type { ComponentPublicInstance, MaybeRefOrGetter, ShallowRef } from 'vue';
import { createRenderer, describeConformance, hydrate, renderOnServer, screen } from '#test-utils';
import { PortalContext } from './FloatingPortalContext';
import FloatingPortalLite from './FloatingPortalLite.vue';
import FloatingPortalLiteHydration from './FloatingPortalLiteHydration.test.vue';
import type { FloatingPortalContainer } from './useFloatingPortalNode';

const HYDRATION_FILE = 'src/utils/popups/portal/FloatingPortalLiteHydration.test.vue';

function addContainer() {
  const container = document.createElement('div');
  document.body.append(container);
  onTestFinished(() => container.remove());
  return container;
}

describe('FloatingPortalLite', () => {
  const { render } = createRenderer();

  describeConformance(<FloatingPortalLite />, () => ({
    render,
    refInstanceof: window.HTMLDivElement,
  }));

  it('renders the portal element in the body, with an id and the portal attribute', async () => {
    await render(
      <FloatingPortalLite data-testid="portal">
        <div data-testid="content" />
      </FloatingPortalLite>,
    );

    const portal = screen.getByTestId('portal');
    expect(portal.parentElement).toBe(document.body);
    expect(portal).toContainElement(screen.getByTestId('content'));
    expect(portal).toHaveAttribute('data-vase-ui-portal', '');
    expect(portal.id).not.toBe('');
  });

  it('lets an id attribute replace the generated id of the portal element', async () => {
    await render(<FloatingPortalLite id="custom-portal" data-testid="portal" />);

    expect(screen.getByTestId('portal')).toHaveAttribute('id', 'custom-portal');
  });

  describe('prop: container', () => {
    it.each<{
      name: string;
      toContainer: (element: HTMLElement) => MaybeRefOrGetter<FloatingPortalContainer>;
    }>([
      { name: 'an element', toContainer: (element) => element },
      { name: 'a ref', toContainer: (element) => shallowRef(element) },
      { name: 'a getter', toContainer: (element) => () => element },
    ])('renders the portal element in $name', async ({ toContainer }) => {
      const container = addContainer();

      await render(
        <FloatingPortalLite container={toContainer(container)} data-testid="portal">
          <div data-testid="content" />
        </FloatingPortalLite>,
      );

      expect(screen.getByTestId('portal').parentElement).toBe(container);
      expect(screen.getByTestId('portal')).toContainElement(screen.getByTestId('content'));
    });

    it('renders the portal element in a shadow root', async () => {
      const shadowRoot = addContainer().attachShadow({ mode: 'open' });

      await render(<FloatingPortalLite container={shadowRoot} data-testid="portal" />);

      expect(shadowRoot.querySelector('[data-testid="portal"]')?.parentNode).toBe(shadowRoot);
    });

    it('renders the portal element in the element of a component', async () => {
      const Host = defineComponent({ setup: () => () => <section data-testid="host" /> });
      const host = shallowRef<ComponentPublicInstance | null>(null);
      const Test = defineComponent({
        setup: () => () => (
          <>
            <Host ref={host} />
            <FloatingPortalLite container={host} data-testid="portal" />
          </>
        ),
      });

      await render(<Test />);

      expect(screen.getByTestId('portal').parentElement).toBe(screen.getByTestId('host'));
    });

    it('renders no portal element while the container is null', async () => {
      const container = addContainer();
      const view = await render(<FloatingPortalLite container={null} data-testid="portal" />);
      expect(screen.queryByTestId('portal')).toBe(null);

      await view.setProps({ container });
      expect(screen.getByTestId('portal').parentElement).toBe(container);

      await view.setProps({ container: null });
      expect(screen.queryByTestId('portal')).toBe(null);
    });

    it('moves the portal element with its content when the container changes', async () => {
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
        <FloatingPortalLite container={first} data-testid="portal">
          <Content />
        </FloatingPortalLite>,
      );
      const portal = screen.getByTestId('portal');
      expect(portal.parentElement).toBe(first);

      await view.setProps({ container: second });
      expect(screen.getByTestId('portal')).toBe(portal);
      expect(portal.parentElement).toBe(second);

      await view.setProps({ container: undefined });
      expect(screen.getByTestId('portal')).toBe(portal);
      expect(portal.parentElement).toBe(document.body);
      expect(counts).toEqual({ mounted: 1, unmounted: 0 });
    });

    it.each<{
      name: string;
      toContainer: (
        current: ShallowRef<HTMLElement | null>,
      ) => MaybeRefOrGetter<FloatingPortalContainer>;
    }>([
      { name: 'a ref', toContainer: (current) => current },
      { name: 'a getter', toContainer: (current) => () => current.value },
    ])('VUE-20: follows $name that gives the container', async ({ toContainer }) => {
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
      const current = shallowRef<HTMLElement | null>(null);
      await render(
        <FloatingPortalLite container={toContainer(current)} data-testid="portal">
          <Content />
        </FloatingPortalLite>,
      );
      const portal = screen.getByTestId('portal');
      expect(portal.parentElement).toBe(document.body);

      current.value = first;
      await nextTick();
      expect(portal.parentElement).toBe(first);

      current.value = second;
      await nextTick();
      expect(portal.parentElement).toBe(second);

      current.value = null;
      await nextTick();
      expect(portal.parentElement).toBe(document.body);
      expect(counts).toEqual({ mounted: 1, unmounted: 0 });
    });

    it('mounts the children once, and moves them when updates in the flush of the mount replace the container', async () => {
      const counts = { mounted: 0, unmounted: 0 };
      const connectedAtMount: (boolean | undefined)[] = [];
      const Content = defineComponent({
        setup() {
          const content = shallowRef<HTMLDivElement | null>(null);
          onMounted(() => {
            counts.mounted += 1;
            connectedAtMount.push(content.value?.isConnected);
          });
          onUnmounted(() => {
            counts.unmounted += 1;
          });
          return () => <div ref={content} data-testid="content" />;
        },
      });
      const Test = defineComponent({
        setup() {
          const container = shallowRef<HTMLDivElement | null>(null);
          const step = shallowRef(0);

          function advance() {
            if (step.value < 2) {
              step.value += 1;
            }
          }
          onMounted(advance);
          watch(step, advance, { flush: 'post' });

          return () => {
            const containerId = step.value < 2 ? 'first' : 'second';
            return (
              <>
                <FloatingPortalLite container={container} data-testid="portal">
                  <Content />
                </FloatingPortalLite>
                <div key={containerId} ref={container} data-testid={containerId} />
              </>
            );
          };
        },
      });

      await render(<Test />);

      expect(screen.getByTestId('portal').parentElement).toBe(screen.getByTestId('second'));
      expect(counts).toEqual({ mounted: 1, unmounted: 0 });
      // The update that replaces the container takes the first container out of the document
      // before the `onMounted` hooks of the children run.
      expect(connectedAtMount).toEqual([false]);
    });
  });

  describe('portal above', () => {
    // A stand-in for the portal element that a portal with focus guards provides.
    const portalNode = shallowRef<HTMLElement | null>(null);
    const PortalAbove = defineComponent({
      setup(_, { slots }) {
        provide(PortalContext, { portalNode });
        return () => slots.default?.();
      },
    });

    it.each<{ name: string; hasContainer: boolean }>([
      { name: 'it has no container', hasContainer: false },
      { name: 'it has a container', hasContainer: true },
    ])(
      'renders in the container, or else in the portal element above, when $name',
      async ({ hasContainer }) => {
        const above = addContainer();
        const container = addContainer();
        portalNode.value = above;
        onTestFinished(() => {
          portalNode.value = null;
        });

        await render(
          <PortalAbove>
            <FloatingPortalLite
              container={hasContainer ? container : undefined}
              data-testid="portal"
            />
          </PortalAbove>,
        );

        expect(screen.getByTestId('portal').parentElement).toBe(hasContainer ? container : above);
      },
    );

    it('does not give its portal element to a portal inside it', async () => {
      await render(
        <FloatingPortalLite data-testid="outer">
          <FloatingPortalLite data-testid="inner" />
        </FloatingPortalLite>,
      );

      expect(screen.getByTestId('inner').parentElement).toBe(document.body);
    });
  });

  it('VUE-5: takes the portal element out of the document while KeepAlive holds the part, and puts the same element back', async () => {
    const Page = defineComponent({
      name: 'Page',
      setup: () => () => (
        <FloatingPortalLite data-testid="portal">
          <input data-testid="input" />
        </FloatingPortalLite>
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

  describe('hydration', () => {
    it('renders no portal element on a server, and hydrates with no message', async () => {
      const serverHtml = await renderOnServer(HYDRATION_FILE);
      expect(serverHtml).not.toContain('data-vase-ui-portal');
      expect(serverHtml).not.toContain('content');

      await hydrate(FloatingPortalLiteHydration, { serverHtml });

      // `hydrate` mounts two apps, so the document holds two portal elements.
      const portals = screen.getAllByTestId('portal');
      expect(portals).toHaveLength(2);
      for (const portal of portals) {
        expect(portal.parentElement).toBe(document.body);
        expect(portal).toContainElement(portal.querySelector('[data-testid="content"]'));
      }
    });
  });
});
