import { vi, expect, describe, it } from 'vitest';
import { defineComponent, h, shallowRef } from 'vue';
import type { Component, ComponentPublicInstance, FunctionalComponent } from 'vue';
import { createRenderer } from '#test-utils';
import { resolveElement } from './resolveElement';

describe('resolveElement', () => {
  const { render } = createRenderer();

  // Renders the target with a function ref and gives the value that Vue gives to the ref.
  async function getRefValue(
    Target: Component | FunctionalComponent,
    props: Record<string, unknown> = {},
  ) {
    let value: Element | ComponentPublicInstance | null = null;
    const Test = () =>
      h(Target, {
        ...props,
        ref: (refValue: Element | ComponentPublicInstance | null) => {
          value = refValue;
        },
      });
    await render(<Test />);
    return value;
  }

  it('returns an element', () => {
    const element = document.createElement('div');

    expect(resolveElement(element)).toBe(element);
  });

  it('returns an element of another document', () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const element = iframe.contentDocument!.createElement('div');

    expect(element).not.toBeInstanceOf(Element);
    expect(resolveElement(element)).toBe(element);

    iframe.remove();
  });

  it('returns the element that a component exposes', async () => {
    const Target = defineComponent({
      setup(_, { expose }) {
        const inner = shallowRef<Element | null>(null);
        expose({ element: inner });
        return () => (
          <div>
            <span ref={inner} data-testid="inner" />
          </div>
        );
      },
    });

    const value = await getRefValue(Target);

    expect(resolveElement(value)).toBe(document.querySelector('[data-testid="inner"]'));
  });

  it.each([
    { name: 'null', exposed: null },
    { name: 'undefined', exposed: undefined },
  ])(
    'returns null for a component that exposes an empty element, and not its root element ($name)',
    async ({ exposed }) => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const Target = defineComponent({
        setup(_, { expose }) {
          expose({ element: shallowRef<Element | null | undefined>(exposed) });
          return () => <div />;
        },
      });

      const value = await getRefValue(Target);

      expect(resolveElement(value)).toBeNull();
      expect(warnSpy).not.toHaveBeenCalled();
    },
  );

  it('returns the root element of a component that has a string prop named element', async () => {
    const Target = defineComponent({
      props: { element: { type: String, default: 'section' } },
      setup: (props) => () => h(props.element, { 'data-testid': 'root' }),
    });

    const value = await getRefValue(Target);

    expect(resolveElement(value)).toBe(document.querySelector('[data-testid="root"]'));
  });

  // The SFC compiler makes one of these two forms from a `<script setup>` component that has no
  // `defineExpose`. A build with an inline template, such as a production build, makes the first.
  describe.each([
    {
      form: 'no expose call, as a build with an inline template makes it',
      setup: () => () => <div data-testid="root" />,
    },
    {
      form: 'an empty expose call, as a build with a separate template makes it',
      setup: (_: unknown, { expose }: { expose: () => void }) => {
        expose();
        return () => <div data-testid="root" />;
      },
    },
  ])('a component that has a prop named element and $form', ({ setup }) => {
    const Target = defineComponent({ props: { element: null }, setup });

    it.each([
      { name: 'no value', props: {} },
      { name: 'an element', props: { element: document.createElement('p') } },
    ])('returns the root element when the prop has $name', async ({ props }) => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const value = await getRefValue(Target, props);

      expect(resolveElement(value)).toBe(document.querySelector('[data-testid="root"]'));
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  it('returns the exposed element of a component that also has a prop named element', async () => {
    const Target = defineComponent({
      props: { element: null },
      setup(_, { expose }) {
        const inner = shallowRef<Element | null>(null);
        expose({ element: inner });
        return () => (
          <div>
            <span ref={inner} data-testid="inner" />
          </div>
        );
      },
    });

    const value = await getRefValue(Target, { element: 'section' });

    expect(resolveElement(value)).toBe(document.querySelector('[data-testid="inner"]'));
  });

  it('returns the exposed element of a value that has no $props, as a ref on a Vapor component gives it', () => {
    const element = document.createElement('div');

    expect(resolveElement({ element } as unknown as ComponentPublicInstance)).toBe(element);
  });

  it('returns the root element of a component', async () => {
    const Target = defineComponent({ setup: () => () => <div data-testid="root" /> });

    const value = await getRefValue(Target);

    expect(resolveElement(value)).toBe(document.querySelector('[data-testid="root"]'));
  });

  it('returns the root element of a component whose root is another component', async () => {
    const Inner = defineComponent({ setup: () => () => <div data-testid="root" /> });
    const Target = defineComponent({ setup: () => () => <Inner /> });

    const value = await getRefValue(Target);

    expect(resolveElement(value)).toBe(document.querySelector('[data-testid="root"]'));
  });

  it('returns the element that a ref on a functional component gives', async () => {
    const Target: FunctionalComponent = () => <div data-testid="root" />;

    const value = await getRefValue(Target);

    expect(value).toBeInstanceOf(HTMLElement);
    expect(resolveElement(value)).toBe(document.querySelector('[data-testid="root"]'));
  });

  it('returns null and warns one time for a fragment root, a text root and a comment root', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const FragmentRoot = defineComponent({
      setup: () => () => [<span key="a" />, <span key="b" />],
    });
    const TextRoot = defineComponent({ setup: () => () => 'text' });
    const CommentRoot = defineComponent({ setup: () => () => null });

    expect(resolveElement(await getRefValue(FragmentRoot))).toBeNull();
    expect(resolveElement(await getRefValue(TextRoot))).toBeNull();
    expect(resolveElement(await getRefValue(CommentRoot))).toBeNull();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/^Vase UI: The component has no single root element/);
  });

  it.each([
    { name: 'null', value: null },
    { name: 'undefined', value: undefined },
  ])('returns null for $name with no warning', ({ value }) => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(resolveElement(value)).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
