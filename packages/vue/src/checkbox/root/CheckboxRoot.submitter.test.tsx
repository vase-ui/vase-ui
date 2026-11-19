import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VNode } from 'vue';
import { Checkbox } from '@vase-ui/vue/checkbox';
import { createRenderer, fireEvent, screen } from '#test-utils';

describe('getDefaultFormSubmitter', () => {
  const { render } = createRenderer();

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  async function pressEnter(buttons: VNode, beforeForm?: VNode) {
    await render(
      <>
        {beforeForm}
        <form id="test-form" onSubmit={(event) => event.preventDefault()}>
          <Checkbox.Root />
          {buttons}
        </form>
      </>,
    );

    vi.useFakeTimers();
    const click = vi.spyOn(HTMLElement.prototype, 'click');
    await fireEvent.keyDown(screen.getByRole('checkbox'), { key: 'Enter' });
    vi.advanceTimersByTime(0);
    return click.mock.contexts;
  }

  it('returns the first submit button associated with the form', async () => {
    const targets = await pressEnter(
      <button id="internal" type="submit" />,
      <button id="external" form="test-form" type="submit" />,
    );
    expect(targets).toEqual([document.getElementById('external')]);
  });

  it('returns a disabled submit button when it is first in form.elements', async () => {
    const targets = await pressEnter(
      <>
        <button id="disabled" type="submit" disabled />
        <button id="enabled" type="submit" />
      </>,
    );
    expect(targets).toEqual([document.getElementById('disabled')]);
  });

  it('supports buttons with the default submit type', async () => {
    const targets = await pressEnter(
      <>
        <button id="default" />
        <button id="explicit" type="submit" />
      </>,
    );
    expect(targets).toEqual([document.getElementById('default')]);
  });

  it('supports input submitters from form.elements and ignores non-submit controls', async () => {
    const targets = await pressEnter(
      <>
        <button id="button" type="button" />
        <input id="reset" type="reset" />
        <input id="submit" type="submit" />
      </>,
    );
    expect(targets).toEqual([document.getElementById('submit')]);
  });

  it('returns null when there is no default submitter', async () => {
    const targets = await pressEnter(<button type="button" />);
    expect(targets).toEqual([]);
  });
});
