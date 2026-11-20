import type { UserEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import type { HTMLAttributes, VNode } from 'vue';
import { createRenderer, flushMicrotasks, screen, waitFor } from '#test-utils';
import { Toast } from '@vase-ui/vue/toast';
import { useRender } from '@vase-ui/vue/use-render';
import type { VaseUIComponentProps, WithVaseUIEvent } from './types';
import { useRenderElement } from './useRenderElement';

const ID_REFERENCE_ATTRIBUTES = [
  'aria-activedescendant',
  'aria-controls',
  'aria-describedby',
  'aria-details',
  'aria-errormessage',
  'aria-flowto',
  'aria-owns',
  'for',
] as const;

type IdReferenceAttribute = (typeof ID_REFERENCE_ATTRIBUTES)[number];

const partReferences = Object.fromEntries(
  ID_REFERENCE_ATTRIBUTES.map((attribute) => [attribute, `part-${attribute}`]),
);

const getAttributes = vi.fn<(attrs: Record<string, any>) => void>();

const Part = defineComponent(
  (props: VaseUIComponentProps<object> & WithVaseUIEvent<HTMLAttributes>) => {
    const { elementProps } = useRenderElement('div', props, {
      props: (attrs) => {
        getAttributes(attrs);
        return [partReferences, attrs];
      },
    });
    return () => h('div', elementProps());
  },
  { props: ['as'], inheritAttrs: false },
);

const Note = defineComponent(
  (props: VaseUIComponentProps<object> & WithVaseUIEvent<HTMLAttributes>) => {
    const { elementProps, tag } = useRender(props, {
      props: (attrs) => [{ role: 'note', 'aria-describedby': 'note-text' }, attrs],
    });
    return () => h(tag.value, elementProps());
  },
  { props: ['as'], inheritAttrs: false },
);

interface Row {
  // The part that gets the blank attribute of the consumer.
  part: string;
  // The attribute of the consumer that would replace the value of the part.
  attribute: IdReferenceAttribute;
  // The node gives `attrs`, the attributes of the consumer, to the part under test.
  createNode: (attrs: Record<string, string>) => VNode;
  // The element that the part refers to. The default is the element with the test id `target`.
  getTarget?: () => HTMLElement;
  // The step that makes the part write the attribute, for a part that the render does not show.
  show?: (user: UserEvent) => Promise<void>;
}

const BLANKS = [
  { blank: 'an empty value', value: '' },
  { blank: 'white space', value: '\n\t ' },
];

// The input then has virtual focus on the first item.
async function highlightFirstItem(user: UserEvent) {
  screen.getByTestId('part').focus();
  await flushMicrotasks();
  await user.keyboard('[ArrowDown]');
  await flushMicrotasks();
}

const rows: Row[] = [
  {
    part: 'Toast.Root',
    attribute: 'aria-describedby',
    createNode: (attrs) => (
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root
            toast={{ id: 'test', title: 'Saved', description: 'Copied' }}
            data-testid="part"
            {...attrs}
          >
            <Toast.Title />
            <Toast.Description data-testid="target" />
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>
    ),
  },
];

describe('VUE-110: a blank ID reference attribute of the consumer', () => {
  const { render } = createRenderer();

  it.each(rows)(
    'keeps the $attribute of $part for an empty value',
    async ({ attribute, createNode, getTarget, show }) => {
      const { user } = await render(createNode({ [attribute]: '' }));
      await show?.(user);

      // The id of the element can come one render after the mount.
      const id = await waitFor(() => {
        const { id: targetId } = (getTarget ?? (() => screen.getByTestId('target')))();
        expect(targetId).toMatch(/\S/);
        return targetId;
      });
      await waitFor(() => {
        expect(screen.getByTestId('part')).toHaveAttribute(attribute, id);
      });
    },
  );

  it.each(
    ID_REFERENCE_ATTRIBUTES.flatMap((attribute) =>
      BLANKS.map(({ blank, value }) => ({ attribute, blank, value })),
    ),
  )('gives the props function no $attribute key for $blank', async ({ attribute, value }) => {
    await render(<Part data-testid="part" {...{ [attribute]: value }} />);

    expect(screen.getByTestId('part')).toHaveAttribute(attribute, `part-${attribute}`);
    expect(getAttributes.mock.lastCall?.[0]).toStrictEqual({ 'data-testid': 'part' });
  });

  it('keeps the description of a useRender component', async () => {
    await render(<Note aria-describedby="" data-testid="part" />);

    expect(screen.getByTestId('part')).toHaveAttribute('aria-describedby', 'note-text');
  });

  it('gives a reference that is not blank the place of the value of the part', async () => {
    await render(<Part aria-describedby="own-text" aria-controls="own-panel" data-testid="part" />);

    const part = screen.getByTestId('part');
    expect(part).toHaveAttribute('aria-describedby', 'own-text');
    expect(part).toHaveAttribute('aria-controls', 'own-panel');
  });
});
