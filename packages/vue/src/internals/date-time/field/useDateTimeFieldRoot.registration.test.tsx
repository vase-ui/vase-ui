import { describe, expect, it } from 'vitest';
import { DateField } from '@vase-ui/vue/date-field';
import { TimeField } from '@vase-ui/vue/time-field';
import { createRenderer } from '#test-utils';

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
});
