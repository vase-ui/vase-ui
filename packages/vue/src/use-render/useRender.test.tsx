import { expect, describe, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { useRender } from '@vase-ui/vue/use-render';
import type { HTMLProps } from '@vase-ui/vue/use-render';
import { createRenderer, describeConformance, screen } from '#test-utils';
import UseRenderPart from './UseRenderPart.test.vue';
import type { UseRenderPartState } from './UseRenderPart.test.vue';

// A component that calls `useRender` in `setup` and renders the two template lines.
function defineTestComponent<Props extends Record<string, any> = {}>(
  callUseRender: (props: Props) => useRender.ReturnValue,
  props: (keyof Props & string)[] = [],
) {
  return defineComponent(
    (componentProps: Record<string, any>, { slots }) => {
      const { elementProps, tag } = callUseRender(componentProps as Props);
      return () =>
        slots.render
          ? slots.render({ props: elementProps(), state: {} })
          : h(tag.value as string, elementProps(), slots.default?.({ state: {} }));
    },
    { props, inheritAttrs: false },
  );
}

describe('useRender', () => {
  const { render } = createRenderer();

  it('render props does not overwrite className in a render function when unspecified', async () => {
    const TestComponent = defineTestComponent(
      (props: { className?: string }) =>
        useRender({}, { props: () => ({ class: props.className }) }),
      ['className'],
    );

    const { container } = await render(
      <TestComponent
        v-slots={{
          render: ({ props, state }: { props: HTMLProps; state: {} }) => (
            <span {...props} class={`my-span ${props.class ?? ''}`} {...state} />
          ),
        }}
      />,
    );

    const element = container.firstElementChild;

    expect(element).toHaveAttribute('class', 'my-span');
  });

  it('refs are handled as expected', async () => {
    const refs: (HTMLElement | null)[] = [];

    const TestComponent = defineTestComponent(() =>
      useRender(
        {},
        {
          ref: [
            (element) => {
              refs[0] = element;
            },
            (element) => {
              refs[1] = element;
            },
          ],
        },
      ),
    );

    const { container } = await render(
      <TestComponent
        v-slots={{ render: ({ props }: { props: HTMLProps }) => <span {...props} /> }}
      />,
    );
    expect(refs.length).toBe(2);

    refs.forEach((ref) => {
      expect(ref).toBe(container.firstElementChild);
    });
  });

  describe('param: defaultTagName', () => {
    it('renders div by default if no defaultTagName and no render params are provided', async () => {
      const TestComponent = defineTestComponent(() => useRender({}));

      const { container } = await render(<TestComponent />);
      expect(container.firstElementChild).toHaveProperty('tagName', 'DIV');
    });

    it('renders the element with the default tag with no render prop', async () => {
      const TestComponent = defineTestComponent(
        (props: { defaultTagName: string }) =>
          useRender({}, { defaultTagName: () => props.defaultTagName }),
        ['defaultTagName'],
      );

      const { container, setProps } = await render(<TestComponent defaultTagName="div" />);
      expect(container.firstElementChild).toHaveProperty('tagName', 'DIV');

      await setProps({ defaultTagName: 'span' });
      expect(container.firstElementChild).toHaveProperty('tagName', 'SPAN');
    });

    it('is overwritten by the render prop', async () => {
      const TestComponent = defineTestComponent(
        (props: { as: string; defaultTagName: string }) =>
          useRender(props, { defaultTagName: () => props.defaultTagName }),
        ['as', 'defaultTagName'],
      );

      const { container, setProps } = await render(
        <TestComponent defaultTagName="div" as="span" />,
      );
      expect(container.firstElementChild).toHaveProperty('tagName', 'SPAN');

      await setProps({ defaultTagName: 'a' });
      expect(container.firstElementChild).toHaveProperty('tagName', 'SPAN');
    });

    it('gives type="button" to a default button tag, and to no other tag', async () => {
      const TestComponent = defineTestComponent(
        (props: { as?: string }) => useRender(props, { defaultTagName: 'button' }),
        ['as'],
      );

      await render(
        <div>
          <TestComponent data-testid="default" />
          <TestComponent as="div" data-testid="other" />
        </div>,
      );

      expect(screen.getByTestId('default')).toHaveAttribute('type', 'button');
      expect(screen.getByTestId('other')).not.toHaveAttribute('type');
    });

    it('gives type="button" only while defaultTagName is button', async () => {
      const TestComponent = defineTestComponent(
        (props: { defaultTagName: string }) =>
          useRender({}, { defaultTagName: () => props.defaultTagName }),
        ['defaultTagName'],
      );

      const { container, setProps } = await render(<TestComponent defaultTagName="div" />);
      expect(container.firstElementChild).not.toHaveAttribute('type');

      await setProps({ defaultTagName: 'button' });
      expect(container.firstElementChild).toHaveAttribute('type', 'button');

      await setProps({ defaultTagName: 'div' });
      expect(container.firstElementChild).not.toHaveAttribute('type');
    });
  });

  describe('state to data attributes', () => {
    it('converts state to data attributes automatically', async () => {
      const TestComponent = defineTestComponent(() =>
        useRender(
          { as: 'button' },
          {
            state: {
              active: true,
              index: 42,
            },
            props: () => ({ type: 'button' }),
          },
        ),
      );

      const { container } = await render(<TestComponent />);
      const button = container.firstElementChild;

      expect(button).toHaveAttribute('data-active', '');
      expect(button).toHaveAttribute('data-index', '42');
    });

    it('handles undefined values in state', async () => {
      const TestComponent = defineTestComponent(() =>
        useRender(
          { as: 'div' },
          {
            state: {
              defined: 'value',
              notDefined: undefined,
            },
          },
        ),
      );

      const { container } = await render(<TestComponent />);
      const div = container.firstElementChild;

      expect(div).toHaveAttribute('data-defined', 'value');
      expect(div).not.toHaveAttribute('data-notdefined');
    });

    it('merges state-based data attributes with existing props', async () => {
      const TestComponent = defineTestComponent(() =>
        useRender(
          { as: 'button' },
          {
            state: {
              form: 'login',
            },
            props: () => ({
              type: 'button',
              class: 'btn-primary',
              id: 'submit-btn',
              'data-existing': 'prop',
            }),
          },
        ),
      );

      const { container } = await render(<TestComponent />);
      const button = container.firstElementChild;

      expect(button).toHaveAttribute('data-form', 'login');

      expect(button).toHaveAttribute('class', 'btn-primary');
      expect(button).toHaveAttribute('id', 'submit-btn');

      expect(button).toHaveAttribute('data-existing', 'prop');
    });

    it('props override state-based data attributes', async () => {
      const TestComponent = defineTestComponent(() =>
        useRender(
          { as: 'button' },
          {
            state: {
              active: true,
            },
            props: () => ({ type: 'button', 'data-active': 'false' }),
          },
        ),
      );

      const { container } = await render(<TestComponent />);
      const button = container.firstElementChild;

      expect(button).toHaveAttribute('data-active', 'false');
    });

    it('handles empty state', async () => {
      const TestComponent = defineTestComponent(() =>
        useRender(
          { as: 'span' },
          {
            state: {},
            props: () => ({ class: 'test-class' }),
          },
        ),
      );

      const { container } = await render(<TestComponent />);
      const span = container.firstElementChild;

      expect(span).toHaveAttribute('class', 'test-class');

      const attributeNames = Array.from(span?.attributes ?? [], (attr) => attr.name);
      expect(attributeNames.filter((name) => name.startsWith('data-'))).toEqual([]);
    });

    it('handles undefined state', async () => {
      const TestComponent = defineTestComponent(() =>
        useRender(
          { as: 'div' },
          {
            state: undefined,
            props: () => ({ class: 'test-class', 'data-from-props': 'value' }),
          },
        ),
      );

      const { container } = await render(<TestComponent />);
      const div = container.firstElementChild;

      expect(div).toHaveAttribute('class', 'test-class');
      expect(div).toHaveAttribute('data-from-props', 'value');
    });

    it('converts boolean values in state to data attributes', async () => {
      const TestComponent = defineTestComponent(() =>
        useRender(
          { as: 'button' },
          {
            state: {
              active: true,
              disabled: false,
            },
            props: () => ({ type: 'button' }),
          },
        ),
      );

      const { container } = await render(<TestComponent />);
      const button = container.firstElementChild;

      expect(button).toHaveAttribute('data-active', '');
      expect(button).not.toHaveAttribute('data-disabled');
    });

    it('converts number values in state to data attributes', async () => {
      const TestComponent = defineTestComponent(() =>
        useRender(
          { as: 'div' },
          {
            state: {
              count: 0,
              index: 42,
              percentage: 99.9,
            },
          },
        ),
      );

      const { container } = await render(<TestComponent />);
      const div = container.firstElementChild;

      expect(div).not.toHaveAttribute('data-count');
      expect(div).toHaveAttribute('data-index', '42');
      expect(div).toHaveAttribute('data-percentage', '99.9');
    });

    it('supports custom stateAttributesMapping for kebab-case conversion', async () => {
      const TestComponent = defineTestComponent(() =>
        useRender(
          { as: 'button' },
          {
            state: {
              isActive: true,
              itemCount: 5,
              userName: 'John',
            },
            stateAttributesMapping: {
              isActive: (value) => (value ? { 'data-is-active': '' } : null),
              itemCount: (value) => ({ 'data-item-count': value.toString() }),
              userName: (value) => ({ 'data-user-name': value }),
            },
            props: () => ({ type: 'button' }),
          },
        ),
      );

      const { container } = await render(<TestComponent />);
      const button = container.firstElementChild;

      expect(button).toHaveAttribute('data-is-active', '');
      expect(button).toHaveAttribute('data-item-count', '5');
      expect(button).toHaveAttribute('data-user-name', 'John');
    });
  });
});

describe('<UseRenderPart />', () => {
  const { render } = createRenderer();

  describeConformance(<UseRenderPart />, () => ({
    render,
    refInstanceof: window.HTMLDivElement,
  }));

  it('gives the state to the class, the style, the data attribute and the default slot', async () => {
    const { container } = await render(
      <UseRenderPart
        active
        stateClass={(state) => (state.active ? 'active-class' : 'inactive-class')}
        stateStyle={(state) => ({ color: state.active ? 'red' : 'blue' })}
        v-slots={{
          default: ({ state }: { state: UseRenderPartState }) => `active: ${state.active}`,
        }}
      />,
    );

    const element = container.firstElementChild as HTMLElement;
    expect(element).toHaveClass('active-class');
    expect(element.style.color).toBe('red');
    expect(element).toHaveAttribute('data-active', '');
    expect(element).toHaveTextContent('active: true');
  });
});
