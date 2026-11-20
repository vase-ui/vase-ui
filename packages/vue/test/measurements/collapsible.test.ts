// Measurements with native elements and plain Vue, with no code of the library. Each one states
// what the browser or Vue does, so that the panels of Collapsible and Accordion have code only
// where they do not do it. Where the browsers differ, the measurement states each one.
import { afterEach, describe, expect, inject, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive, version } from 'vue';
import MeasureInjectedPanel from '../fixtures/MeasureInjectedPanel.vue';
import MeasureKeptHeight from '../fixtures/MeasureKeptHeight.vue';
import MeasureUntilFound from '../fixtures/MeasureUntilFound.vue';
import { hydrate, mount, renderOnServer } from '../render';
import { wait } from '../wait';
import { waitFor } from '../waitFor';

let root: HTMLElement | undefined;

afterEach(() => {
  root?.remove();
  root = undefined;
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
});

function html(markup: string) {
  root = document.body.appendChild(document.createElement('div'));
  root.innerHTML = markup;
  return root;
}

function element<T extends HTMLElement = HTMLElement>(id: string) {
  return root!.querySelector<T>(`#${id}`)!;
}

/** Counts the transitions that start on `target`. */
function countTransitions(target: Element) {
  const runs: string[] = [];
  target.addEventListener('transitionrun', (event) =>
    runs.push((event as TransitionEvent).propertyName),
  );
  return runs;
}

/** The patch of Vue 3.5, or `Infinity` for a later Vue. */
const patchOf35 = version.startsWith('3.5.') ? Number(version.split('.')[2]) : Infinity;

// The parts that call `useEnterAfterLeave` render their element in this way. `Avatar.Image` removes
// its element only in an update of its own props, which renders its `<Transition>` again.
describe('a <Transition> around a component that renders its root element by injected state', () => {
  // In a Vapor component, `<Transition>` takes the old element back. Vue 3.5.28 and earlier give
  // the second element its enter, and Vue 3.5.29 and later keep its enter classes
  // (https://github.com/vuejs/core/issues/16359).
  const vapor = inject('app').startsWith('vapor');
  const keepsEnterClasses = !vapor && patchOf35 >= 29;

  test('an open during a leave gives a second element, which keeps the enter classes after the leave ends with Vue 3.5.29 or later; Vapor gives one element', async () => {
    const scene = reactive({ open: false });
    const { root: host } = mount(MeasureInjectedPanel, { scene });
    const panels = () => [...host.querySelectorAll('.MeasurePanel')];
    scene.open = true;
    await nextTick();
    await wait(300);
    scene.open = false;
    await nextTick();
    scene.open = true;
    await nextTick();
    expect(panels()).toHaveLength(vapor ? 1 : 2);
    await wait(500);
    expect(panels().map((panel) => panel.className)).toEqual([
      keepsEnterClasses
        ? 'MeasurePanel measure-panel-enter-from measure-panel-enter-active'
        : 'MeasurePanel',
    ]);
  });

  test('a close that also renders the <Transition> again, and an open during the leave, end the leave at once and give the new element its enter', async () => {
    const scene = reactive({ open: false, version: 0 });
    const { root: host } = mount(MeasureInjectedPanel, { scene });
    const panels = () => [...host.querySelectorAll('.MeasurePanel')];
    scene.open = true;
    await nextTick();
    await wait(300);
    const [old] = panels();
    Object.assign(scene, { open: false, version: 1 });
    await nextTick();
    scene.open = true;
    await nextTick();
    expect(panels()).toHaveLength(1);
    expect(panels()[0]).not.toBe(old);
    await wait(500);
    expect(panels().map((panel) => panel.className)).toEqual(['MeasurePanel']);
  });
});

describe('hidden="until-found"', () => {
  // Vue writes the value on a server from 3.5.41, and from 3.6.0-rc.3 in Vue 3.6.
  const writesOnServer = patchOf35 >= 41;

  test('Vue writes the value in a client render, and on a server from Vue 3.5.41; the hydration keeps the server value with no message', async () => {
    const scene = reactive({ closed: true });
    const { root: client } = mount(MeasureUntilFound, { scene });
    const measured = client.querySelector('.Measured')!;
    expect(measured).toHaveAttribute('hidden', 'until-found');
    scene.closed = false;
    await nextTick();
    expect(measured).not.toHaveAttribute('hidden');
    scene.closed = true;
    await nextTick();
    expect(measured).toHaveAttribute('hidden', 'until-found');
    const server = await renderOnServer('MeasureUntilFound');
    const serverValue = writesOnServer ? 'until-found' : '';
    expect(server.querySelector('.Measured')).toHaveAttribute('hidden', serverValue);
    hydrate(MeasureUntilFound, {}, server);
    await nextTick();
    expect(server.querySelector('.Measured')).toHaveAttribute('hidden', serverValue);
  });

  test('at a fragment navigation, beforematch comes first and bubbles, the browser then removes hidden, and a task of the listener comes after; the closed box keeps its padding and border', async () => {
    html(`<div id="panel" hidden="until-found" style="padding: 10px; border: 2px solid">
      <p id="needle">Needle</p></div>`);
    const panel = element('panel');
    const order: string[] = [];
    expect(Math.round(panel.getBoundingClientRect().height)).toBe(24);
    root!.addEventListener('beforematch', (event) => {
      order.push(
        `beforematch ${panel.getAttribute('hidden')} ${event.bubbles} ${event.cancelable}`,
      );
      setTimeout(() => order.push(`task ${panel.getAttribute('hidden')}`));
    });
    new MutationObserver(() => order.push(`removed ${panel.getAttribute('hidden')}`)).observe(
      panel,
      { attributeFilter: ['hidden'] },
    );
    location.hash = 'needle';
    await waitFor(() => expect(order).toHaveLength(3));
    expect(order).toEqual(['beforematch until-found true false', 'removed null', 'task null']);
  });
});

describe('the scroll size of a box of height 0', () => {
  function sizes(style: string, reset = false) {
    html(`<div id="box" style="width: 200px; overflow: hidden; height: 0; ${style}">
      <div style="height: 80px; width: 300px">Content</div></div>`);
    const box = element('box');
    if (reset) {
      for (const name of ['justify-content', 'align-content', 'align-items', 'justify-items']) {
        box.style.setProperty(name, 'normal', 'important');
      }
    }
    const height = box.scrollHeight;
    root!.remove();
    return height;
  }

  test('is 0 for content that an end alignment moves out of the box: align-items in the three browsers, align-content also in Chromium and Firefox', () => {
    expect(sizes('display: flex; align-items: end')).toBe(0);
    expect(sizes('display: grid; align-content: end')).toBe(server.browser === 'webkit' ? 80 : 0);
  });

  test('is the height of the content with the four alignment properties at normal with the priority important; a flex item of a column shrinks', () => {
    expect(sizes('', true)).toBe(80);
    expect(sizes('display: flex; align-items: end !important; justify-content: end', true)).toBe(
      80,
    );
    expect(sizes('display: grid; align-content: end; justify-items: end', true)).toBe(80);
    expect(sizes('display: flex; flex-direction: column; justify-content: end', true)).toBeLessThan(
      80,
    );
  });
});

describe('a kept element whose hidden Vue writes, with the height of a variable', () => {
  async function scenario(props: Record<string, unknown>) {
    const scene = reactive({ open: false });
    const { root: host } = mount(MeasureKeptHeight, { scene, ...props });
    const target = host.firstElementChild!;
    const runs = countTransitions(target);
    // An app opens the element in a later task than the one of its mount.
    await wait(50);
    const toggle = async () => {
      scene.open = !scene.open;
      await nextTick();
      await wait(200);
      return [...runs];
    };
    return { toggle };
  }

  test('a write only after the open gives the first open no transition; a write also before each change gives each open one, from display: none', async () => {
    const after = await scenario({ kind: 'Variable', writes: 'after' });
    expect(await after.toggle()).toEqual([]);
    const both = await scenario({ kind: 'Variable', writes: 'both' });
    expect(await both.toggle()).toEqual(['height']);
    expect(await both.toggle()).toEqual(['height']);
    expect(await both.toggle()).toEqual(['height', 'height']);
  });

  test('a close has a transition when the [hidden] rule keeps the box', async () => {
    const kept = await scenario({ kind: 'VariableKeptBox', writes: 'both' });
    await kept.toggle();
    expect(await kept.toggle()).toEqual(['height', 'height']);
  });

  test('the grid rows animate an open and a close; with hidden="until-found" a close takes the height to 0 at once', async () => {
    const scene = reactive({ open: false });
    const heights = async (hiddenValue: boolean | string) => {
      const { root: host, unmount } = mount(MeasureKeptHeight, {
        scene,
        kind: 'Grid',
        hiddenValue,
      });
      const target = host.firstElementChild!;
      await wait(50);
      const height = async (open: boolean) => {
        scene.open = open;
        await nextTick();
        const start = target.getBoundingClientRect().height;
        await wait(200);
        return [start, target.getBoundingClientRect().height];
      };
      const result = [await height(true), await height(false)];
      unmount();
      return result;
    };
    expect(await heights(true)).toEqual([
      [0, 40],
      [40, 0],
    ]);
    expect(await heights('until-found')).toEqual([
      [0, 40],
      [0, 0],
    ]);
  });
});

describe('a fragment navigation into a closed hidden="until-found" element with grid rows', () => {
  const styles = `<style>
    .Rows { display: grid; grid-template-rows: 1fr }
    .Rows[hidden] { display: grid; grid-template-rows: 0fr }
    .Rows > * { min-height: 0; overflow: hidden }
    .Moving { transition: grid-template-rows 400ms linear }
  </style>`;

  async function reveal(classes: string, target: string) {
    html(`${styles}<div style="height: 1500px"></div>
      <div class="${classes}" hidden="until-found"><div><div style="height: 300px"></div>
      <p id="${target}">Needle</p><div style="height: 100px"></div></div></div>
      <div style="height: 1500px"></div>`);
    // A page has its layout before a user searches it.
    void root!.offsetHeight;
    location.hash = target;
    await waitFor(() => expect(location.hash).toBe(`#${target}`));
    await wait(600);
    const rect = element(target).getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= innerHeight;
  }

  test.skipIf(server.browser === 'webkit')(
    'leaves the text out of the view with a transition of the rows, in Chromium and Firefox',
    async () => {
      expect(await reveal('Rows Moving', 'moving-needle')).toBe(false);
    },
  );

  test('shows the text with no transition of the rows', async () => {
    expect(await reveal('Rows', 'still-needle')).toBe(true);
  });

  // `zzz` is a value of `hidden` that the browser does not know, as `until-found` in a browser
  // without the feature.
  test('a display of the developer on a hidden value that the browser does not know shows the content and its control; rules that leave out that value keep display: none', () => {
    html(`<style>
        .Shown { display: grid }
        .Scoped:not([hidden='zzz']) { display: grid }
      </style>
      <div id="shown" class="Shown" hidden="zzz"><button id="in-shown">A</button></div>
      <div id="scoped" class="Scoped" hidden="zzz"><button id="in-scoped">B</button></div>`);
    element('in-shown').focus();
    expect(document.activeElement).toBe(element('in-shown'));
    expect(getComputedStyle(element('shown')).display).toBe('grid');
    element('in-scoped').focus();
    expect(document.activeElement).toBe(element('in-shown'));
    expect(getComputedStyle(element('scoped')).display).toBe('none');
  });
});

// The case comes last: after its presses of Tab, WebKit does not scroll to a later fragment.
describe('a control in a closed kept element that CSS shows', () => {
  test('takes the focus of Tab and focus(); not with inert, and not with hidden="until-found"', async () => {
    html(`<style>.Shown[hidden] { display: block }</style>
      <input id="before" aria-label="Before">
      <div class="Shown" hidden><input id="plain" aria-label="Plain"></div>
      <div class="Shown" hidden inert><input id="inert" aria-label="Inert"></div>
      <div class="Shown" hidden="until-found"><input id="found" aria-label="Found"></div>
      <input id="after" aria-label="After">`);
    element('before').focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(element('plain'));
    await userEvent.tab();
    expect(document.activeElement).toBe(element('after'));
    const focused = ['plain', 'inert', 'found'].map((id) => {
      element(id).focus();
      return document.activeElement === element(id);
    });
    expect(focused).toEqual([true, false, false]);
  });
});
