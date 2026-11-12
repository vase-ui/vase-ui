import { expect, describe, it, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import { createRenderer, describeConformance, hydrate, renderOnServer } from '#test-utils';
import ButtonPart from './ButtonPart.vue';

describe('<ButtonPart />', () => {
  const { render } = createRenderer();

  describeConformance(<ButtonPart />, () => ({
    // The suite has no assertion on `nativeButton`. `useButton` reports a tag that does not match
    // `nativeButton` with `console.error`, so this assertion fails a case that gives the wrong
    // value, or a case where `useButton` checks the wrong element. It is in `render` because
    // `test/setup.ts` resets the mocks in an `afterEach` hook that runs before one in this file.
    render: async (node) => {
      const errorSpy = vi.spyOn(console, 'error');
      const result = await render(node);
      expect(errorSpy).not.toHaveBeenCalled();
      return result;
    },
    refInstanceof: window.HTMLButtonElement,
    testRenderPropWith: 'button',
    button: true,
  }));

  it('follows a change of the disabled prop', async () => {
    const { container, setProps } = await render(<ButtonPart />);

    const element = container.firstElementChild as HTMLElement;
    expect(element).not.toHaveAttribute('disabled');

    await setProps({ disabled: true });

    expect(element).toHaveAttribute('disabled');
    expect(element).toHaveAttribute('data-disabled');
  });

  it('errors when the element of a wrapper component is not a button', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // The wrapper gives its inner element after its render.
    const Wrapper = defineComponent({
      inheritAttrs: false,
      setup(_, { attrs, expose }) {
        const inner = shallowRef<Element | null>(null);
        expose({ element: inner });
        return () => (
          <div>
            <span {...attrs} ref={inner} />
          </div>
        );
      },
    });

    await render(<ButtonPart as={Wrapper} />);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Vase UI: A component that acts as a button expected a native <button> because the `nativeButton` prop is true.',
      ),
    );
  });

  it.each([
    { name: 'a native button', props: {} },
    { name: 'a disabled native button', props: { disabled: true } },
    {
      name: 'a disabled element that is not a button',
      props: { as: 'span', nativeButton: false, disabled: true },
    },
  ])('hydrates $name without a mismatch', async ({ props }) => {
    const serverHtml = await renderOnServer('test/fixtures/ButtonPart.vue', props);

    await hydrate(ButtonPart, { serverHtml, props });
  });
});
