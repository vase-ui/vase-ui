import { describe, expect, test } from 'vitest';
import { defineComponent, onMounted, shallowRef, watch } from 'vue';
import { createRenderer, flushMicrotasks, screen } from '#test-utils';
import FloatingPortalLite from './FloatingPortalLite.vue';

describe('FloatingPortal', () => {
  const { render } = createRenderer();

  test('FloatingPortalLite forwards HTML props to the portal element', async () => {
    await render(
      <FloatingPortalLite data-testid="lite-portal">
        <div />
      </FloatingPortalLite>,
    );

    await flushMicrotasks();

    const portal = document.querySelector('[data-testid="lite-portal"]');
    expect(portal).not.toBeNull();
  });
});

describe.each([{ name: 'FloatingPortalLite', Portal: FloatingPortalLite }])(
  '$name container resolution',
  ({ Portal }) => {
    const { render: renderPortal } = createRenderer();

    test.each([
      { ancestor: true, strict: false },
      { ancestor: false, strict: false },
    ])(
      'mounts directly inside a ref attached later in the commit (ancestor=$ancestor, strict=$strict)',
      async ({ ancestor }) => {
        const parents = new Set<ParentNode | null>();
        function addParents(records: MutationRecord[]) {
          for (const { addedNodes, target } of records) {
            for (const node of addedNodes) {
              if ((node as Element).hasAttribute?.('data-vase-ui-portal')) {
                parents.add(target as ParentNode);
              }
            }
          }
        }
        const observer = new MutationObserver(addParents);
        observer.observe(document.body, { childList: true, subtree: true });

        const Test = defineComponent({
          setup() {
            const container = shallowRef<HTMLDivElement | null>(null);
            return () => {
              const content = (
                <Portal container={container}>
                  <div data-testid="content" />
                </Portal>
              );
              return ancestor ? (
                <div ref={container} data-testid="container">
                  {content}
                </div>
              ) : (
                <>
                  {content}
                  <div ref={container} data-testid="container" />
                </>
              );
            };
          },
        });

        await renderPortal(<Test />);
        addParents(observer.takeRecords());
        observer.disconnect();

        const container = screen.getByTestId('container');
        expect(container).toContainElement(screen.getByTestId('content'));
        // The portal must never mount in the fallback container, even temporarily.
        expect(parents).toEqual(new Set([container]));
      },
    );

    test('mounts inside an ancestor ref before the next paint', async () => {
      const visible = shallowRef(false);
      const Content = defineComponent({
        setup() {
          const container = shallowRef<HTMLDivElement | null>(null);
          return () => (
            <div ref={container} data-testid="container">
              <Portal container={container}>
                <div data-testid="content" />
              </Portal>
            </div>
          );
        },
      });

      const Test = defineComponent({ setup: () => () => (visible.value ? <Content /> : null) });

      await renderPortal(<Test />);
      expect(screen.queryByTestId('container')).toBe(null);

      // Both callbacks run in one frame with a microtask checkpoint between them, so the second
      // one sees the DOM that the browser paints after the update.
      const mountedBeforePaint = await new Promise<boolean>((resolve) => {
        requestAnimationFrame(() => {
          visible.value = true;
        });
        requestAnimationFrame(() => {
          resolve(screen.getByTestId('container').contains(screen.queryByTestId('content')));
        });
      });

      expect(mountedBeforePaint).toBe(true);
    });

    test('mounts deeply nested portals inside their ancestor refs', async () => {
      const Nested = defineComponent({
        props: { remaining: { type: Number, required: true } },
        setup(props) {
          const container = shallowRef<HTMLDivElement | null>(null);
          return () => (
            <div ref={container} data-testid="nested-container">
              <Portal container={container} data-testid="nested-portal">
                {props.remaining > 1 ? (
                  <Nested remaining={props.remaining - 1} />
                ) : (
                  <div data-testid="leaf" />
                )}
              </Portal>
            </div>
          );
        },
      });

      await renderPortal(<Nested remaining={18} />);

      expect(screen.getByTestId('leaf')).toBeInTheDocument();
      expect(screen.getAllByTestId('nested-portal').map((node) => node.parentElement)).toEqual(
        screen.getAllByTestId('nested-container'),
      );
    });

    test('batches sibling portals without adding commits for each container ref', async () => {
      let commitCount = 0;
      const observer = new MutationObserver(() => {
        commitCount += 1;
      });
      observer.observe(document.body, { childList: true, subtree: true });

      const Item = defineComponent({
        setup() {
          const container = shallowRef<HTMLDivElement | null>(null);
          return () => (
            <div ref={container} data-testid="container">
              <Portal container={container}>
                <div data-testid="content" />
              </Portal>
            </div>
          );
        },
      });

      const Test = defineComponent({
        props: { count: { type: Number, required: true } },
        setup(props) {
          return () => Array.from({ length: props.count }, (_, index) => <Item key={index} />);
        },
      });

      const { unmount } = await renderPortal(<Test count={1} />);
      expect(screen.getByTestId('container')).toContainElement(screen.getByTestId('content'));
      const singlePortalCommitCount = commitCount;
      expect(singlePortalCommitCount).toBeGreaterThan(0);
      unmount();
      await flushMicrotasks();
      commitCount = 0;

      await renderPortal(<Test count={20} />);

      expect(screen.getAllByTestId('content')).toHaveLength(20);
      expect(
        screen.getAllByTestId('content').map((node) => node.parentElement?.parentElement),
      ).toEqual(screen.getAllByTestId('container'));
      expect(commitCount).toBe(singlePortalCommitCount);
      observer.disconnect();
    });

    // The row `nested: true` needs `FloatingPortal` as the parent of the portal.
    test.each([{ nested: false }])(
      'uses the fallback container when a ref stays empty (nested=$nested)',
      async () => {
        const container = shallowRef<HTMLDivElement | null>(null);

        await renderPortal(
          <Portal container={container} data-testid="portal">
            <div data-testid="content" />
          </Portal>,
        );

        expect(screen.getByTestId('portal').parentElement).toBe(document.body);
        expect(document.body).toContainElement(screen.getByTestId('content'));
      },
    );

    test.each([{ clear: false }, { clear: true }])(
      'cancels a queued container check when the container prop changes (clear=$clear)',
      async ({ clear }) => {
        const firstContainer = shallowRef<HTMLDivElement | null>(null);
        const secondContainer = shallowRef<HTMLDivElement | null>(null);

        const Test = defineComponent({
          setup() {
            const step = shallowRef(0);

            function advance() {
              if (step.value < 2) {
                step.value += 1;
              }
            }
            onMounted(advance);
            watch(step, advance, { flush: 'post' });

            return () => {
              const nextContainer = clear ? null : secondContainer.value;
              return (
                <>
                  <Portal
                    container={step.value < 2 ? firstContainer : nextContainer}
                    data-testid="portal"
                  >
                    <div data-testid="content" />
                  </Portal>
                  <div ref={firstContainer} data-testid="first" />
                  <div ref={secondContainer} data-testid="second" />
                </>
              );
            };
          },
        });

        await renderPortal(<Test />);

        // Vue 3.5.12 leaves an empty text node in the old target of a `Teleport`.
        expect(screen.getByTestId('first').innerHTML).toBe('');
        expect(screen.queryByTestId('portal')?.parentElement ?? null).toBe(
          clear ? null : screen.getByTestId('second'),
        );
      },
    );
  },
);
