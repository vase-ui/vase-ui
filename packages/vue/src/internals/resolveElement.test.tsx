import { vi, expect, describe, it } from 'vitest';
import { defineComponent, h, shallowRef } from 'vue';
import type { Component, ComponentPublicInstance, FunctionalComponent } from 'vue';
import { createRenderer } from '#test-utils';
import { resolveElement } from './resolveElement';

describe('resolveElement', () => {
  const { render } = createRenderer();

  // Renders the target with a function ref and gives the value that Vue gives to the ref.
  async function getRefValue(Target: Component | FunctionalComponent) {
    let value: Element | ComponentPublicInstance | null = null;
    const Test = () =>
      h(Target, {
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

  it('returns null for a component that exposes an empty element, and not its root element', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const Target = defineComponent({
      setup(_, { expose }) {
        expose({ element: shallowRef<Element | null>(null) });
        return () => <div />;
      },
    });

    const value = await getRefValue(Target);

    expect(resolveElement(value)).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
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
