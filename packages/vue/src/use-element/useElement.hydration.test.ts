import { expect, test } from 'vitest';
import { nextTick } from 'vue';
import PartFormScenes from '../../test/fixtures/PartFormScenes.vue';
import { hydrate, renderOnServer } from '../../test/render';

test.each([
  { scene: 'default', tag: 'p' },
  { scene: 'link', tag: 'a' },
  { scene: 'component', tag: 'button' },
])(
  'the server HTML of the $scene element has the attributes, and the hydration keeps the element',
  async ({ scene, tag }) => {
    const props = { scene };
    const root = await renderOnServer('PartFormScenes', props);
    const element = root.querySelector('.Ancestor > *')!;
    expect(element.localName).toBe(tag);
    expect(element).toHaveAttribute('role', 'note');
    const exposed = hydrate(PartFormScenes, props, root);
    await nextTick();
    expect(root.querySelector('.Ancestor > *')).toBe(element);
    expect(exposed.part.element).toBe(element);
  },
);
