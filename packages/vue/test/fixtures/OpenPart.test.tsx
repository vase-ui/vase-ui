import { expect, describe, it, vi } from 'vitest';
import type { ComponentPublicInstance } from 'vue';
import { createRenderer, flushMicrotasks } from '#test-utils';
import OpenBindingForms from './OpenBindingForms.vue';
import type { OpenBindingForm, OpenBindingFormsPart } from './OpenBindingForms.vue';

type Harness = ComponentPublicInstance & { model: boolean };

interface FormRow {
  form: OpenBindingForm;
  startsOpen: boolean;
}

describe.each<{ part: OpenBindingFormsPart }>([{ part: 'plain' }, { part: 'generic' }])(
  'VUE-1: the controlled Boolean prop of the $part part',
  ({ part }) => {
    const { render } = createRenderer();

    async function renderForm(form: OpenBindingForm) {
      const handleOpenChange = vi.fn();
      const { container } = await render(
        <OpenBindingForms part={part} form={form} {...{ onOpenChange: handleOpenChange }} />,
      );
      return { element: container.firstElementChild as HTMLElement, handleOpenChange };
    }

    it.each<FormRow>([
      { form: 'absent', startsOpen: false },
      { form: 'undefined binding', startsOpen: false },
      { form: 'camel case', startsOpen: true },
      { form: 'kebab case', startsOpen: true },
    ])('leaves the part uncontrolled for the $form form', async ({ form, startsOpen }) => {
      const { element, handleOpenChange } = await renderForm(form);

      expect(element.hasAttribute('data-open')).toBe(startsOpen);

      element.click();
      await flushMicrotasks();

      expect(handleOpenChange).toHaveBeenCalledTimes(1);
      expect(element.hasAttribute('data-open')).toBe(!startsOpen);
    });

    it.each<FormRow>([
      { form: 'false binding', startsOpen: false },
      { form: 'bare attribute', startsOpen: true },
    ])('makes the part controlled for the $form form', async ({ form, startsOpen }) => {
      const { element, handleOpenChange } = await renderForm(form);

      expect(element.hasAttribute('data-open')).toBe(startsOpen);

      element.click();
      await flushMicrotasks();

      expect(handleOpenChange).toHaveBeenCalledTimes(1);
      expect(element.hasAttribute('data-open')).toBe(startsOpen);
    });

    it('makes the part controlled for the v-model form', async () => {
      let harness: Harness | null | undefined;
      const { container } = await render(() => (
        <OpenBindingForms
          part={part}
          form="v-model"
          ref={(instance) => {
            harness = instance as Harness | null;
          }}
        />
      ));
      const element = container.firstElementChild as HTMLElement;

      expect(element).not.toHaveAttribute('data-open');

      element.click();
      await flushMicrotasks();

      expect(harness!.model).toBe(true);
      expect(element).toHaveAttribute('data-open');

      harness!.model = false;
      await flushMicrotasks();

      expect(element).not.toHaveAttribute('data-open');
    });
  },
);
