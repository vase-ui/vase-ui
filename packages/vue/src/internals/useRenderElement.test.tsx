import { vi, expect, describe, it, onTestFinished } from 'vitest';
import {
  createApp,
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
  PropType,
  Slots,
} from 'vue';
import {
  createRenderer,
  flushMicrotasks,
  hydrate,
  isVaporApp,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';
import { MountedElementTarget } from '../../test/fixtures/MountedElementTarget';
import StylePart from '../../test/fixtures/StylePart.vue';
import { EMPTY_OBJECT } from '../common/empty';
import type { ComponentRenderFn, HTMLProps, VaseUIComponentProps, WithVaseUIEvent } from './types';
import { markChildrenMounted, useRenderElement } from './useRenderElement';
import VaporConditionalPart from './VaporConditionalPart.test.vue';
import VaporPart from './VaporPart.test.vue';
import VaporRenderConsumer from './VaporRenderConsumer.test.vue';

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

// The render slot and element of a part, as a render function.
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

// A wrapper that sets its exposed element after an `await` in `onMounted`. It exposes the element
// as a ref, as the Composition page of the handbook tells a consumer to do.
const AwaitedElementTarget = defineComponent({
  inheritAttrs: false,
  props: { ready: { type: Promise as PropType<Promise<void>>, required: true } },
  setup(props, { attrs, expose }) {
    const host = shallowRef<HTMLElement | null>(null);
    const element = shallowRef<HTMLElement | null>(null);
    onMounted(async () => {
      await props.ready;
      element.value = host.value;
    });
    expose({ element });
    return () => <div {...attrs} ref={host} data-testid="awaited" />;
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
    { props: ['as', 'active'], inheritAttrs: false },
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
    { props: ['as', 'active'], inheritAttrs: false },
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
    { props: ['as', 'active'], inheritAttrs: false },
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

  const StyleTestComponent = defineComponent(
    (
      props: VaseUIComponentProps<Record<string, never>> & WithVaseUIEvent<HTMLAttributes>,
      { slots },
    ) => {
      const { elementProps } = useRenderElement('div', props);
      return () => renderPart(props, slots, elementProps, EMPTY_OBJECT);
    },
    { props: ['as'], inheritAttrs: false },
  );

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
    it.runIf(isVaporApp)(
      'calls a virtual DOM slot once per render of its bindings in a Vapor part',
      async () => {
        const title = shallowRef('First');
        const report = vi.fn();
        const slot = vi.fn(({ props }: { props: HTMLProps }) => (
          <span {...props}>{props.title}</span>
        ));
        const { container } = await render(() => (
          <VaporPart report={report} title={title.value} v-slots={{ render: slot }} />
        ));
        const element = container.querySelector('span');
        expect(slot).toHaveBeenCalledTimes(1);
        expect(element).toHaveTextContent('First');
        expect(report).toHaveBeenCalledExactlyOnceWith(element);

        title.value = 'Second';
        await nextTick();
        expect(slot).toHaveBeenCalledTimes(2);
        expect(element).toHaveTextContent('Second');
      },
    );

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
          v-slots={{
            render: ({ props, state }: { props: HTMLProps; state: ActiveState }) => (
              <div {...props} class={['render-class', { 'active-class': state.active }]} />
            ),
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
          v-slots={{
            render: ({ props, state }: { props: HTMLProps; state: ActiveState }) => (
              <div
                {...props}
                style={{
                  fontSize: '16px',
                  color: state.active ? 'rgb(255, 0, 0)' : 'rgb(0, 0, 0)',
                }}
              />
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
    const MinimalComponent = defineComponent(
      (props: VaseUIComponentProps<Record<string, never>>, { slots, expose }) => {
        const { element, elementProps } = useRenderElement('div', props, {
          state: EMPTY_OBJECT,
        });
        expose({ element });
        return () => renderPart(props, slots, elementProps, EMPTY_OBJECT);
      },
      { props: ['as'], inheritAttrs: false },
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
    it('omits an empty class binding from the render slot props', async () => {
      let received: HTMLProps | undefined;
      await render(
        <DirectPropsTestComponent
          class={{ active: false }}
          v-slots={{
            render: ({ props }: { props: HTMLProps }) => {
              received = props;
              return <div {...props} />;
            },
          }}
        />,
      );
      expect(received).toBeDefined();
      expect(received).not.toHaveProperty('class');
    });

    it('puts the class of the consumer, then the class of the part', async () => {
      const { container } = await render(<TestComponent class={['a', { b: true }]} />);

      expect(container.firstElementChild).toHaveAttribute('class', 'a b test-component');
    });
  });

  describe('style', () => {
    it('lets the style attribute win over the part', async () => {
      const { container } = await render(
        <TestComponent style={[{ padding: '20px', margin: '1px' }, { margin: '2px' }]} />,
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

    it('keeps a style that the code wrote when the merged style becomes empty', async () => {
      const { container, setProps } = await render(<StyleTestComponent style={{ color: 'red' }} />);
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

      const { container } = await render(<StyleTestComponent style={style} />);

      expect((container.firstElementChild as HTMLElement).style.color).toBe('red');
    });

    it('hydrates an element that has no style attribute for an empty style object', async () => {
      const props = { style: {} };
      const serverHtml = await renderOnServer('test/fixtures/StylePart.vue', props);
      // A `<template>` element parses the HTML with no side effect.
      const template = document.createElement('template');
      template.innerHTML = serverHtml;

      // `hydrate` takes an empty `style` attribute for no attribute, so this assertion is the proof.
      expect(template.content.firstElementChild?.hasAttribute('style')).toBe(false);
      await hydrate(StylePart, { serverHtml, props });
    });

    it('applies a style that becomes non-empty after the hydration', async () => {
      // `hydrate` gives no way to change a prop after the mount, so the test hydrates by hand.
      const serverHtml = await renderOnServer('test/fixtures/StylePart.vue', {
        style: {},
      });
      const container = document.createElement('div');
      document.body.append(container);
      container.innerHTML = serverHtml;
      const element = container.firstElementChild as HTMLElement;

      const style = shallowRef<CSSProperties>({});
      const app = createSSRApp({ render: () => h(StylePart, { style: style.value }) });
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
    it.runIf(isVaporApp)('gives the element to a part that is a Vapor component', async () => {
      const report = vi.fn();
      await render(() => <VaporPart report={report} data-testid="part" />);
      expect(report).toHaveBeenCalledExactlyOnceWith(screen.getByTestId('part'));
    });

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
        { props: ['as'], inheritAttrs: false },
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
      expect(warnSpy.mock.calls[0][0]).toContain(
        'In a Vapor component, also bind the `ref` setter by name: `:ref="props.ref"`.',
      );
    });

    it('warns when the `#render` slot renders nothing', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await render(<TestComponent v-slots={{ render: () => null }} />);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain(
        'Vase UI: The `#render` slot gave no element to the part.',
      );
    });

    it('gives the element of a component in the slot that sets its exposed ref after an `await`, with no warning', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { promise: ready, resolve: makeReady } = Promise.withResolvers<void>();
      let component: ComponentWithElement | null = null;
      const renderTarget = ({ props }: { props: HTMLProps }) => (
        <AwaitedElementTarget {...props} ready={ready} />
      );

      await render(() => (
        <TestComponent
          ref={(value) => {
            component = value as ComponentWithElement | null;
          }}
          v-slots={{ render: renderTarget }}
        />
      ));
      expect(component!.element).toBe(null);
      expect(warnSpy).not.toHaveBeenCalled();

      makeReady();

      await waitFor(() => {
        expect(component!.element).toBe(screen.getByTestId('awaited'));
      });
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('warns when the `as` prop comes after the mount of a part with the `#render` slot', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { rerender } = await render(<TestComponent v-slots={{ render: renderSpan }} />);
      expect(warnSpy).not.toHaveBeenCalled();

      await rerender(<TestComponent as="section" v-slots={{ render: renderSpan }} />);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain(
        'Vase UI: The `as` prop and the `#render` slot are both set.',
      );
    });

    it('warns when the `#render` slot comes after the mount of a part with the `as` prop', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { rerender } = await render(<TestComponent as="section" />);
      expect(warnSpy).not.toHaveBeenCalled();

      await rerender(<TestComponent as="section" v-slots={{ render: renderSpan }} />);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain(
        'Vase UI: The `as` prop and the `#render` slot are both set.',
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

      function renderWithChildren({ props, children }: { props: HTMLProps; children: Component }) {
        return <span {...props}>{h(children)}</span>;
      }

      it('does not warn when the slot mounts `children`', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { rerender } = await render(
          <ChildrenTestComponent enabled={false} v-slots={{ render: renderWithChildren }} />,
        );

        await rerender(<ChildrenTestComponent enabled v-slots={{ render: renderWithChildren }} />);

        expect(screen.getByTestId('own-node')).not.toBeNull();
        expect(warnSpy).not.toHaveBeenCalled();
      });

      it('warns when a later appearance of the slot does not mount `children`', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { rerender } = await render(
          <ChildrenTestComponent enabled v-slots={{ render: renderWithChildren }} />,
        );
        await rerender(
          <ChildrenTestComponent enabled={false} v-slots={{ render: renderWithChildren }} />,
        );
        expect(warnSpy).not.toHaveBeenCalled();

        await rerender(<ChildrenTestComponent enabled v-slots={{ render: renderSpan }} />);

        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0][0]).toContain(
          'Vase UI: The `#render` slot did not mount `children`.',
        );
      });
    });
  });

  describe.runIf(isVaporApp)('warnings in a part compiled as a Vapor component', () => {
    function renderNothing() {
      return null;
    }

    function renderEmptySpan() {
      return <span />;
    }

    it('warns when the `#render` slot returns `null`', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await render(<VaporConditionalPart enabled v-slots={{ render: renderNothing }} />);

      expect(warnSpy).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining('Vase UI: The `#render` slot gave no element to the part.'),
      );
    });

    it('warns when the `#render` slot renders an element and uses no slot prop', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await render(<VaporConditionalPart enabled v-slots={{ render: renderEmptySpan }} />);

      expect(warnSpy).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining('Vase UI: The `#render` slot gave no element to the part.'),
      );
    });

    it('warns when the part renders a `#render` slot that uses no slot prop after the mount', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { rerender } = await render(
        <VaporConditionalPart enabled={false} v-slots={{ render: renderEmptySpan }} />,
      );
      expect(warnSpy).not.toHaveBeenCalled();

      await rerender(<VaporConditionalPart enabled v-slots={{ render: renderEmptySpan }} />);

      expect(warnSpy).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining('Vase UI: The `#render` slot gave no element to the part.'),
      );
    });

    it('warns for both the element and `children` when the `#render` slot uses no slot prop', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await render(
        <VaporConditionalPart enabled withChildren v-slots={{ render: renderEmptySpan }} />,
      );

      expect(warnSpy.mock.calls).toEqual([
        [expect.stringContaining('Vase UI: The `#render` slot gave no element to the part.')],
        [expect.stringContaining('Vase UI: The `#render` slot did not mount `children`.')],
      ]);
    });

    it('does not warn when the part does not render the `#render` slot, also after another prop changes', async () => {
      const { rerender } = await render(
        <VaporConditionalPart enabled={false} count={0} v-slots={{ render: renderEmptySpan }} />,
      );

      await rerender(
        <VaporConditionalPart enabled={false} count={1} v-slots={{ render: renderEmptySpan }} />,
      );

      expect(takeReportedMessages()).toEqual([]);
    });

    it('warns when `as` comes after the mount of a part whose `#render` slot binds `props` in a Vapor consumer', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { rerender } = await render(
        <VaporRenderConsumer part={VaporConditionalPart} enabled form="bound" />,
      );
      expect(warnSpy).not.toHaveBeenCalled();

      await rerender(
        <VaporRenderConsumer part={VaporConditionalPart} enabled form="bound" as="section" />,
      );

      expect(warnSpy).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining('Vase UI: The `as` prop and the `#render` slot are both set.'),
      );
    });

    it('warns when the part hides after an update and shows again with a `#render` slot that uses no slot prop', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { rerender } = await render(
        <VaporRenderConsumer part={VaporConditionalPart} enabled form="bound" count={0} />,
      );
      await rerender(
        <VaporRenderConsumer part={VaporConditionalPart} enabled form="bound" count={1} />,
      );
      await rerender(
        <VaporRenderConsumer part={VaporConditionalPart} enabled={false} form="bound" count={1} />,
      );
      expect(warnSpy).not.toHaveBeenCalled();

      await rerender(
        <VaporRenderConsumer part={VaporConditionalPart} enabled form="empty" count={1} />,
      );

      expect(warnSpy).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining('Vase UI: The `#render` slot gave no element to the part.'),
      );
    });
  });

  describe('target component that exposes an element that it makes in `onMounted`', () => {
    it('gives the element to a part that renders the target after the mount', async () => {
      const refs = vi.fn();
      let component: ComponentWithElement | null = null;
      const Test = (props: { enabled: boolean }) => (
        <RerenderTestComponent
          enabled={props.enabled}
          as={MountedElementTarget}
          refs={refs}
          ref={(value) => {
            component = value as ComponentWithElement | null;
          }}
        />
      );
      const { rerender } = await render(<Test enabled={false} />);

      await rerender(<Test enabled />);

      const widget = screen.getByTestId('widget');
      expect(refs).toHaveBeenCalledTimes(1);
      expect(refs.mock.calls[0][0]).toBe(widget);
      expect(component!.element).toBe(widget);
    });

    it('gives the element to a part whose #render slot changes to the target after the mount', async () => {
      const refs = vi.fn();
      let component: ComponentWithElement | null = null;
      const Test = (props: { useTarget: boolean }) => (
        <RerenderTestComponent
          enabled
          refs={refs}
          ref={(value) => {
            component = value as ComponentWithElement | null;
          }}
          v-slots={{
            render: ({ props: partProps }: { props: HTMLProps }) =>
              props.useTarget ? <MountedElementTarget {...partProps} /> : <span {...partProps} />,
          }}
        />
      );
      const { container, rerender } = await render(<Test useTarget={false} />);
      const span = container.firstElementChild;
      expect(refs).toHaveBeenCalledExactlyOnceWith(span);
      expect(component!.element).toBe(span);

      await rerender(<Test useTarget />);

      const widget = screen.getByTestId('widget');
      expect(refs).toHaveBeenLastCalledWith(widget);
      expect(component!.element).toBe(widget);
      expect(takeReportedMessages()).toEqual([]);
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

  describe('focus listeners in the millisecond of the mount', () => {
    // A mocked clock moves only in `render`, `rerender`, `setProps` and `waitForLaterMillisecond`.
    // A focus in the flush of a mount or an update thus comes in the millisecond of the attach.
    function mockClock() {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      onTestFinished(() => {
        vi.useRealTimers();
      });
    }

    function createFocusPart() {
      const focusin = vi.fn();
      const focusout = vi.fn();
      const withHandlers = shallowRef(true);
      const Part = defineComponent(
        (props: TestComponentProps, { slots, expose }) => {
          const { element, elementProps } = useRenderElement('div', props, {
            props: (attrs) => [
              withHandlers.value
                ? { tabindex: 0, onFocusin: focusin, onFocusout: focusout }
                : { tabindex: 0 },
              attrs,
            ],
          });
          expose({ element });
          return () => renderPart(props, slots, elementProps, EMPTY_OBJECT);
        },
        { props: ['as'], inheritAttrs: false },
      );
      return { Part, focusin, focusout, withHandlers };
    }

    // It focuses the element with the test id `target` in `onMounted`. A capture listener on its
    // element is the first Vue listener of each focus inside it.
    const FocusOnMount = defineComponent((_, { slots }) => {
      onMounted(() => {
        screen.getByTestId('target').focus();
      });
      return () => <div>{slots.default?.()}</div>;
    });

    function stampFirst() {}

    it('runs the focusin handler of a part that gets the focus in the millisecond of its mount', async () => {
      mockClock();
      const { Part, focusin } = createFocusPart();

      await render(
        <FocusOnMount onFocusinCapture={stampFirst}>
          <Part data-testid="target" />
        </FocusOnMount>,
      );

      expect(focusin).toHaveBeenCalledTimes(1);
    });

    it('runs the focusin handler of an ancestor part when its child gets the focus in that millisecond', async () => {
      mockClock();
      const { Part, focusin } = createFocusPart();

      await render(
        <FocusOnMount>
          <Part>
            <input data-testid="target" onFocusin={stampFirst} />
          </Part>
        </FocusOnMount>,
      );

      expect(focusin).toHaveBeenCalledTimes(1);
      expect(focusin).toHaveBeenCalledWith(
        expect.objectContaining({ target: screen.getByTestId('target') }),
      );
    });

    it('runs each focus handler one time when Vue runs it', async () => {
      const { Part, focusin, focusout } = createFocusPart();
      await render(<Part data-testid="target" />);
      const element = screen.getByTestId('target');

      element.focus();
      element.blur();

      expect(focusin).toHaveBeenCalledTimes(1);
      expect(focusout).toHaveBeenCalledTimes(1);
    });

    it('runs the focus handler of each part one time when a part renders as another part', async () => {
      mockClock();
      const outer = createFocusPart();
      const inner = createFocusPart();

      await render(
        <FocusOnMount onFocusinCapture={stampFirst}>
          <outer.Part data-testid="target" as={inner.Part} />
        </FocusOnMount>,
      );

      expect(outer.focusin).toHaveBeenCalledTimes(1);
      expect(inner.focusin).toHaveBeenCalledTimes(1);
    });

    it('does not run the focus handler for an element that the part left', async () => {
      const { Part, focusin } = createFocusPart();
      const Test = defineComponent(
        (props: { bindSecond: boolean }) => () => (
          <Part
            v-slots={{
              render: ({ props: partProps }: { props: HTMLProps }) => [
                <button data-testid="first" {...(props.bindSecond ? {} : partProps)} />,
                <button data-testid="second" {...(props.bindSecond ? partProps : {})} />,
              ],
            }}
          />
        ),
        { props: ['bindSecond'] },
      );
      const { setProps } = await render(<Test bindSecond={false} />);

      await setProps({ bindSecond: true });
      screen.getByTestId('first').focus();
      expect(focusin).not.toHaveBeenCalled();
      screen.getByTestId('second').focus();
      expect(focusin).toHaveBeenCalledTimes(1);
    });

    it('runs the focus handler one time after a render removes it and adds it again', async () => {
      const { Part, focusin, withHandlers } = createFocusPart();
      await render(<Part data-testid="target" />);

      withHandlers.value = false;
      await nextTick();
      withHandlers.value = true;
      await nextTick();
      screen.getByTestId('target').focus();

      expect(focusin).toHaveBeenCalledTimes(1);
    });

    it('runs the focusin handler that a render adds when the focus comes in the millisecond of that render', async () => {
      mockClock();
      const { Part, focusin, withHandlers } = createFocusPart();
      withHandlers.value = false;
      // The JSX types of an element have no capture keys.
      await render(h('div', { onFocusinCapture: stampFirst }, [<Part data-testid="target" />]));

      withHandlers.value = true;
      await nextTick();
      screen.getByTestId('target').focus();

      expect(focusin).toHaveBeenCalledTimes(1);
    });

    it('runs the focusin handler of a part that gets the focus in the millisecond of its hydration', () => {
      mockClock();
      const { Part, focusin } = createFocusPart();
      const container = document.createElement('div');
      document.body.append(container);
      // The slot of `FocusOnMount` renders a fragment, so the server HTML has its two comments.
      container.innerHTML =
        '<div><!--[--><div tabindex="0" data-testid="target"></div><!--]--></div>';
      const app = createSSRApp({
        render: () => (
          <FocusOnMount onFocusinCapture={stampFirst}>
            <Part data-testid="target" />
          </FocusOnMount>
        ),
      });
      onTestFinished(() => {
        app.unmount();
        container.remove();
      });

      app.mount(container);

      expect(focusin).toHaveBeenCalledTimes(1);
      expect(takeReportedMessages()).toEqual([]);
    });

    it('gives an error of a focus handler that Vue skipped to the error handler of the app', () => {
      mockClock();
      const { Part, focusin } = createFocusPart();
      const error = new Error('focus handler');
      focusin.mockImplementation(() => {
        throw error;
      });
      const errorHandler = vi.fn();
      const container = document.createElement('div');
      document.body.append(container);
      const app = createApp({
        render: () => (
          <FocusOnMount onFocusinCapture={stampFirst}>
            <Part data-testid="target" />
          </FocusOnMount>
        ),
      });
      app.config.errorHandler = errorHandler;
      onTestFinished(() => {
        app.unmount();
        container.remove();
      });

      app.mount(container);

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith(error, expect.anything(), expect.any(String));
    });
  });
});
