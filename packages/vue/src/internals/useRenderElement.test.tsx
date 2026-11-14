import { vi, expect, describe, it, onTestFinished } from 'vitest';
import {
  createSSRApp,
  defineAsyncComponent,
  defineComponent,
  h,
  nextTick,
  onMounted,
  shallowRef,
} from 'vue';
import type {
  ButtonHTMLAttributes,
  Component,
  CSSProperties,
  HTMLAttributes,
  ImgHTMLAttributes,
  Slots,
} from 'vue';
import {
  createRenderer,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  takeReportedMessages,
} from '#test-utils';
import OverridingStylePart from '../../test/fixtures/OverridingStylePart.vue';
import { EMPTY_OBJECT } from '../common/empty';
import type { ComponentRenderFn, HTMLProps, VaseUIComponentProps, WithVaseUIEvent } from './types';
import { markChildrenMounted, useRenderElement } from './useRenderElement';

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

// A template ref of the target is set after the render of the target. The part reads the
// exposed `element` of the target, which is `null` until then.
const InnerElementTarget = defineComponent({
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

  const OverridingStyleTestComponent = defineComponent(
    (
      props: VaseUIComponentProps<Record<string, never>> &
        WithVaseUIEvent<HTMLAttributes> & { overridingStyle?: CSSProperties | undefined },
      { slots },
    ) => {
      const { elementProps } = useRenderElement('div', props, {
        overridingStyle: () => props.overridingStyle,
      });
      return () => renderPart(props, slots, elementProps, EMPTY_OBJECT);
    },
    { props: ['as', 'stateClass', 'stateStyle', 'overridingStyle'], inheritAttrs: false },
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
      const renderCalls: [HTMLProps, ActiveState][] = [];
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

    it('handles lazy elements', async () => {
      const LazyComponent = defineAsyncComponent(() =>
        Promise.resolve(defineComponent({ setup: () => () => <div data-lazy="true" /> })),
      );
      let component: ComponentWithElement | null = null;

      const Test = () => (
        <TestComponent
          ref={(value) => {
            component = value as ComponentWithElement | null;
          }}
          active
          as={LazyComponent}
          data-testid="lazy"
        />
      );
      const { container } = await render(<Test />);
      await flushMicrotasks();

      const element = container.firstElementChild;
      expect(element).not.toBe(null);
      expect(element?.getAttribute('data-testid')).toBe('lazy');
      expect(element?.getAttribute('data-lazy')).toBe('true');
      expect(element?.className).toContain('test-component');
      expect(component!.element).toBe(element);
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

    it.each([
      { name: 'an object', style: { padding: '20px', margin: '1px' } },
      { name: 'a string', style: 'padding: 20px; margin: 1px' },
    ])(
      'lets the overriding style of the part win over a style attribute that is $name, and over the state style',
      async ({ style }) => {
        const { container } = await render(
          <OverridingStyleTestComponent
            overridingStyle={{ padding: '30px', margin: '3px' }}
            style={style}
            stateStyle={() => ({ margin: '2px', color: 'red' })}
          />,
        );

        const element = container.firstElementChild as HTMLElement;
        expect(element.style.padding).toBe('30px');
        expect(element.style.margin).toBe('3px');
        expect(element.style.color).toBe('red');
      },
    );

    it('follows an overriding style that changes', async () => {
      const { container, setProps } = await render(
        <OverridingStyleTestComponent
          overridingStyle={{ padding: '30px' }}
          style={{ padding: '20px' }}
        />,
      );
      const element = container.firstElementChild as HTMLElement;
      expect(element.style.padding).toBe('30px');

      await setProps({ overridingStyle: undefined });

      expect(element.style.padding).toBe('20px');
    });

    it('merges a string style attribute of the consumer with the object style of the part', async () => {
      const { container } = await render(<TestComponent style="color: red; margin: 1px" />);

      const element = container.firstElementChild as HTMLElement;
      expect(element.style.padding).toBe('10px');
      expect(element.style.color).toBe('red');
      expect(element.style.margin).toBe('1px');
    });

    it('keeps a style that the code wrote when the merged style becomes empty', async () => {
      const { container, setProps } = await render(
        <OverridingStyleTestComponent style={{ color: 'red' }} />,
      );
      const element = container.firstElementChild as HTMLElement;
      // A part writes such a declaration to the DOM, as `ScrollArea.Viewport` does.
      element.style.setProperty('--written', '1');

      await setProps({ style: {} });

      expect(element.style.color).toBe('');
      expect(element.style.getPropertyValue('--written')).toBe('1');
    });

    it('applies a list of fallback values for a style property', async () => {
      // Vue sets each value of the list in turn. The browser keeps the last value that it accepts.
      const style = { color: ['not a color', 'red'] } as unknown as CSSProperties;

      const { container } = await render(<OverridingStyleTestComponent style={style} />);

      expect((container.firstElementChild as HTMLElement).style.color).toBe('red');
    });

    it.each([
      { name: 'an empty style object', props: { style: {} } },
      { name: 'an empty overriding style', props: { overridingStyle: {} } },
    ])('hydrates an element that has no style attribute for $name', async ({ props }) => {
      const serverHtml = await renderOnServer('test/fixtures/OverridingStylePart.vue', props);
      // A `<template>` element parses the HTML with no side effect.
      const template = document.createElement('template');
      template.innerHTML = serverHtml;

      // `hydrate` takes an empty `style` attribute for no attribute, so this assertion is the proof.
      expect(template.content.firstElementChild?.hasAttribute('style')).toBe(false);
      await hydrate(OverridingStylePart, { serverHtml, props });
    });

    it('applies a style that becomes non-empty after the hydration', async () => {
      // `hydrate` gives no way to change a prop after the mount, so the test hydrates by hand.
      const serverHtml = await renderOnServer('test/fixtures/OverridingStylePart.vue', {
        style: {},
      });
      const container = document.createElement('div');
      document.body.append(container);
      container.innerHTML = serverHtml;
      const element = container.firstElementChild as HTMLElement;

      const style = shallowRef<CSSProperties>({});
      const app = createSSRApp({ render: () => h(OverridingStylePart, { style: style.value }) });
      onTestFinished(() => {
        app.unmount();
        container.remove();
      });
      app.mount(container);

      style.value = { color: 'red' };
      await nextTick();

      // A mismatch makes Vue discard the server nodes and render new nodes.
      expect(container.firstElementChild).toBe(element);
      expect(element.style.color).toBe('red');
      expect(takeReportedMessages()).toEqual([]);
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

    it('gives type="button" only while a default tag that is a getter gives button', async () => {
      const GetterTagPart = defineComponent(
        (props: { tag: string }) => {
          const { elementProps } = useRenderElement(() => props.tag, {});
          return () => h(props.tag, elementProps());
        },
        { props: ['tag'], inheritAttrs: false },
      );

      const { container, setProps } = await render(<GetterTagPart tag="div" />);
      expect(container.firstElementChild).not.toHaveAttribute('type');

      await setProps({ tag: 'button' });
      expect(container.firstElementChild).toHaveAttribute('type', 'button');

      await setProps({ tag: 'div' });
      expect(container.firstElementChild).not.toHaveAttribute('type');
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

  describe('warnings for a `#render` slot that the part renders after the mount', () => {
    function renderEmptySpan() {
      return <span />;
    }

    it('warns when the slot binds no props on its element', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { rerender } = await render(
        <RerenderTestComponent enabled={false} v-slots={{ render: renderEmptySpan }} />,
      );
      expect(warnSpy).not.toHaveBeenCalled();

      await rerender(<RerenderTestComponent enabled v-slots={{ render: renderEmptySpan }} />);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain(
        'Vase UI: The `#render` slot gave no element to the part.',
      );
    });

    it('does not warn when the slot binds props, and when the part then renders no element', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { rerender } = await render(
        <RerenderTestComponent enabled={false} v-slots={{ render: renderSpan }} />,
      );

      await rerender(<RerenderTestComponent enabled v-slots={{ render: renderSpan }} />);
      await rerender(<RerenderTestComponent enabled={false} v-slots={{ render: renderSpan }} />);

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('does not warn for a component in the slot that sets its exposed element after its render', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      let component: ComponentWithElement | null = null;
      const renderTarget = ({ props }: { props: HTMLProps }) => <InnerElementTarget {...props} />;
      const Test = (props: { enabled: boolean }) => (
        <RerenderTestComponent
          enabled={props.enabled}
          ref={(value) => {
            component = value as ComponentWithElement | null;
          }}
          v-slots={{ render: renderTarget }}
        />
      );
      const { rerender } = await render(<Test enabled={false} />);

      await rerender(<Test enabled />);

      expect(component!.element).toBe(screen.getByTestId('inner'));
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('checks the slot again when the part renders it a second time', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { rerender } = await render(
        <RerenderTestComponent enabled v-slots={{ render: renderSpan }} />,
      );
      await rerender(<RerenderTestComponent enabled={false} v-slots={{ render: renderSpan }} />);
      expect(warnSpy).not.toHaveBeenCalled();

      await rerender(<RerenderTestComponent enabled v-slots={{ render: renderEmptySpan }} />);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain(
        'Vase UI: The `#render` slot gave no element to the part.',
      );
    });

    describe('of a part with `children`', () => {
      const OwnNode = defineComponent(() => {
        markChildrenMounted();
        return () => <span data-testid="own-node" />;
      });

      const ChildrenTestComponent = defineComponent(
        (props: { enabled: boolean }, { slots }) => {
          const { elementProps } = useRenderElement('div', {}, { children: true });
          return () =>
            props.enabled
              ? slots.render?.({ props: elementProps(), state: EMPTY_OBJECT, children: OwnNode })
              : null;
        },
        { props: ['enabled'], inheritAttrs: false },
      );

      it('warns when the slot does not mount `children`', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { rerender } = await render(
          <ChildrenTestComponent enabled={false} v-slots={{ render: renderSpan }} />,
        );
        expect(warnSpy).not.toHaveBeenCalled();

        await rerender(<ChildrenTestComponent enabled v-slots={{ render: renderSpan }} />);

        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0][0]).toContain(
          'Vase UI: The `#render` slot did not mount `children`.',
        );
      });

      it('does not warn when the slot mounts `children`', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const renderWithChildren = ({
          props,
          children,
        }: {
          props: HTMLProps;
          children: Component;
        }) => <span {...props}>{h(children)}</span>;
        const { rerender } = await render(
          <ChildrenTestComponent enabled={false} v-slots={{ render: renderWithChildren }} />,
        );

        await rerender(<ChildrenTestComponent enabled v-slots={{ render: renderWithChildren }} />);

        expect(screen.getByTestId('own-node')).not.toBeNull();
        expect(warnSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('target component with an outer element and an inner element', () => {
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
            as={InnerElementTarget}
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
