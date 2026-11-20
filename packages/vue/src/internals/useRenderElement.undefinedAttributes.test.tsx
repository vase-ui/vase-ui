import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import type { ButtonHTMLAttributes, HTMLAttributes, ImgHTMLAttributes, VNode } from 'vue';
import { createRenderer, screen, waitFor } from '#test-utils';
import type { VaseUIComponentProps, WithVaseUIEvent } from './types';
import { useRenderElement } from './useRenderElement';

const Note = defineComponent(
  (props: VaseUIComponentProps<object> & WithVaseUIEvent<HTMLAttributes>) => {
    const { elementProps } = useRenderElement('div', props, {
      props: (attrs) => [{ role: 'note' }, attrs],
    });
    return () => h('div', elementProps());
  },
  { props: ['as'], inheritAttrs: false },
);

interface Row {
  name: string;
  attribute: string;
  createNode: () => VNode;
  // The value that the part gives with no attribute of the consumer.
  expected: () => unknown;
}

const rows: Row[] = [
  {
    name: 'the role of a note',
    attribute: 'role',
    createNode: () => <Note role={undefined} data-testid="part" />,
    expected: () => 'note',
  },
];

interface PartState {
  active: boolean;
}

const getAttributes = vi.fn<(attrs: Record<string, any>) => void>();

const Part = defineComponent(
  (props: VaseUIComponentProps<PartState> & WithVaseUIEvent<HTMLAttributes>) => {
    const { elementProps } = useRenderElement('div', props, {
      state: { active: true },
      props: (attrs) => {
        getAttributes(attrs);
        return [{ role: 'note', title: 'Note' }, attrs];
      },
    });
    return () => h('div', elementProps());
  },
  { props: ['as'], inheritAttrs: false },
);

function createTagComponent<Attributes extends object>(tag: string) {
  return defineComponent(
    (props: VaseUIComponentProps<Record<string, never>> & WithVaseUIEvent<Attributes>) => {
      const { elementProps } = useRenderElement(tag, props);
      return () => h(tag, elementProps());
    },
    { props: ['as'], inheritAttrs: false },
  );
}

const ButtonPart = createTagComponent<ButtonHTMLAttributes>('button');
const ImagePart = createTagComponent<ImgHTMLAttributes>('img');

describe('VUE-103: an attribute of the consumer that is undefined', () => {
  const { render } = createRenderer();

  it.each(rows)('keeps $name of the part', async ({ attribute, createNode, expected }) => {
    await render(createNode());

    await waitFor(() => {
      expect(screen.getByTestId('part')).toHaveAttribute(attribute, expected());
    });
  });

  it('gives the props function no key for the attribute', async () => {
    await render(<Part title={undefined} data-testid="part" />);

    expect(screen.getByTestId('part')).toHaveAttribute('title', 'Note');
    expect(getAttributes.mock.lastCall?.[0]).toStrictEqual({ 'data-testid': 'part' });
  });

  it('keeps a state attribute of the part', async () => {
    await render(<Part data-active={undefined} data-testid="part" />);

    expect(screen.getByTestId('part')).toHaveAttribute('data-active', '');
  });

  it('keeps type="button" and alt="" of the tag', async () => {
    const { container } = await render(
      <div>
        <ButtonPart type={undefined} />
        <ImagePart alt={undefined} />
      </div>,
    );

    expect(container.querySelector('button')).toHaveAttribute('type', 'button');
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
  });

  it('removes the value of the part for null', async () => {
    await render(<Part role={null} data-active={null} data-testid="part" />);

    const part = screen.getByTestId('part');
    expect(part).not.toHaveAttribute('role');
    expect(part).not.toHaveAttribute('data-active');
    expect(part).toHaveAttribute('title', 'Note');
  });
});
