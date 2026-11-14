import { describe, expect, it } from 'vitest';
import { KeepAlive, defineComponent, shallowRef } from 'vue';
import { Dialog } from '@vase-ui/vue/dialog';
import { createRenderer, describeConformance, flushMicrotasks, screen } from '#test-utils';

describe('<Dialog.Description />', () => {
  const { render } = createRenderer();

  describeConformance(<Dialog.Description />, () => ({
    refInstanceof: window.HTMLParagraphElement,
    render: (node) => {
      return render(
        <Dialog.Root open modal={false}>
          <Dialog.Portal>
            <Dialog.Popup>{node}</Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>,
      );
    },
  }));

  describe('aria-describedby of the popup', () => {
    it('describes the popup with the generated id of the description', async () => {
      await render(
        <Dialog.Root open modal={false}>
          <Dialog.Portal>
            <Dialog.Popup>
              <Dialog.Description data-testid="description">Description</Dialog.Description>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>,
      );

      const description = screen.getByTestId('description');
      expect(description.id).not.toBe('');
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-describedby', description.id);
    });

    it('describes the popup with the id prop of the description', async () => {
      await render(
        <Dialog.Root open modal={false}>
          <Dialog.Portal>
            <Dialog.Popup>
              <Dialog.Description id="custom-description">Description</Dialog.Description>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>,
      );

      expect(screen.getByText('Description')).toHaveAttribute('id', 'custom-description');
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-describedby', 'custom-description');
    });

    it('describes the popup only while a description is mounted', async () => {
      const mounted = shallowRef(false);
      await render(() => (
        <Dialog.Root open modal={false}>
          <Dialog.Portal>
            <Dialog.Popup>
              {mounted.value ? <Dialog.Description data-testid="description" /> : null}
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));
      const popup = screen.getByRole('dialog');
      expect(popup).not.toHaveAttribute('aria-describedby');

      mounted.value = true;
      await flushMicrotasks();
      expect(popup).toHaveAttribute('aria-describedby', screen.getByTestId('description').id);

      mounted.value = false;
      await flushMicrotasks();
      expect(popup).not.toHaveAttribute('aria-describedby');
    });

    it('VUE-45: describes the popup with the last of two descriptions, then with the description that stays', async () => {
      const secondMounted = shallowRef(true);
      await render(() => (
        <Dialog.Root open modal={false}>
          <Dialog.Portal>
            <Dialog.Popup>
              <Dialog.Description data-testid="first" />
              {secondMounted.value ? <Dialog.Description data-testid="second" /> : null}
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));
      const popup = screen.getByRole('dialog');
      expect(popup).toHaveAttribute('aria-describedby', screen.getByTestId('second').id);

      secondMounted.value = false;
      await flushMicrotasks();

      expect(popup).toHaveAttribute('aria-describedby', screen.getByTestId('first').id);
    });

    it('VUE-45: describes the popup with the description that stays when the first of two descriptions unmounts', async () => {
      const firstMounted = shallowRef(true);
      await render(() => (
        <Dialog.Root open modal={false}>
          <Dialog.Portal>
            <Dialog.Popup>
              {firstMounted.value ? <Dialog.Description data-testid="first" /> : null}
              <Dialog.Description data-testid="second" />
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));
      const popup = screen.getByRole('dialog');
      expect(popup).toHaveAttribute('aria-describedby', screen.getByTestId('second').id);

      firstMounted.value = false;
      await flushMicrotasks();

      expect(popup).toHaveAttribute('aria-describedby', screen.getByTestId('second').id);
    });

    it('describes the popup with the description only while KeepAlive shows the description', async () => {
      const visible = shallowRef(true);
      const App = defineComponent(() => () => (
        <Dialog.Root open modal={false}>
          <Dialog.Portal>
            <Dialog.Popup>
              <KeepAlive>
                {visible.value ? <Dialog.Description data-testid="description" /> : null}
              </KeepAlive>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));
      await render(<App />);
      const popup = screen.getByRole('dialog');
      const description = screen.getByTestId('description');
      expect(popup).toHaveAttribute('aria-describedby', description.id);

      visible.value = false;
      await flushMicrotasks();
      expect(popup).not.toHaveAttribute('aria-describedby');

      visible.value = true;
      await flushMicrotasks();
      expect(screen.getByTestId('description')).toBe(description);
      expect(popup).toHaveAttribute('aria-describedby', description.id);
    });
  });
});
