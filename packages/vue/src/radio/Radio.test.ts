import { describe, expect, test, vi } from 'vitest';
import { nextTick, reactive } from 'vue';
import RadioChoices from '../../test/fixtures/RadioChoices.vue';
import RadioOutsideGroup from '../../test/fixtures/RadioOutsideGroup.vue';
import RadioParts from '../../test/fixtures/RadioParts.vue';
import { mount, mountError } from '../../test/render';

describe('the element', () => {
  test('is one native radio with the attributes of the developer; the group gives name, form and required', async () => {
    const { root } = mount(RadioChoices, {
      group: { name: 'storage', form: 'elsewhere', required: true },
      items: [{ key: 'ssd', value: 1, attrs: { class: 'Choice', 'aria-label': 'SSD' } }],
    });
    await nextTick();
    const radio = root.querySelector<HTMLInputElement>('#ssd')!;
    expect(radio.type).toBe('radio');
    expect(radio.value).toBe('1');
    expect(radio.getAttributeNames().sort()).toEqual([
      'aria-label',
      'class',
      'form',
      'id',
      'name',
      'required',
      'tabindex',
      'type',
      'value',
    ]);
  });

  test('outside a RadioGroup throws an error that says so', () => {
    const error = mountError(RadioOutsideGroup);
    expect((error as Error).message).toBe(
      'Vase UI: <Radio> must be inside <RadioGroup>. A radio with no group cannot hold a choice. Put <Radio> inside <RadioGroup>.',
    );
    // After the error, Vapor renders the part with no setup, and warns about each binding.
    vi.mocked(console.warn).mockClear();
  });

  test('the element slot renders the markup of the developer with the state; a template ref reaches the element', async () => {
    const { root, exposed } = mount(RadioParts, { group: { defaultValue: 'hdd' } });
    await nextTick();
    const [ssd, hdd] = root.querySelectorAll('input');
    expect(exposed.ssd.element).toBe(ssd);
    expect(exposed.styled.element).toBe(hdd);
    expect(hdd).toHaveClass('StyledInput');
    expect(root.querySelector('.Mark')).toHaveAttribute('data-mark', 'off');
    ssd!.click();
    await nextTick();
    expect(root.querySelector('.Mark')).toHaveAttribute('data-mark', 'on');
  });

  test('the group renders its element as the root, for Transition', async () => {
    const scene = reactive({ shown: false });
    const { root } = mount(RadioParts, { scene });
    scene.shown = true;
    await nextTick();
    expect(root.querySelector('[role=radiogroup]')).toHaveClass('v-enter-from', 'v-enter-active');
  });
});
