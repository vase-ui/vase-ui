import { afterEach, describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { CollapsibleRootChangeEventDetails } from '@vase-ui/vue/collapsible';
import { expectNoAxeViolations } from '../../test/axe';
import { dataAttributes } from '../../test/field';
import CollapsibleElements from '../../test/fixtures/CollapsibleElements.vue';
import CollapsibleFound from '../../test/fixtures/CollapsibleFound.vue';
import CollapsibleParts from '../../test/fixtures/CollapsibleParts.vue';
import CollapsiblePartOutside from '../../test/fixtures/CollapsiblePartOutside.vue';
import CollapsibleScoped from '../../test/fixtures/CollapsibleScoped.vue';
import { mount, mountError, settle } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';
import { waitFor } from '../../test/waitFor';

afterEach(() => {
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
});

interface Setup {
  root?: Record<string, unknown>;
  trigger?: Record<string, unknown>;
  panel?: Record<string, unknown>;
  transition?: string;
  scene?: Record<string, unknown>;
}

async function mountCollapsible(setup: Setup = {}) {
  const log: string[] = [];
  const { root, exposed } = mount(CollapsibleParts, {
    ...setup,
    log: { add: (entry: string) => log.push(entry) },
  });
  await nextTick();
  const trigger = root.querySelector<HTMLElement>('[aria-expanded]')!;
  return {
    root,
    exposed,
    log,
    trigger,
    panels: () => [...root.querySelectorAll<HTMLElement>('.Panel')],
    panel: () => root.querySelector<HTMLElement>('.Panel'),
    press: async () => {
      trigger.click();
      await nextTick();
    },
  };
}

/** Props of a root that write each event in `log`. */
function rootEvents(log: string[], props: Record<string, unknown> = {}) {
  return reactive<Record<string, unknown>>({
    ...props,
    onOpenChange: (open: boolean, details: CollapsibleRootChangeEventDetails) =>
      log.push(`openChange ${open} ${details.reason} ${details.event.type}`),
    'onUpdate:open': (open: boolean) => log.push(`update ${open}`),
  });
}

/** Navigates to the fragment `id`, as a link to it does. */
async function navigateTo(id: string) {
  location.hash = id;
  await waitFor(() => expect(location.hash).toBe(`#${id}`));
  await settle();
}

describe('the elements', () => {
  test('render a div, a button with type="button" and a div; a template ref has element; the attributes of the developer win', async () => {
    const { root, exposed, trigger, panel, press } = await mountCollapsible({
      root: { class: 'Root' },
      trigger: { type: 'submit' },
      panel: { role: 'region' },
    });
    const element = root.querySelector('.Root')!;
    expect(element.tagName).toBe('DIV');
    expect(exposed.root.element).toBe(element);
    expect(exposed.trigger.element).toBe(trigger);
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger).toHaveAttribute('type', 'submit');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('aria-controls');
    expect(panel()).toBeNull();
    expect(dataAttributes(element)).toEqual([]);
    await press();
    expect(exposed.panel.element).toBe(panel());
    expect(panel()!.tagName).toBe('DIV');
    expect(panel()).toHaveAttribute('role', 'region');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', panel()!.id);
    expect(dataAttributes(element)).toEqual(['data-open']);
    expect(dataAttributes(trigger)).toEqual([]);
    expect(dataAttributes(panel()!)).toEqual([]);
  });

  test('a button has type="button" with no type of the developer, and no type with a type of undefined', async () => {
    const { trigger } = await mountCollapsible();
    expect(trigger).toHaveAttribute('type', 'button');
    const { trigger: untyped } = await mountCollapsible({ trigger: { type: undefined } });
    expect(untyped).not.toHaveAttribute('type');
  });

  test('render the element of the `element` slot with the props, the ref and the state; a span trigger is a button for the keys', async () => {
    const { root, exposed } = mount(CollapsibleElements);
    await nextTick();
    const section = root.querySelector('section')!;
    const span = root.querySelector('span')!;
    expect(exposed.root.element).toBe(section);
    expect(exposed.trigger.element).toBe(span);
    expect(span).toHaveAttribute('role', 'button');
    expect(span).toHaveAttribute('tabindex', '0');
    expect(span).not.toHaveAttribute('type');
    expect(section).toHaveAttribute('data-state', '{"open":false,"disabled":false}');
    span.focus();
    await userEvent.keyboard('{Enter}');
    await nextTick();
    const article = root.querySelector('article')!;
    expect(exposed.panel.element).toBe(article);
    expect(span).toHaveAttribute('aria-controls', article.id);
    expect(span).toHaveAttribute('data-state', '{"open":true,"disabled":false}');
    expect(article).toHaveAttribute('data-state', '{"open":true,"disabled":false}');
    await userEvent.keyboard(' ');
    await nextTick();
    expect(root.querySelector('article')).toBeNull();
  });

  test('render the tag of `as`; the `element` slot wins over it', async () => {
    const { exposed, trigger, panel } = await mountCollapsible({
      root: { as: 'section', defaultOpen: true },
      trigger: { as: 'span' },
      panel: { as: 'article' },
    });
    expect(exposed.root.element.tagName).toBe('SECTION');
    expect(trigger.tagName).toBe('SPAN');
    expect(trigger).toHaveAttribute('role', 'button');
    expect(trigger).not.toHaveAttribute('type');
    expect(panel()!.tagName).toBe('ARTICLE');
    const { root } = mount(CollapsibleElements, { trigger: { as: 'em' } });
    await nextTick();
    expect(root.querySelector('[role=button]')!.tagName).toBe('SPAN');
  });

  test('VUE-60: the panel has one root node; a scoped style and v-show reach its element', async () => {
    const scene = reactive({ shown: true });
    const { root } = mount(CollapsibleScoped, { scene });
    await nextTick();
    const panel = root.querySelector<HTMLElement>('.Scoped')!;
    expect(getComputedStyle(panel).outlineWidth).toBe('3px');
    scene.shown = false;
    await nextTick();
    expect(panel.style.display).toBe('none');
  });

});

describe('the state', () => {
  test('a press emits openChange with the reason and the click, then update:open; an uncontrolled root opens and closes', async () => {
    const log: string[] = [];
    const { trigger, press, panel } = await mountCollapsible({ root: rootEvents(log) });
    await press();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(panel()).not.toBeNull();
    await press();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(panel()).toBeNull();
    expect(log).toEqual([
      'openChange true trigger-press click',
      'update true',
      'openChange false trigger-press click',
      'update false',
    ]);
  });

  test('details.cancel() keeps the panel open or closed, and stops update:open', async () => {
    for (const defaultOpen of [false, true]) {
      const log: string[] = [];
      const root = rootEvents(log, { defaultOpen });
      root.onOpenChange = (open: boolean, details: CollapsibleRootChangeEventDetails) => {
        log.push(`openChange ${open}`);
        details.cancel();
      };
      const { trigger, press } = await mountCollapsible({ root });
      await press();
      expect(trigger).toHaveAttribute('aria-expanded', String(defaultOpen));
      expect(log).toEqual([`openChange ${!defaultOpen}`]);
    }
  });

  test('v-model:open: a controlled root shows the value of its parent, and a change of the parent emits nothing', async () => {
    const log: string[] = [];
    let write = false;
    const root = rootEvents(log, { open: false });
    root['onUpdate:open'] = (open: boolean) => {
      log.push(`update ${open}`);
      if (write) root.open = open;
    };
    const { trigger, press } = await mountCollapsible({ root });
    await press();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    write = true;
    await press();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    root.open = false;
    await nextTick();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(log).toEqual([
      'openChange true trigger-press click',
      'update true',
      'openChange true trigger-press click',
      'update true',
    ]);
  });

  test('VUE-157: a null open or defaultOpen from JavaScript is closed, with aria-expanded="false"', async () => {
    for (const root of [{ defaultOpen: null }, { open: null }]) {
      const { trigger, panel } = await mountCollapsible({ root });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(panel()).toBeNull();
    }
  });
});

describe('the trigger', () => {
  test('a disabled trigger or root gives the button disabled and the disabled state; a press emits nothing', async () => {
    for (const setup of [{ trigger: { disabled: true } }, { root: { disabled: true } }]) {
      const log: string[] = [];
      const { exposed, trigger, press } = await mountCollapsible({
        ...setup,
        root: rootEvents(log, setup.root),
      });
      expect(trigger).toBeDisabled();
      expect(trigger).toHaveTextContent('Trigger disabled');
      await userEvent.click(trigger, { force: true });
      await press();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(log).toEqual([]);
      expect(dataAttributes(exposed.root.element)).toEqual(setup.root ? ['data-disabled'] : []);
    }
  });

  test('VUE-112: a disabled fieldset disables a native trigger, and its state says it', async () => {
    const scene = reactive({ fieldset: false });
    const { trigger } = await mountCollapsible({ scene });
    expect(trigger.textContent!.trim()).toBe('Trigger');
    scene.fieldset = true;
    await waitFor(() => expect(trigger).toHaveTextContent('Trigger disabled'));
    expect(trigger).toBeDisabled();
  });

  test('Enter and Space on the native button open and close the panel', async () => {
    const { trigger } = await mountCollapsible();
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    await nextTick();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{ >}');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{/ }');
    await nextTick();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('the panel', () => {
  test('with keepMounted, a closed panel stays with hidden and inert, and its content keeps its state', async () => {
    const { panel, press } = await mountCollapsible({
      panel: { keepMounted: true },
      scene: { input: true },
    });
    const element = panel()!;
    expect(element).toHaveAttribute('hidden', '');
    expect(element).toHaveAttribute('inert');
    await press();
    expect(element).not.toHaveAttribute('hidden');
    expect(element).not.toHaveAttribute('inert');
    const input = element.querySelector('input')!;
    input.value = 'kept';
    await press();
    expect(panel()).toBe(element);
    expect(element).toHaveAttribute('hidden', '');
    expect(input.value).toBe('kept');
  });

  test('with hiddenUntilFound, a closed panel stays with hidden="until-found" and no inert', async () => {
    const { panel, press } = await mountCollapsible({ panel: { hiddenUntilFound: true } });
    expect(panel()).toHaveAttribute('hidden', 'until-found');
    expect(panel()).not.toHaveAttribute('inert');
    await press();
    expect(panel()).not.toHaveAttribute('hidden');
  });

  test('VUE-93: aria-controls names the id prop, follows a change of it, and names a generated id for an id of white space', async () => {
    const panelProps = reactive<Record<string, unknown>>({ id: 'manual' });
    const { trigger, panel } = await mountCollapsible({
      root: { defaultOpen: true },
      panel: panelProps,
    });
    expect(panel()).toHaveAttribute('id', 'manual');
    expect(trigger).toHaveAttribute('aria-controls', 'manual');
    panelProps.id = 'changed';
    await nextTick();
    expect(trigger).toHaveAttribute('aria-controls', 'changed');
    panelProps.id = ' ';
    await nextTick();
    expect(panel()!.id).not.toBe(' ');
    expect(trigger).toHaveAttribute('aria-controls', panel()!.id);
  });

  test('VUE-80: with no panel, an open trigger has no aria-controls; a swap of the panel names the new panel after the render', async () => {
    const scene = reactive<Record<string, unknown>>({ panel: false });
    const { trigger, root } = await mountCollapsible({ root: { defaultOpen: true }, scene });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).not.toHaveAttribute('aria-controls');
    scene.panel = true;
    await nextTick();
    const first = root.querySelector('.Panel')!.id;
    expect(trigger).toHaveAttribute('aria-controls', first);
    scene.panel = 'swap';
    await nextTick();
    expect(trigger).toHaveAttribute('aria-controls', 'swapped');
  });
});

describe('animation', () => {
  test('in a <Transition>, an open enters and a close leaves; the element stays until its leave ends; the first render has no class', async () => {
    const opened = await mountCollapsible({
      root: { defaultOpen: true },
      transition: 'collapsible-fade',
    });
    expect(opened.panel()!.className).toBe('Panel');
    expect(opened.log).toEqual([]);
    const { panel, panels, press, log } = await mountCollapsible({
      transition: 'collapsible-fade',
    });
    await press();
    expect(log).toEqual(['enter Panel collapsible-fade-enter-from collapsible-fade-enter-active']);
    await waitFor(() => expect(log).toContain('after-enter Panel'));
    await press();
    expect(log.at(-1)).toBe('leave Panel collapsible-fade-leave-from collapsible-fade-leave-active');
    expect(panels()).toHaveLength(1);
    await waitFor(() => expect(log).toContain('after-leave Panel'));
    expect(panel()).toBeNull();
  });

  test('an open during a leave renders one element at each moment; the new element enters after the old one goes', async () => {
    const { root, panel, panels, press, log } = await mountCollapsible({
      transition: 'collapsible-fade',
    });
    await press();
    await waitFor(() => expect(log).toContain('after-enter Panel'));
    let most = 0;
    const observer = new MutationObserver(() => (most = Math.max(most, panels().length)));
    observer.observe(root, { childList: true, subtree: true });
    await press();
    const old = panel();
    await press();
    expect(panels()).toEqual([old]);
    await waitFor(() => expect(log.filter((entry) => entry.startsWith('after-enter'))).toHaveLength(2));
    observer.disconnect();
    expect(most).toBe(1);
    expect(panel()).not.toBe(old);
    expect(panel()!.className).toBe('Panel');
  });

  test('a close during an enter leaves, and fast presses end with the state of the last press', async () => {
    const { panel, panels, press, log } = await mountCollapsible({
      transition: 'collapsible-fade',
    });
    await press();
    await press();
    expect(log.at(-1)).toMatch(/^leave /);
    await waitFor(() => expect(log.at(-1)).toMatch(/^after-leave /));
    expect(panel()).toBeNull();
    for (let count = 0; count < 3; count++) await press();
    await waitFor(() => expect(log.at(-1)).toBe('after-enter Panel'));
    expect(panels()).toHaveLength(1);
    expect(panel()!.className).toBe('Panel');
    for (let count = 0; count < 3; count++) await press();
    await waitFor(() => expect(log.at(-1)).toMatch(/^after-leave /));
    await settle();
    expect(panel()).toBeNull();
  });

  test('an open during a leave of JavaScript hooks waits for the call of done', async () => {
    const { panel, panels, press, log } = await mountCollapsible({ transition: 'js' });
    await press();
    await press();
    const old = panel();
    await press();
    expect(panels()).toEqual([old]);
    await waitFor(() => expect(log).toEqual(['enter Panel', 'leave Panel', 'done Panel', 'enter Panel']));
    expect(panels()).toHaveLength(1);
    expect(panel()).not.toBe(old);
  });
});

describe('size variables', () => {
  test('in a <Transition>, the variables are on the element before v-enter-to and at v-leave-from, and they follow the content', async () => {
    const scene = reactive({ lines: 2 });
    const { panel, press, log, root } = await mountCollapsible({
      transition: 'collapsible-size',
      scene,
    });
    const enterTo: string[] = [];
    const observer = new MutationObserver(() => {
      const element = panel();
      if (element?.classList.contains('collapsible-size-enter-to')) {
        enterTo.push(element.style.getPropertyValue('--collapsible-panel-height'));
      }
    });
    observer.observe(root, { attributeFilter: ['class'], subtree: true });
    await press();
    await waitFor(() => expect(log).toContain('after-enter Panel'));
    expect(enterTo[0]).toBe('40px');
    expect(panel()!.style.getPropertyValue('--collapsible-panel-width')).toMatch(/^\d+px$/);
    scene.lines = 4;
    await nextTick();
    await press();
    expect(panel()!.style.getPropertyValue('--collapsible-panel-height')).toBe('80px');
    expect(panel()!.getBoundingClientRect().height).toBe(80);
    observer.disconnect();
  });

  test('after an open during a leave, the new element has the variables before v-enter-to', async () => {
    const { panel, press, log, root } = await mountCollapsible({
      transition: 'collapsible-size',
      scene: { lines: 3 },
    });
    await press();
    await waitFor(() => expect(log).toContain('after-enter Panel'));
    await press();
    const old = panel();
    await press();
    const heights: string[] = [];
    const observer = new MutationObserver(() => {
      const element = panel();
      if (element !== old && element?.classList.contains('collapsible-size-enter-to')) {
        heights.push(element.style.getPropertyValue('--collapsible-panel-height'));
      }
    });
    observer.observe(root, { attributeFilter: ['class'], subtree: true });
    await waitFor(() => expect(log.filter((entry) => entry.startsWith('after-enter'))).toHaveLength(2));
    observer.disconnect();
    expect(heights[0]).toBe('60px');
  });

  test('a kept panel with the height of the variable has a transition at its first open and at a close', async () => {
    const { panel, press } = await mountCollapsible({
      panel: { keepMounted: true, class: 'KeptSize' },
      scene: { lines: 2 },
    });
    const element = panel()!;
    const runs: string[] = [];
    element.addEventListener('transitionrun', (event) => runs.push(event.propertyName));
    await press();
    await waitFor(() => expect(runs).toEqual(['height']));
    await waitFor(() => expect(element.getBoundingClientRect().height).toBe(element.scrollHeight));
    await press();
    await waitFor(() => expect(runs).toEqual(['height', 'height']));
  });

  test('a control in a closed kept panel that CSS shows takes no focus', async () => {
    const { root, panel, trigger } = await mountCollapsible({
      panel: { keepMounted: true, class: 'KeptSize' },
      scene: { input: true },
    });
    const inside = panel()!.querySelector('input')!;
    inside.focus();
    expect(document.activeElement).not.toBe(inside);
    trigger.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(root.querySelector('[aria-label=After]'));
  });

  test('VUE-156: an end-aligned panel has the height of its content; the inline alignment of the developer comes back with its priority', async () => {
    for (const style of [
      'display: flex; align-items: end; justify-content: end',
      'display: grid; align-content: end !important; justify-items: end',
    ]) {
      const { panel, press, log } = await mountCollapsible({
        transition: 'collapsible-size',
        panel: { style: `${style}; align-content: end !important` },
        scene: { lines: 1 },
      });
      await press();
      const element = panel()!;
      expect(element.style.getPropertyValue('--collapsible-panel-height')).toBe('20px');
      expect(element.style.getPropertyValue('align-content')).toBe('end');
      expect(element.style.getPropertyPriority('align-content')).toBe('important');
      expect(element.style.getPropertyPriority('justify-content')).toBe('');
      await waitFor(() => expect(log).toContain('after-enter Panel'));
    }
  });
});

describe('find-in-page', () => {
  test('a fragment navigation opens a closed hiddenUntilFound panel with the reason none and the beforematch event', async () => {
    const log: string[] = [];
    const { panel, trigger } = await mountCollapsible({
      root: rootEvents(log),
      panel: { hiddenUntilFound: true },
    });
    await navigateTo('collapsible-target');
    expect(log).toEqual(['openChange true none beforematch', 'update true']);
    expect(panel()).not.toHaveAttribute('hidden');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  test('a beforematch from a panel in the panel does nothing to the outer root', async () => {
    const log: string[] = [];
    const { root } = await mountCollapsible({
      root: rootEvents(log, { defaultOpen: true }),
      scene: { nested: true },
    });
    await navigateTo('collapsible-inner-target');
    await waitFor(() =>
      expect(root.querySelector('.Nested > div')).not.toHaveAttribute('hidden'),
    );
    expect(log).toEqual([]);
  });

  test('a cancelled open and an open that the parent refuses get hidden="until-found" back; a disabled root opens', async () => {
    const cancelled = rootEvents([], {});
    cancelled.onOpenChange = (_: boolean, details: CollapsibleRootChangeEventDetails) =>
      details.cancel();
    for (const root of [cancelled, { open: false }]) {
      const { panel, trigger, root: element } = await mountCollapsible({
        root,
        panel: { hiddenUntilFound: true },
      });
      await navigateTo('collapsible-target');
      await waitFor(() => expect(panel()).toHaveAttribute('hidden', 'until-found'));
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      history.replaceState(null, '', location.pathname + location.search);
      element.remove();
    }
    const { panel } = await mountCollapsible({
      root: { disabled: true },
      panel: { hiddenUntilFound: true },
    });
    await navigateTo('collapsible-target');
    expect(panel()).not.toHaveAttribute('hidden');
  });

  test('with the CSS of the docs, the found text is in the view, and the closed panel has no display of that CSS', async () => {
    const { root } = mount(CollapsibleFound);
    await nextTick();
    const panel = root.querySelector<HTMLElement>('.FoundPanel')!;
    expect(getComputedStyle(panel).display).toBe('block');
    await navigateTo('found-target');
    await new Promise((resolve) => setTimeout(resolve, 300));
    const rect = root.querySelector('#found-target')!.getBoundingClientRect();
    expect(rect.top).toBeGreaterThanOrEqual(0);
    expect(rect.bottom).toBeLessThanOrEqual(innerHeight);
  });
});

describe('accessibility', () => {
  test('has no axe violation while closed and while open', async () => {
    const { root, press } = await mountCollapsible({ panel: { keepMounted: true } });
    await expectNoAxeViolations(root);
    await press();
    await expectNoAxeViolations(root);
  });
});

// The cases throw in `setup`, so they are the last of the file.
describe('the errors', () => {
  test.each(['trigger', 'panel'])('a %s outside a root throws an error that says so', (part) => {
    expect((mountError(CollapsiblePartOutside, { part }) as Error).message).toBe(
      'Vase UI: A part of Collapsible must be inside <Collapsible.Root>. Without a root the part has no open state to read. Put the part inside <Collapsible.Root>.',
    );
    // After the error, Vapor renders the part with no setup, and warns about each binding.
    takeReportedMessages();
  });
});
