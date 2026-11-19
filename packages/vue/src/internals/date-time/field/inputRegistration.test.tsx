import { describe, expect, it } from 'vitest';
import { defineComponent, onMounted } from 'vue';
import { DateField } from '@vase-ui/vue/date-field';
import { Field } from '@vase-ui/vue/field';
import { TimeField } from '@vase-ui/vue/time-field';
import { createRenderer } from '#test-utils';
import { useFieldRootContext } from '../../field-root-context';

describe.each([
  { name: 'DateField', Root: DateField.Root<Temporal.PlainDateTime>, Input: DateField.Input },
  { name: 'TimeField', Root: TimeField.Root<Temporal.PlainDateTime>, Input: TimeField.Input },
])('$name input registration', ({ Root, Input }) => {
  const { render } = createRenderer();

  it('exposes the form input after mount and clears it on removal', async () => {
    type RootRef = { inputElement: HTMLInputElement | null };
    let currentRoot: RootRef | undefined;
    let inputAtFirstRef: HTMLInputElement | null = null;
    function readRoot(instance: unknown) {
      if (instance && instance !== currentRoot) {
        currentRoot = instance as RootRef;
        inputAtFirstRef = currentRoot.inputElement;
      }
    }
    const form = (key: string) => <Root key={key} ref={readRoot} name="when" />;
    const { container, rerender, unmount } = await render(() => form('first'));
    const first = container.querySelector('input[name="when"]');
    expect(first).toBeInstanceOf(HTMLInputElement);
    expect(inputAtFirstRef).toBeNull();
    const firstRoot = currentRoot!;
    expect(firstRoot.inputElement).toBe(first);

    await rerender(() => form('second'));
    const second = container.querySelector('input[name="when"]');
    expect(second).toBeInstanceOf(HTMLInputElement);
    expect(second).not.toBe(first);
    expect(firstRoot.inputElement).toBe(null);
    expect(inputAtFirstRef).toBeNull();
    expect(currentRoot!.inputElement).toBe(second);

    unmount();
    expect(currentRoot!.inputElement).toBe(null);
  });

  it('registers the current control before either sibling mounts', async () => {
    const controls: (HTMLElement | null)[] = [];
    const Sibling = defineComponent(() => {
      const { validation } = useFieldRootContext();
      onMounted(() => controls.push(validation.getInputControl()));
      return () => null;
    });
    const children = (key: string) => (
      <Field.Root>
        <Sibling key={`before-${key}`} />
        <Root key={key} name="when">
          <Input />
        </Root>
        <Sibling key={`after-${key}`} />
      </Field.Root>
    );
    const { container, rerender } = await render(() => children('first'));
    const first = container.querySelector('[role="spinbutton"]');
    expect(first).toBeInstanceOf(HTMLInputElement);
    expect(controls).toEqual([first, first]);

    await rerender(() => children('second'));
    const second = container.querySelector('[role="spinbutton"]');
    expect(second).toBeInstanceOf(HTMLInputElement);
    expect(second).not.toBe(first);
    expect(controls).toEqual([first, first, second, second]);
  });
});
