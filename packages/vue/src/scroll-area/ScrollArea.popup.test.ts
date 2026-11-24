import { expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { reactive } from 'vue';
import ScrollAreaInDialogs from '../../test/fixtures/ScrollAreaInDialogs.vue';
import { mount, settle } from '../../test/render';
import { waitFor } from '../../test/waitFor';

function find(selector: string) {
  return document.querySelector<HTMLElement>(selector)!;
}

async function mountScene(initial: Record<string, boolean> = {}) {
  const scene = reactive({
    pageControl: true,
    extraOnPage: false,
    extraInDialog: false,
    fieldInDialog: true,
    lateArea: false,
    lateControl: true,
    ...initial,
  });
  mount(ScrollAreaInDialogs, { scene });
  await waitFor(() => expect(find('.page-viewport')).toHaveAttribute('data-has-overflow-y'));
  await settle();
  return scene;
}

test('a dialog whose body scrolls and holds a control gives the first focus to that control at each open, also when the dialog stays mounted and its content changes while it is closed', async () => {
  const scene = await mountScene();
  const trigger = find('.kept-trigger');
  await userEvent.click(trigger);
  await waitFor(() => expect(find('.first')).toHaveFocus());
  await waitFor(() => expect(find('.kept-viewport')).toHaveAttribute('data-has-overflow-y'));
  await settle();
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(trigger).toHaveFocus());
  scene.extraInDialog = true;
  await settle();

  await userEvent.click(trigger);
  await waitFor(() => expect(find('.first')).toHaveFocus());
  await settle();
  expect(find('.first')).toHaveFocus();
  expect(find('.kept-viewport').tabIndex).toBe(-1);
});

test('a viewport in a kept dialog whose last control leaves while the dialog is closed comes back to the Tab order at the next open', async () => {
  const scene = await mountScene();
  const trigger = find('.kept-trigger');
  const viewport = find('.kept-viewport');
  await userEvent.click(trigger);
  await waitFor(() => expect(find('.first')).toHaveFocus());
  await waitFor(() => expect(viewport).toHaveAttribute('data-has-overflow-y'));
  await settle();
  expect(viewport.tabIndex).toBe(-1);
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(trigger).toHaveFocus());
  scene.fieldInDialog = false;
  await settle();
  expect(viewport.tabIndex).toBe(-1);

  await userEvent.click(trigger);
  await waitFor(() => expect(viewport.tabIndex).toBe(0));
});

test('a kept dialog whose viewport starts with no control gives the first focus to a control that mounts while the dialog is closed', async () => {
  const scene = await mountScene({ fieldInDialog: false });
  const trigger = find('.kept-trigger');
  const viewport = find('.kept-viewport');
  await userEvent.click(trigger);
  await waitFor(() => expect(viewport.tabIndex).toBe(0));
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(trigger).toHaveFocus());
  scene.fieldInDialog = true;
  await settle();

  await userEvent.click(trigger);
  await waitFor(() => expect(find('.first')).toHaveFocus());
  await settle();
  expect(find('.first')).toHaveFocus();
  expect(viewport.tabIndex).toBe(-1);
});

test('a viewport on the page whose content changes while a modal dialog is open stays out of the Tab order after the close', async () => {
  const scene = await mountScene();
  const viewport = find('.page-viewport');
  expect(viewport.tabIndex).toBe(-1);
  await userEvent.click(find('.modal-trigger'));
  await waitFor(() => expect(viewport.closest('[inert]')).not.toBeNull());
  scene.extraOnPage = true;
  await settle();
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(document.querySelector('.modal')).toBeNull());
  await settle();
  expect(viewport.tabIndex).toBe(-1);
  find('.before').focus();
  await userEvent.keyboard('{Tab}');
  expect(find('.page-control')).toHaveFocus();
});

test('a viewport on the page whose last control leaves, or that gains a control, while a modal dialog is open updates its tab stop at the close', async () => {
  const scene = await mountScene();
  const viewport = find('.page-viewport');
  expect(viewport.tabIndex).toBe(-1);

  await userEvent.click(find('.modal-trigger'));
  await waitFor(() => expect(viewport.closest('[inert]')).not.toBeNull());
  scene.pageControl = false;
  await settle();
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(document.querySelector('.modal')).toBeNull());
  await waitFor(() => expect(viewport.tabIndex).toBe(0));
  find('.before').focus();
  await userEvent.keyboard('{Tab}');
  expect(viewport).toHaveFocus();

  await userEvent.click(find('.modal-trigger'));
  await waitFor(() => expect(viewport.closest('[inert]')).not.toBeNull());
  scene.pageControl = true;
  await settle();
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(document.querySelector('.modal')).toBeNull());
  await waitFor(() => expect(viewport.tabIndex).toBe(-1));
  find('.before').focus();
  await userEvent.keyboard('{Tab}');
  expect(find('.page-control')).toHaveFocus();
});

test('a scroll area that mounts on the page while a modal dialog is open has its tab stop after the close only when it holds no control', async () => {
  const scene = await mountScene({ lateControl: true });
  await userEvent.click(find('.modal-trigger'));
  await waitFor(() => expect(find('.page-viewport').closest('[inert]')).not.toBeNull());
  scene.lateArea = true;
  await waitFor(() => expect(find('.late-viewport')).toHaveAttribute('data-has-overflow-y'));
  await settle();
  expect(find('.late-viewport').tabIndex).toBe(-1);
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(document.querySelector('.modal')).toBeNull());
  await settle();
  expect(find('.late-viewport').tabIndex).toBe(-1);

  scene.lateArea = false;
  scene.lateControl = false;
  await settle();
  await userEvent.click(find('.modal-trigger'));
  await waitFor(() => expect(find('.page-viewport').closest('[inert]')).not.toBeNull());
  scene.lateArea = true;
  await waitFor(() => expect(find('.late-viewport')).toHaveAttribute('data-has-overflow-y'));
  await settle();
  expect(find('.late-viewport').tabIndex).toBe(-1);
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(document.querySelector('.modal')).toBeNull());
  await waitFor(() => expect(find('.late-viewport').tabIndex).toBe(0));
});
