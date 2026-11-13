import { describe, expect, it, vi } from 'vitest';
import { defineComponent, onMounted } from 'vue';
import { createRenderer, screen } from '#test-utils';
import * as Dialog from '../index.parts';

const DETACHED_WARNING = 'no root that uses this handle is mounted';

describe('<Dialog.Root />', () => {
  const { render } = createRenderer();

  describe('handle-backed root ownership', () => {
    type NumberPayload = { payload: number | undefined };

    it('opens from a descendant layout effect on initial mount', async () => {
      const handle = Dialog.createHandle();
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const OpenOnMount = defineComponent({
        setup() {
          onMounted(() => {
            handle.open(null);
          });
          return () => null;
        },
      });

      await render(() => (
        <Dialog.Root handle={handle}>
          <OpenOnMount />
        </Dialog.Root>
      ));

      const detachedWarned = consoleWarn.mock.calls.some(
        ([message]) => typeof message === 'string' && message.includes(DETACHED_WARNING),
      );
      consoleWarn.mockRestore();

      expect(detachedWarned).toBe(false);
      expect(handle.isOpen).toBe(true);
    });

    it('opens with a payload from a descendant layout effect on initial mount', async () => {
      const handle = Dialog.createHandle<number>();
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const OpenOnMount = defineComponent({
        setup() {
          onMounted(() => {
            handle.openWithPayload(8);
          });
          return () => null;
        },
      });

      await render(() => (
        <Dialog.Root handle={handle}>
          {{
            default: ({ payload }: NumberPayload) => (
              <>
                <span data-testid="payload">{payload ?? 'No payload'}</span>
                <OpenOnMount />
              </>
            ),
          }}
        </Dialog.Root>
      ));

      const detachedWarned = consoleWarn.mock.calls.some(
        ([message]) => typeof message === 'string' && message.includes(DETACHED_WARNING),
      );
      consoleWarn.mockRestore();

      expect(detachedWarned).toBe(false);
      expect(handle.isOpen).toBe(true);
      expect(screen.getByTestId('payload').textContent).toBe('8');
    });

    it('closes from a descendant layout effect on an initially open root', async () => {
      const handle = Dialog.createHandle();
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const CloseOnMount = defineComponent({
        setup() {
          onMounted(() => {
            handle.close();
          });
          return () => null;
        },
      });

      await render(() => (
        <Dialog.Root handle={handle} defaultOpen>
          <CloseOnMount />
        </Dialog.Root>
      ));

      const detachedWarned = consoleWarn.mock.calls.some(
        ([message]) => typeof message === 'string' && message.includes(DETACHED_WARNING),
      );
      consoleWarn.mockRestore();

      expect(detachedWarned).toBe(false);
      expect(handle.isOpen).toBe(false);
    });

    it('ignores openWithPayload() after the root unmounts and keeps the remounted root without payload', async () => {
      const handle = Dialog.createHandle<number>();

      const App = defineComponent(
        (props: { mounted: boolean }) => () =>
          props.mounted ? (
            <Dialog.Root handle={handle}>
              {{
                default: ({ payload }: NumberPayload) => (
                  <span data-testid="payload">{payload ?? 'No payload'}</span>
                ),
              }}
            </Dialog.Root>
          ) : null,
        { props: ['mounted'] },
      );

      const { setProps } = await render(<App mounted />);
      await setProps({ mounted: false });

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        handle.openWithPayload(8);
        expect(
          consoleWarn.mock.calls.filter(
            ([message]) =>
              typeof message === 'string' &&
              message.includes('openWithPayload() was called while no root that uses this handle'),
          ),
        ).toHaveLength(1);
      } finally {
        consoleWarn.mockRestore();
      }
      expect(handle.isOpen).toBe(false);

      await setProps({ mounted: true });
      expect(handle.isOpen).toBe(false);
      expect(screen.getByTestId('payload').textContent).toBe('No payload');
    });
  });
});
