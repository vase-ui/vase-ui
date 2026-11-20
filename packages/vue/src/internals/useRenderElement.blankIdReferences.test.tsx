import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import type { HTMLAttributes } from 'vue';
import { createRenderer, screen } from '#test-utils';
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

const BLANKS = [
  { blank: 'an empty value', value: '' },
  { blank: 'white space', value: '\n\t ' },
];

describe('VUE-110: a blank ID reference attribute of the consumer', () => {
  const { render } = createRenderer();

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
