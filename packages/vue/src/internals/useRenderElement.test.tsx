import { vi, expect, describe, it } from 'vitest';
import { defineComponent, h, onMounted, shallowRef } from 'vue';
import type {
  ButtonHTMLAttributes,
  Component,
  HTMLAttributes,
  ImgHTMLAttributes,
  Slots,
} from 'vue';
import { createRenderer, screen } from '#test-utils';
import { EMPTY_OBJECT } from '../common/empty';
import type { ComponentRenderFn, HTMLProps, VaseUIComponentProps, WithVaseUIEvent } from './types';
import { useRenderElement } from './useRenderElement';

interface ActiveState {
  active?: boolean | undefined;
}

interface TestComponentProps
  extends VaseUIComponentProps<ActiveState>, WithVaseUIEvent<HTMLAttributes> {
  active?: boolean | undefined;
}

type RefCallback = (element: HTMLDivElement | null) => void;

interface RerenderTestComponentProps extends WithVaseUIEvent<HTMLAttributes> {
  as?: string | Component | undefined;
  enabled?: boolean | undefined;
  refs?: RefCallback | (RefCallback | undefined)[] | undefined;
}

type ComponentWithElement = { element: HTMLElement | null };

// The two template lines of a part, as a render function.
function renderPart<State>(
  props: { as?: string | Component | undefined },
  slots: Slots,
  elementProps: () => HTMLProps,
  state: State,
) {
  if (slots.render) {
    return slots.render({ props: elementProps(), state });
  }
  return h((props.as ?? 'div') as string, elementProps(), slots.default?.({ state }) as any);
}

function renderSpan({ props }: { props: HTMLProps }) {
  return <span {...props} />;
}

describe('useRenderElement', () => {
  const { render } = createRenderer();

  const TestComponent = defineComponent(
    (props: TestComponentProps, { slots, expose }) => {
      const { element, elementProps } = useRenderElement('div', props, {
        state: () => ({ active: props.active }),
        props: (attrs) => [{ ...attrs, class: 'test-component', style: { padding: '10px' } }],
      });
      expose({ element });
      return () => renderPart(props, slots, elementProps, { active: props.active });
    },
    { props: ['as', 'active', 'stateClass', 'stateStyle'], inheritAttrs: false },
  );

  const DirectPropsTestComponent = defineComponent(
    (props: TestComponentProps, { slots, expose }) => {
      const { element, elementProps } = useRenderElement('div', props, {
        state: () => ({ active: props.active }),
        props: (attrs) => attrs,
      });
      expose({ element });
      return () => renderPart(props, slots, elementProps, { active: props.active });
    },
    { props: ['as', 'active', 'stateClass', 'stateStyle'], inheritAttrs: false },
  );

  const ArrayPropsTestComponent = defineComponent(
    (props: TestComponentProps, { slots, expose }) => {
      const { element, elementProps } = useRenderElement('div', props, {
        state: () => ({ active: props.active }),
        props: (attrs) => [attrs, { class: 'test-component' }],
      });
      expose({ element });
      return () => renderPart(props, slots, elementProps, { active: props.active });
    },
    { props: ['as', 'active', 'stateClass', 'stateStyle'], inheritAttrs: false },
  );

  const DisabledPropsTestComponent = defineComponent(
    (props: { propsGetter: () => HTMLAttributes }) => {
      useRenderElement('div', {}, { props: () => [props.propsGetter] });
      // A part that is disabled does not render its element, so nothing calls `elementProps()`.
      return () => null;
    },
    { props: ['propsGetter'] },
  );

  const RerenderTestComponent = defineComponent(
    (props: RerenderTestComponentProps, { slots, expose }) => {
      const { element, elementProps } = useRenderElement<ActiveState, HTMLDivElement>(
        'div',
        props,
        {
          ref: props.refs,
          props: () => [{ id: 'rerender-target', onClick: props.onClick }],
        },
      );
      expose({ element });
      return () =>
        props.enabled === false ? null : renderPart(props, slots, elementProps, EMPTY_OBJECT);
    },
    { props: ['as', 'enabled', 'refs', 'onClick'], inheritAttrs: false },
  );

  it('accepts className as function', async () => {
    const { container } = await render(
      <TestComponent
        active
        stateClass={(state) => (state.active ? 'active-class' : 'inactive-class')}
      />,
    );

    const element = container.firstElementChild;

    expect(element).toHaveAttribute('class', 'active-class test-component');
  });

  it('accepts className as function that returns undefined', async () => {
    const { container } = await render(
      <TestComponent stateClass={(state) => (state.active ? 'active-class' : undefined)} />,
    );

    const element = container.firstElementChild;

    expect(element).toHaveAttribute('class', 'test-component');
  });

  it('accepts style as function', async () => {
    const { container } = await render(
      <TestComponent
        active
        stateStyle={(state) => ({ color: state.active ? 'rgb(255,0,0)' : 'rgb(0,255,0)' })}
      />,
    );

    const element = container.firstElementChild;

    expect(element?.getAttribute('style')).toBe('padding: 10px; color: rgb(255, 0, 0);');
  });

  it('accepts style as function that returns undefined', async () => {
    const { container } = await render(
      <TestComponent
        stateStyle={(state) => (state.active ? { color: 'rgb(255,0,0)' } : undefined)}
      />,
    );

    const element = container.firstElementChild;

    expect(element?.getAttribute('style')).toBe('padding: 10px;');
  });

  it('makes single prop objects preventable', async () => {
    const handleMouseDown = vi.fn((event) => {
      event.preventVaseUIHandler();
    });

    const { container } = await render(<DirectPropsTestComponent onMousedown={handleMouseDown} />);

    const element = container.firstElementChild as HTMLDivElement;

    expect(() =>
      element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })),
    ).not.toThrow();
    expect(handleMouseDown).toHaveBeenCalledTimes(1);
  });

  it('makes multi-prop arrays preventable when the event handler is first', async () => {
    const handleMouseDown = vi.fn((event) => {
      event.preventVaseUIHandler();
    });

    const { container } = await render(<ArrayPropsTestComponent onMousedown={handleMouseDown} />);

    const element = container.firstElementChild as HTMLDivElement;

    expect(() =>
      element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })),
    ).not.toThrow();
    expect(handleMouseDown).toHaveBeenCalledTimes(1);
  });

  it('makes obscure single-prop events preventable', async () => {
    const handleContextMenu = vi.fn((event) => {
      event.preventVaseUIHandler();
    });

    const { container } = await render(
      <DirectPropsTestComponent onContextmenu={handleContextMenu} />,
    );

    const element = container.firstElementChild as HTMLDivElement;

    expect(() =>
      element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })),
    ).not.toThrow();
    expect(handleContextMenu).toHaveBeenCalledTimes(1);
  });

  it('makes obscure multi-prop array events preventable when the event handler is first', async () => {
    const handleContextMenu = vi.fn((event) => {
      event.preventVaseUIHandler();
    });

    const { container } = await render(
      <ArrayPropsTestComponent onContextmenu={handleContextMenu} />,
    );

    const element = container.firstElementChild as HTMLDivElement;

    expect(() =>
      element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })),
    ).not.toThrow();
    expect(handleContextMenu).toHaveBeenCalledTimes(1);
  });

  it('does not resolve props when disabled', async () => {
    const propsGetter = vi.fn(() => ({
      onMousedown() {},
    }));

    const { container } = await render(<DisabledPropsTestComponent propsGetter={propsGetter} />);

    expect(container.firstElementChild).toBeNull();
    expect(propsGetter).not.toHaveBeenCalled();
  });

  it('handles enabled toggles across rerenders', async () => {
    let refElement: HTMLDivElement | null = null;
    const refs: RefCallback = (element) => {
      refElement = element;
    };
    const handleClick = vi.fn();
    const { rerender } = await render(
      <RerenderTestComponent enabled={false} refs={refs} onClick={handleClick} />,
    );

    expect(document.getElementById('rerender-target')).toBeNull();
    expect(refElement).toBeNull();

    await rerender(<RerenderTestComponent enabled refs={refs} onClick={handleClick} />);

    const element = document.getElementById('rerender-target') as HTMLDivElement;

    expect(element).not.toBeNull();
    expect(refElement).toBe(element);

    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(handleClick).toHaveBeenCalledTimes(1);

    await rerender(<RerenderTestComponent enabled={false} refs={refs} onClick={handleClick} />);

    expect(document.getElementById('rerender-target')).toBeNull();
    expect(refElement).toBeNull();
  });

  describe('prop: render', () => {
    it('accepts render as a function that receives props and state', async () => {
      const renderCalls: Array<[HTMLProps, ActiveState]> = [];
      const renderFn: ComponentRenderFn<HTMLProps, ActiveState> = ({ props, state }) => {
        renderCalls.push([props, state]);
        return <span {...props} data-active={String(state.active)} />;
      };

      const { container } = await render(
        <TestComponent active v-slots={{ render: renderFn }} data-testid="custom" />,
      );

      const element = container.firstElementChild;

      expect(renderCalls.length).toBeGreaterThan(0);
      const [firstCallProps, firstCallState] = renderCalls[0];
      expect(firstCallProps).toMatchObject({
        class: 'test-component',
        'data-testid': 'custom',
      });
      expect(firstCallProps.style).toEqual({ padding: '10px' });
      expect(firstCallState).toEqual({ active: true });
      expect(element?.tagName).toBe('SPAN');
      expect(element).toHaveAttribute('data-testid', 'custom');
      expect(element).toHaveAttribute('data-active', 'true');
    });

    it('accepts render as a React element and clones it with merged props', async () => {
      const CustomElement = defineComponent(() => () => <span />);

      const { container } = await render(
        <TestComponent active as={CustomElement} data-active="true" data-testid="custom" />,
      );

      const element = container.firstElementChild;

      expect(element?.tagName).toBe('SPAN');
      expect(element).toHaveAttribute('data-testid', 'custom');
      expect(element).toHaveAttribute('data-active', 'true');
    });

    it('forwards ref to render element', async () => {
      const CustomElement = defineComponent(() => () => <div />);

      let component: ComponentWithElement | null = null;
      const Test = () => (
        <TestComponent
          ref={(value) => {
            component = value as ComponentWithElement | null;
          }}
          as={CustomElement}
        />
      );
      const { container } = await render(<Test />);
      const element = container.firstElementChild;
      expect(component!.element).toBe(element);
    });

    it('merges className from render element and component props', async () => {
      const { container } = await render(
        <TestComponent
          active
          class="component-class"
          v-slots={{
            render: ({ props }: { props: HTMLProps }) => <div {...props} class="render-class" />,
          }}
        />,
      );

      const element = container.firstElementChild;

      expect(element?.className).toContain('component-class');
      expect(element?.className).toContain('render-class');
      expect(element?.className).toContain('test-component');
    });

    it('merges className function with render element', async () => {
      const { container } = await render(
        <TestComponent
          active
          stateClass={(state) => (state.active ? 'active-class' : '')}
          v-slots={{
            render: ({ props }: { props: HTMLProps }) => <div {...props} class="render-class" />,
          }}
        />,
      );

      const element = container.firstElementChild;

      expect(element?.className).toContain('active-class');
      expect(element?.className).toContain('render-class');
      expect(element?.className).toContain('test-component');
    });

    it('merges style from render element and component props', async () => {
      const { container } = await render(
        <TestComponent
          active
          style={{ color: 'rgb(255, 0, 0)' }}
          v-slots={{
            render: ({ props }: { props: HTMLProps }) => (
              <div {...props} style={{ fontSize: '16px' }} />
            ),
          }}
        />,
      );

      const element = container.firstElementChild as HTMLElement;
      expect(element.style.padding).toBe('10px');
      expect(element.style.color).toBe('rgb(255, 0, 0)');
      expect(element.style.fontSize).toBe('16px');
    });

    it('merges style function with render element', async () => {
      const { container } = await render(
        <TestComponent
          active
          stateStyle={(state) => ({ color: state.active ? 'rgb(255, 0, 0)' : 'rgb(0, 0, 0)' })}
          v-slots={{
            render: ({ props }: { props: HTMLProps }) => (
              <div {...props} style={{ fontSize: '16px' }} />
            ),
          }}
        />,
      );

      const element = container.firstElementChild as HTMLElement;
      expect(element.style.padding).toBe('10px');
      expect(element.style.color).toBe('rgb(255, 0, 0)');
      expect(element.style.fontSize).toBe('16px');
    });

    it('handles render element with existing ref', async () => {
      let renderRef: HTMLDivElement | null = null;
      let component: ComponentWithElement | null = null;

      const Test = () => (
        <TestComponent
          ref={(value) => {
            component = value as ComponentWithElement | null;
          }}
          v-slots={{
            render: ({ props }: { props: HTMLProps }) => (
              <div
                {...props}
                ref={(element) => {
                  props.ref(element);
                  renderRef = element as HTMLDivElement | null;
                }}
              />
            ),
          }}
        />
      );

      await render(<Test />);

      expect(renderRef).toBeInstanceOf(HTMLDivElement);
      expect(component!.element).toBeInstanceOf(HTMLDivElement);
      expect(renderRef).toBe(component!.element);
    });
  });

  describe('EMPTY_OBJECT mutation safety', () => {
    // This test verifies that the hook doesn't attempt to mutate EMPTY_OBJECT
    // which would throw a TypeError in strict mode since it's frozen.
    const MinimalComponent = defineComponent(
      (props: VaseUIComponentProps<Record<string, never>>, { slots, expose }) => {
        // Using EMPTY_OBJECT as state and no additional props simulates the edge case
        // where mergeObjects might return undefined and fall back to EMPTY_OBJECT
        const { element, elementProps } = useRenderElement('div', props, {
          state: EMPTY_OBJECT,
          // No props passed - relies on stateProps which will be {}
        });
        expose({ element });
        return () => renderPart(props, slots, elementProps, EMPTY_OBJECT);
      },
      { props: ['as', 'stateClass', 'stateStyle'], inheritAttrs: false },
    );

    it('does not throw when className is provided with minimal props', async () => {
      const { container } = await render(<MinimalComponent class="test-class" />);
      expect(container.firstElementChild).not.toBeNull();
      expect(container.firstElementChild).toHaveAttribute('class', 'test-class');
    });

    it('does not throw when style is provided with minimal props', async () => {
      const { container } = await render(<MinimalComponent style={{ color: 'red' }} />);
      expect(container.firstElementChild).not.toBeNull();
      const element = container.firstElementChild as HTMLElement;
      expect(element.style.color).toBe('red');
    });
  });

  describe('class', () => {
    it('puts the class of the consumer, then the state class, then the class of the part', async () => {
      const { container } = await render(<TestComponent class="a" stateClass={() => 'b'} />);

      expect(container.firstElementChild).toHaveAttribute('class', 'a b test-component');
    });
  });

  describe('style', () => {
    it('lets the style attribute win over the part, and the state style win over both', async () => {
      const { container } = await render(
        <TestComponent
          style={{ padding: '20px', margin: '1px' }}
          stateStyle={() => ({ margin: '2px' })}
        />,
      );

      const element = container.firstElementChild as HTMLElement;
      expect(element.style.padding).toBe('20px');
      expect(element.style.margin).toBe('2px');
    });

    it('merges a string style attribute of the consumer with the object style of the part', async () => {
      const { container } = await render(<TestComponent style="color: red; margin: 1px" />);

      const element = container.firstElementChild as HTMLElement;
      expect(element.style.padding).toBe('10px');
      expect(element.style.color).toBe('red');
      expect(element.style.margin).toBe('1px');
    });
  });

  describe('ref callbacks', () => {
    it('gives the element one time over three rerenders, and null at unmount', async () => {
      const refs = vi.fn();
      const { container, rerender, unmount } = await render(
        <RerenderTestComponent enabled refs={refs} />,
      );

      const element = container.firstElementChild;
      expect(element).not.toBeNull();
      expect(refs).toHaveBeenCalledTimes(1);
      expect(refs.mock.calls[0][0]).toBe(element);

      await rerender(<RerenderTestComponent enabled refs={refs} data-count="1" />);
      await rerender(<RerenderTestComponent enabled refs={refs} data-count="2" />);
      await rerender(<RerenderTestComponent enabled refs={refs} data-count="3" />);

      expect(refs).toHaveBeenCalledTimes(1);

      unmount();

      expect(refs).toHaveBeenCalledTimes(2);
      expect(refs.mock.calls[1][0]).toBeNull();
    });
  });

  describe('default attributes of the tag', () => {
    function createTagComponent<Attributes extends object>(tag: string) {
      return defineComponent(
        (props: VaseUIComponentProps<Record<string, never>> & Attributes, { slots, expose }) => {
          const { element, elementProps } = useRenderElement(tag, props);
          expose({ element });
          return () =>
            slots.render
              ? slots.render({ props: elementProps(), state: EMPTY_OBJECT })
              : h((props.as ?? tag) as string, elementProps());
        },
        { props: ['as', 'stateClass', 'stateStyle'], inheritAttrs: false },
      );
    }

    const ButtonPart = createTagComponent<ButtonHTMLAttributes>('button');
    const ImagePart = createTagComponent<ImgHTMLAttributes>('img');

    it('gives type="button" to a default button', async () => {
      const { container } = await render(<ButtonPart />);

      expect(container.firstElementChild).toHaveAttribute('type', 'button');
    });

    it('gives alt="" to a default img', async () => {
      const { container } = await render(<ImagePart />);

      expect(container.firstElementChild).toHaveAttribute('alt', '');
    });

    it('lets an attribute of the consumer replace each default', async () => {
      const { container } = await render(
        <div>
          <ButtonPart type="submit" />
          <ImagePart alt="A cat" />
        </div>,
      );

      const [button, image] = Array.from(container.querySelectorAll('button, img'));
      expect(button).toHaveAttribute('type', 'submit');
      expect(image).toHaveAttribute('alt', 'A cat');
    });

    it.each([
      { name: 'the default tag', createNode: () => <ButtonPart as="button" />, type: 'button' },
      { name: 'another tag', createNode: () => <ButtonPart as="span" />, type: null },
      {
        name: 'a render slot',
        createNode: () => <ButtonPart v-slots={{ render: renderSpan }} />,
        type: null,
      },
    ])(
      'gives type="button" for $name only when it is the default tag',
      async ({ createNode, type }) => {
        const { container } = await render(createNode());

        expect(container.firstElementChild?.getAttribute('type')).toBe(type);
      },
    );
  });

  describe('warnings', () => {
    it('warns when the part has both the `as` prop and the `#render` slot', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await render(<TestComponent as="section" v-slots={{ render: renderSpan }} />);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain(
        'Vase UI: The `as` prop and the `#render` slot are both set.',
      );
    });

    it('does not warn when the part has the `#render` slot alone', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await render(<TestComponent v-slots={{ render: renderSpan }} />);

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('warns when the `#render` slot binds no props on its element', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await render(<TestComponent v-slots={{ render: () => <span /> }} />);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain(
        'Vase UI: The `#render` slot gave no element to the part.',
      );
    });

    it('does not warn for a part whose render function returns null at mount', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await render(<RerenderTestComponent enabled={false} v-slots={{ render: renderSpan }} />);

      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('target component with an outer element and an inner element', () => {
    // A template ref of the target is set after the render of the target. The part reads the
    // exposed `element` of the target, which is `null` until then.
    const Target = defineComponent({
      inheritAttrs: false,
      setup(_, { attrs, expose }) {
        const inner = shallowRef<Element | null>(null);
        expose({ element: inner });
        return () => (
          <div data-testid="outer">
            <span {...attrs} ref={inner} data-testid="inner" />
          </div>
        );
      },
    });

    it('gives the inner element, and never the outer element, to the part', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const refs = vi.fn();
      let component: ComponentWithElement | null = null;
      let elementAtMountOfOwner: HTMLElement | null = null;

      const Owner = defineComponent(() => {
        onMounted(() => {
          elementAtMountOfOwner = component!.element;
        });
        return () => (
          <RerenderTestComponent
            enabled
            as={Target}
            refs={refs}
            ref={(value) => {
              component = value as ComponentWithElement | null;
            }}
          />
        );
      });

      await render(<Owner />);

      const inner = screen.getByTestId('inner');
      expect(refs).toHaveBeenCalledTimes(1);
      expect(refs.mock.calls[0][0]).toBe(inner);
      expect(component!.element).toBe(inner);
      expect(elementAtMountOfOwner).toBe(inner);
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('listeners', () => {
    it('runs only the new listener of the part after a rerender', async () => {
      const first = vi.fn();
      const second = vi.fn();
      const { container, rerender } = await render(
        <RerenderTestComponent enabled onClick={first} />,
      );
      const element = container.firstElementChild as HTMLElement;

      await rerender(<RerenderTestComponent enabled onClick={second} />);
      element.click();

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
    });
  });
});
