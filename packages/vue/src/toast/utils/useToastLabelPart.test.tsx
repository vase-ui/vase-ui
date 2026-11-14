import { expect, describe, it } from 'vitest';
import { defineComponent, h, KeepAlive, nextTick, shallowRef } from 'vue';
import type { VNode } from 'vue';
import { createRenderer, screen, takeReportedMessages } from '#test-utils';
import type { HTMLProps } from '../../internals/types';
import * as Toast from '../index.parts';
import type { ToastLabel } from '../useToastManager';
import { List, Button } from './test-utils';

interface LabelPartCase {
  name: string;
  Part: typeof Toast.Title | typeof Toast.Description;
  field: 'title' | 'description';
  attribute: string;
}

const cases: LabelPartCase[] = [
  { name: 'Toast.Title', Part: Toast.Title, field: 'title', attribute: 'aria-labelledby' },
  {
    name: 'Toast.Description',
    Part: Toast.Description,
    field: 'description',
    attribute: 'aria-describedby',
  },
];

describe('useToastLabelPart', () => {
  const { render } = createRenderer();

  describe.each(cases)('<$name />', ({ Part, field, attribute }) => {
    function renderInRoot(node: VNode, toast: Toast.Root.ToastObject = { id: 'test' }) {
      return render(
        <Toast.Provider>
          <Toast.Viewport>
            <Toast.Root toast={toast} data-testid="root">
              {node}
            </Toast.Root>
          </Toast.Viewport>
        </Toast.Provider>,
      );
    }

    async function addToastFromManager() {
      const { user } = await render(
        <Toast.Provider>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>,
      );

      await user.click(screen.getByRole('button', { name: 'add' }));
    }

    it(`renders the toast ${field} by default`, async () => {
      await addToastFromManager();

      expect(screen.getByTestId(field)).toHaveTextContent(field);
    });

    it(`adds ${attribute} to the root element`, async () => {
      await addToastFromManager();

      expect(screen.getByTestId('root')).toHaveAttribute(attribute, screen.getByTestId(field).id);
    });

    it('does not render if it has no children', async () => {
      const AddButton = defineComponent({
        setup() {
          const { add } = Toast.useToastManager();
          return () => (
            <button type="button" onClick={() => add({ [field]: undefined })}>
              add
            </button>
          );
        },
      });

      const { user } = await render(
        <Toast.Provider>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      await user.click(screen.getByRole('button', { name: 'add' }));

      expect(screen.getByTestId('root')).not.toHaveAttribute(attribute);
      expect(screen.queryByTestId(field)).toBe(null);
    });

    it('renders a numeric zero child', async () => {
      await renderInRoot(<Part>{0}</Part>);

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    describe('prop: render', () => {
      it(`renders the toast ${field} through a childless render prop`, async () => {
        await renderInRoot(<Part as="div" />, { id: 'test', [field]: 'Toast content' });

        expect(screen.getByText('Toast content')).toBeInTheDocument();
      });

      it('does not render a childless render prop when there is no content', async () => {
        await renderInRoot(
          <Part
            v-slots={{
              render: ({ props }: { props: HTMLProps }) => (
                <div {...props} data-testid="part-render" />
              ),
            }}
          />,
        );

        expect(screen.queryByTestId('part-render')).toBe(null);
        expect(screen.getByTestId('root')).not.toHaveAttribute(attribute);
      });

      it('does not render when a render function returns no element', async () => {
        await renderInRoot(<Part data-testid="part-render" v-slots={{ render: () => null }} />);

        expect(screen.getByTestId('root')).toBeInTheDocument();
        expect(screen.queryByTestId('part-render')).toBe(null);
      });
    });

    it(`clears ${attribute} from the root when the content is removed`, async () => {
      const Fixture = defineComponent({
        setup() {
          const content = shallowRef<string | null>('Toast content');
          return () => (
            <Toast.Provider>
              <Toast.Viewport>
                <Toast.Root toast={{ id: 'test' }} data-testid="root">
                  <Part
                    id="part"
                    v-slots={content.value === null ? {} : { default: () => content.value }}
                  />
                </Toast.Root>
              </Toast.Viewport>
              <button type="button" onClick={() => (content.value = null)}>
                clear
              </button>
            </Toast.Provider>
          );
        },
      });

      const { user } = await render(<Fixture />);

      const rootElement = screen.getByTestId('root');
      expect(rootElement).toHaveAttribute(attribute, 'part');

      await user.click(screen.getByRole('button', { name: 'clear' }));

      expect(screen.queryByText('Toast content')).toBe(null);
      expect(rootElement).not.toHaveAttribute(attribute);
    });

    it('does not let an older part cleanup clear a newer part', async () => {
      const parts = shallowRef<'old' | 'both' | 'new'>('old');

      await render(() => (
        <Toast.Provider>
          <Toast.Viewport>
            <Toast.Root toast={{ id: 'test' }} data-testid="root">
              {parts.value !== 'new' && (
                <Part key="old" id="old-part">
                  Old
                </Part>
              )}
              {parts.value !== 'old' && (
                <Part key="new" id="new-part">
                  New
                </Part>
              )}
            </Toast.Root>
          </Toast.Viewport>
        </Toast.Provider>
      ));

      const root = screen.getByTestId('root');
      expect(root).toHaveAttribute(attribute, 'old-part');

      parts.value = 'both';
      await nextTick();
      expect(root).toHaveAttribute(attribute, 'new-part');

      parts.value = 'new';
      await nextTick();
      expect(root).toHaveAttribute(attribute, 'new-part');
    });

    it(`renders a function ${field} and points ${attribute} at it`, async () => {
      const label: ToastLabel = () => h('strong', 'Rich content');
      await renderInRoot(<Part data-testid="part" />, { id: 'test', [field]: label });

      const part = screen.getByTestId('part');
      expect(part.innerHTML).toBe('<strong>Rich content</strong>');
      expect(screen.getByTestId('root')).toHaveAttribute(attribute, part.id);
    });

    it(`renders when the toast gets a ${field}, and stops when it loses it`, async () => {
      const toast = shallowRef<Toast.Root.ToastObject>({ id: 'test' });
      await render(() => (
        <Toast.Provider>
          <Toast.Viewport>
            <Toast.Root toast={toast.value} data-testid="root">
              <Part data-testid="part" />
            </Toast.Root>
          </Toast.Viewport>
        </Toast.Provider>
      ));

      expect(screen.queryByTestId('part')).toBe(null);
      expect(screen.getByTestId('root')).not.toHaveAttribute(attribute);

      toast.value = { id: 'test', [field]: 'Toast content' };
      await nextTick();
      expect(screen.getByTestId('root')).toHaveAttribute(attribute, screen.getByTestId('part').id);

      toast.value = { id: 'test', [field]: '' };
      await nextTick();
      expect(screen.queryByTestId('part')).toBe(null);
      expect(screen.getByTestId('root')).not.toHaveAttribute(attribute);
    });

    it(`drops ${attribute} while KeepAlive holds the part, and points it at the part again after the activation`, async () => {
      const visible = shallowRef(true);
      const Labelled = defineComponent({
        name: 'Labelled',
        setup: () => () => <Part id="part">Toast content</Part>,
      });
      const Other = defineComponent({ name: 'Other', setup: () => () => <span /> });

      await render(() => (
        <Toast.Provider>
          <Toast.Viewport>
            <Toast.Root toast={{ id: 'test' }} data-testid="root">
              <KeepAlive>
                {visible.value ? <Labelled key="labelled" /> : <Other key="other" />}
              </KeepAlive>
            </Toast.Root>
          </Toast.Viewport>
        </Toast.Provider>
      ));

      const root = screen.getByTestId('root');
      expect(root).toHaveAttribute(attribute, 'part');

      visible.value = false;
      await nextTick();
      expect(root).not.toHaveAttribute(attribute);

      visible.value = true;
      await nextTick();
      expect(root).toHaveAttribute(attribute, 'part');
    });
  });

  // These cases are the last ones of the file. In Vue 3.5.12, a `setup` that throws leaves the
  // current instance set, and a later case that renders a slot gets a warning about that slot. Each
  // case thus renders the part alone, with no slot.
  describe.each(cases)('<$name />', ({ Part }) => {
    it('throws a descriptive error when rendered outside <Toast.Root>', async () => {
      await expect(render(<Part />)).rejects.toThrow(
        'Vase UI: A part of a toast must be inside <Toast.Root>. Without a root the part has no toast to show. Put the part inside <Toast.Root>.',
      );

      expect(takeReportedMessages()).toEqual([
        expect.stringContaining('Unhandled error during execution of setup function'),
      ]);
    });
  });
});
