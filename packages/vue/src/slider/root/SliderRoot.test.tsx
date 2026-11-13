import { expect, describe, it } from 'vitest';
import { Field } from '@vase-ui/vue/field';
import {
  createRenderer,
  describeConformance,
  hydrate,
  renderOnServer,
  screen,
  within,
} from '#test-utils';
import * as Slider from '../index.parts';
import SliderRootHydration from './SliderRootHydration.test.vue';

describe('<Slider.Root />', () => {
  const { render } = createRenderer();

  describeConformance(<Slider.Root defaultValue={50} />, () => ({
    render,
    refInstanceof: window.HTMLDivElement,
  }));

  describe('hydration', () => {
    it('hydrates a root that names a label that does not exist, and the root then names none', async () => {
      const props = { id: 'volume', defaultValue: 30 };
      const serverHtml = await renderOnServer(
        'src/slider/root/SliderRootHydration.test.vue',
        props,
      );

      // A server cannot know that no label comes, so the root names the id that a label would have.
      // A `<template>` element parses the HTML with no side effect.
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      expect(
        template.content.querySelector('[role="group"]')?.getAttribute('aria-labelledby'),
      ).toBe('volume-label');

      const { container } = await hydrate(SliderRootHydration, { serverHtml, props });

      expect(within(container).getByRole('group')).not.toHaveAttribute('aria-labelledby');
    });
  });

  describe('Field', () => {
    it('Field.Description', async () => {
      await render(
        <Field.Root>
          <Slider.Root data-testid="slider" aria-describedby="external-description">
            <Slider.Control />
          </Slider.Root>
          <Field.Description data-testid="description" />
        </Field.Root>,
      );

      expect(screen.getByTestId('slider')).toHaveAttribute(
        'aria-describedby',
        `external-description ${screen.getByTestId('description').id}`,
      );
    });
  });
});
