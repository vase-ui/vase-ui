import { describe, expect, it } from 'vitest';
import { KeepAlive, defineComponent, shallowRef } from 'vue';
import { createRenderer, describeConformance, flushMicrotasks, screen } from '#test-utils';
import DialogPopupPart from '../../../test/fixtures/DialogPopupPart.vue';
import * as Dialog from '../index.parts';
import DialogTitleReplacement from './DialogTitleReplacement.test.vue';

describe('<Dialog.Title />', () => {
  const { render } = createRenderer();

  describe('with a test popup', () => {
    describeConformance(<Dialog.Title />, () => ({
      refInstanceof: window.HTMLHeadingElement,
      render: (node) => {
        return render(
          <Dialog.Root open modal={false}>
            <DialogPopupPart>{node}</DialogPopupPart>
          </Dialog.Root>,
        );
      },
    }));
  });

  describe('aria-labelledby of the popup', () => {
    it('names the popup with the generated id of the title', async () => {
      await render(
        <Dialog.Root open modal={false}>
          <DialogPopupPart>
            <Dialog.Title data-testid="title">Title</Dialog.Title>
          </DialogPopupPart>
        </Dialog.Root>,
      );

      const title = screen.getByTestId('title');
      expect(title.id).not.toBe('');
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', title.id);
    });

    it('names the popup with the id prop of the title', async () => {
      await render(
        <Dialog.Root open modal={false}>
          <DialogPopupPart>
            <Dialog.Title id="custom-title">Title</Dialog.Title>
          </DialogPopupPart>
        </Dialog.Root>,
      );

      expect(screen.getByText('Title')).toHaveAttribute('id', 'custom-title');
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'custom-title');
    });

    it('gives the popup a name only while a title is mounted', async () => {
      const mounted = shallowRef(false);
      await render(() => (
        <Dialog.Root open modal={false}>
          <DialogPopupPart>
            {mounted.value ? <Dialog.Title data-testid="title" /> : null}
          </DialogPopupPart>
        </Dialog.Root>
      ));
      const popup = screen.getByRole('dialog');
      expect(popup).not.toHaveAttribute('aria-labelledby');

      mounted.value = true;
      await flushMicrotasks();
      expect(popup).toHaveAttribute('aria-labelledby', screen.getByTestId('title').id);

      mounted.value = false;
      await flushMicrotasks();
      expect(popup).not.toHaveAttribute('aria-labelledby');
    });

    it('VUE-45: names the last of two titles, then the title that stays when the last title unmounts', async () => {
      const secondMounted = shallowRef(true);
      await render(() => (
        <Dialog.Root open modal={false}>
          <DialogPopupPart>
            <Dialog.Title data-testid="first" />
            {secondMounted.value ? <Dialog.Title data-testid="second" /> : null}
          </DialogPopupPart>
        </Dialog.Root>
      ));
      const popup = screen.getByRole('dialog');
      expect(popup).toHaveAttribute('aria-labelledby', screen.getByTestId('second').id);

      secondMounted.value = false;
      await flushMicrotasks();

      expect(popup).toHaveAttribute('aria-labelledby', screen.getByTestId('first').id);
    });

    // The compiled template of the fixture mounts the new title before it unmounts the old title.
    // A render function in TSX reuses the title component, so it does not show this order.
    it('VUE-45: names the new title when a template replaces the title', async () => {
      const { setProps } = await render(<DialogTitleReplacement first />);

      await setProps({ first: false });

      expect(screen.getByRole('dialog')).toHaveAttribute(
        'aria-labelledby',
        screen.getByText('Title 2').id,
      );
    });

    it('names the popup with the title only while KeepAlive shows the title', async () => {
      const visible = shallowRef(true);
      const App = defineComponent(() => () => (
        <Dialog.Root open modal={false}>
          <DialogPopupPart>
            <KeepAlive>{visible.value ? <Dialog.Title data-testid="title" /> : null}</KeepAlive>
          </DialogPopupPart>
        </Dialog.Root>
      ));
      await render(<App />);
      const popup = screen.getByRole('dialog');
      const title = screen.getByTestId('title');
      expect(popup).toHaveAttribute('aria-labelledby', title.id);

      visible.value = false;
      await flushMicrotasks();
      expect(popup).not.toHaveAttribute('aria-labelledby');

      visible.value = true;
      await flushMicrotasks();
      expect(screen.getByTestId('title')).toBe(title);
      expect(popup).toHaveAttribute('aria-labelledby', title.id);
    });
  });
});
