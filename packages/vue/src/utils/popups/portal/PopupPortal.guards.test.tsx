import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { defineComponent, h, KeepAlive, nextTick, shallowRef } from 'vue';
import type { Component, VNode } from 'vue';
import {
  createHeldBranch,
  createRenderer,
  describeConformance,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
} from '#test-utils';
import FocusManagerPart from '../../../../test/fixtures/FocusManagerPart.vue';
import OwnIdElement from '../../../../test/fixtures/OwnIdElement.vue';
import { REASONS } from '../../../internals/reasons';
import { createAttribute } from '../createAttribute';
import { usePortalContext } from './PopupPortalContext';
import type { PortalContextValue } from './PopupPortalContext';
import { usePortalFocus } from './usePortalFocus';
import PopupPortal from './PopupPortal.vue';
import PopupPortalHydration from './PopupPortalHydration.test.vue';

const HYDRATION_FILE = 'src/utils/popups/portal/PopupPortalHydration.test.vue';

type RenderSlotProps = { props: Record<string, unknown>; children: Component };

// The elements that the portal renders in the place of the part, in document order. The owner
// element is the `span` that is not a guard. The portal element is in the container, so it is not
// in the list.
function listPlaceOfPortal(host: HTMLElement) {
  return Array.from(host.children, (child) => {
    if (child.hasAttribute(createAttribute('focus-guard'))) {
      return `guard ${child.getAttribute('data-type')}`;
    }
    return child.localName === 'span' ? 'owner' : (child.getAttribute('data-testid') ?? '');
  });
}

function getOwner(host: HTMLElement) {
  return Array.from(host.children).find(
    (child) => child.localName === 'span' && !child.hasAttribute(createAttribute('focus-guard')),
  )!;
}

function getOutsideGuards() {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-type="outside"]'));
}

// The Tab key skips this element, so a guard can reach it only as the reference of the focus
// manager.
function appendUntabbableReference() {
  const reference = document.createElement('button');
  reference.tabIndex = -1;
  document.body.append(reference);
  onTestFinished(() => reference.remove());
  return reference;
}

describe('PopupPortal with guards', () => {
  const { render } = createRenderer();

  describeConformance(<PopupPortal guards={usePortalFocus} />, () => ({
    elementIsRoot: false,
    render,
    refInstanceof: window.HTMLDivElement,
  }));

  describe('prop: disabled', () => {
    it('keeps no guards or owner for a focus manager that is not modal and gives its mode through context', async () => {
      let context: PortalContextValue | undefined;
      const Probe = defineComponent({
        setup() {
          context = usePortalContext();
          return () => null;
        },
      });
      await render(
        <div data-testid="host">
          <PopupPortal guards={usePortalFocus} disabled data-testid="portal">
            <FocusManagerPart>
              <Probe />
              <input />
            </FocusManagerPart>
          </PopupPortal>
        </div>,
      );

      expect(context?.inPlace.value).toBe(true);
      expect(context?.portalNode.value).toBe(screen.getByTestId('portal'));
      expect(context?.beforeInsideRef.value).toBe(null);
      expect(context?.afterInsideRef.value).toBe(null);
      expect(context?.beforeOutsideRef.value).toBe(null);
      expect(context?.afterOutsideRef.value).toBe(null);
      expect(listPlaceOfPortal(screen.getByTestId('host'))).toEqual(['portal']);
      expect(document.querySelector('[data-vase-ui-focus-guard]')).toBe(null);
      expect(document.querySelector('[aria-owns]')).toBe(null);
    });
  });

  describe('guards and owner element', () => {
    it('renders the guards and the owner element around the place of the portal', async () => {
      await render(
        <div data-testid="host">
          <input data-testid="trigger" />
          <PopupPortal guards={usePortalFocus} data-testid="portal">
            <FocusManagerPart>
              <input data-testid="inside" />
            </FocusManagerPart>
          </PopupPortal>
          <input data-testid="next" />
        </div>,
      );

      expect(listPlaceOfPortal(screen.getByTestId('host'))).toEqual([
        'trigger',
        'guard outside',
        'owner',
        'guard outside',
        'next',
      ]);
      expect(screen.getByTestId('portal').parentElement).toBe(document.body);
    });

    it('removes the guards and the owner element when the focus manager goes away', async () => {
      const hasFocusManager = shallowRef(true);
      await render(() => (
        <div data-testid="host">
          <PopupPortal guards={usePortalFocus}>
            {hasFocusManager.value ? <FocusManagerPart /> : null}
          </PopupPortal>
        </div>
      ));
      const host = screen.getByTestId('host');
      expect(listPlaceOfPortal(host)).toEqual(['guard outside', 'owner', 'guard outside']);

      hasFocusManager.value = false;
      await nextTick();

      expect(listPlaceOfPortal(host)).toEqual([]);
    });

    it.each<{ name: string; managerProps: Record<string, unknown> | null }>([
      { name: 'there is no focus manager', managerProps: null },
      { name: 'the popup is closed', managerProps: { open: false } },
      { name: 'the focus manager is modal', managerProps: { modal: true } },
    ])('renders no guard and no owner element when $name', async ({ managerProps }) => {
      await render(
        <div data-testid="host">
          <PopupPortal guards={usePortalFocus}>
            {managerProps ? <FocusManagerPart {...managerProps} /> : null}
          </PopupPortal>
        </div>,
      );

      expect(listPlaceOfPortal(screen.getByTestId('host'))).toEqual([]);
    });

    it('renders the owner element and no guards while the focus manager has a next focusable element, and the guards again when it has none', async () => {
      const nextFocusableElement = shallowRef<HTMLElement | null>(appendUntabbableReference());
      await render(() => (
        <div data-testid="host">
          <PopupPortal guards={usePortalFocus}>
            <FocusManagerPart nextFocusableElement={nextFocusableElement.value} />
          </PopupPortal>
        </div>
      ));
      const host = screen.getByTestId('host');
      expect(listPlaceOfPortal(host)).toEqual(['owner']);

      nextFocusableElement.value = null;
      await nextTick();

      expect(listPlaceOfPortal(host)).toEqual(['guard outside', 'owner', 'guard outside']);
    });

    it('sends the Tab key from the trigger to the first field of the popup, and Shift+Tab from the next field to the last one', async () => {
      await render(
        <div>
          <input data-testid="trigger" />
          <PopupPortal guards={usePortalFocus}>
            <FocusManagerPart>
              <input data-testid="first-inside" />
              <input data-testid="last-inside" />
            </FocusManagerPart>
          </PopupPortal>
          <input data-testid="next" />
        </div>,
      );

      screen.getByTestId('trigger').focus();
      await userEvent.tab();
      expect(screen.getByTestId('first-inside')).toHaveFocus();

      screen.getByTestId('next').focus();
      await userEvent.tab({ shift: true });
      expect(screen.getByTestId('last-inside')).toHaveFocus();
    });

    it('sends the focus from the first guard to the tabbable before it when the focus comes from inside the popup', async () => {
      await render(
        <div>
          <input data-testid="trigger" />
          <PopupPortal guards={usePortalFocus}>
            <FocusManagerPart>
              <input data-testid="inside" />
            </FocusManagerPart>
          </PopupPortal>
        </div>,
      );

      screen.getByTestId('inside').focus();
      getOutsideGuards()[0].focus();

      expect(screen.getByTestId('trigger')).toHaveFocus();
    });

    it('sends the focus from the first guard to the reference of the focus manager when no tabbable comes before it', async () => {
      const reference = appendUntabbableReference();
      await render(
        <div>
          <PopupPortal guards={usePortalFocus}>
            <FocusManagerPart domReference={reference}>
              <input data-testid="inside" />
            </FocusManagerPart>
          </PopupPortal>
        </div>,
      );

      screen.getByTestId('inside').focus();
      getOutsideGuards()[0].focus();

      expect(reference).toHaveFocus();
    });

    describe('the last guard, when the focus comes from inside the popup', () => {
      async function renderPopupBeforeNextField(managerProps: Record<string, unknown>) {
        await render(
          <div>
            <PopupPortal guards={usePortalFocus}>
              <FocusManagerPart {...managerProps}>
                <input data-testid="inside" />
              </FocusManagerPart>
            </PopupPortal>
            <input data-testid="next" />
          </div>,
        );
        screen.getByTestId('inside').focus();
        const lastGuard = getOutsideGuards()[1];
        lastGuard.focus();
        return lastGuard;
      }

      it('sends the focus to the tabbable after it', async () => {
        await renderPopupBeforeNextField({});

        expect(screen.getByTestId('next')).toHaveFocus();
      });

      it('sends the focus to the reference of the focus manager when no tabbable comes after it', async () => {
        const reference = appendUntabbableReference();
        await render(
          <div>
            <PopupPortal guards={usePortalFocus}>
              <FocusManagerPart domReference={reference}>
                <input data-testid="inside" />
              </FocusManagerPart>
            </PopupPortal>
          </div>,
        );

        screen.getByTestId('inside').focus();
        getOutsideGuards()[1].focus();

        expect(reference).toHaveFocus();
      });

      it('closes the popup when closeOnFocusOut is true', async () => {
        const handleOpenChange = vi.fn();
        const lastGuard = await renderPopupBeforeNextField({
          closeOnFocusOut: true,
          onOpenChange: handleOpenChange,
        });

        expect(handleOpenChange).toHaveBeenCalledTimes(1);
        const [open, eventDetails] = handleOpenChange.mock.lastCall!;
        expect(open).toBe(false);
        expect(eventDetails.reason).toBe(REASONS.focusOut);
        expect(eventDetails.event.type).toBe('focusin');
        expect(eventDetails.event.target).toBe(lastGuard);
      });

      it('keeps the popup open when closeOnFocusOut is false', async () => {
        const handleOpenChange = vi.fn();
        await renderPopupBeforeNextField({
          closeOnFocusOut: false,
          onOpenChange: handleOpenChange,
        });

        expect(handleOpenChange).not.toHaveBeenCalled();
      });
    });

    it('gives the focus manager the guards of the portal', async () => {
      let context: PortalContextValue | undefined;
      const open = shallowRef(true);
      const Probe = defineComponent({
        setup() {
          context = usePortalContext();
          return () => null;
        },
      });
      await render(() => (
        <div>
          <PopupPortal guards={usePortalFocus} data-testid="portal">
            <FocusManagerPart open={open.value}>
              <Probe />
            </FocusManagerPart>
          </PopupPortal>
        </div>
      ));
      const [firstGuard, lastGuard] = getOutsideGuards();

      expect(context!.portalNode.value).toBe(screen.getByTestId('portal'));
      expect(context!.beforeOutsideRef.value).toBe(firstGuard);
      expect(context!.afterOutsideRef.value).toBe(lastGuard);

      open.value = false;
      await nextTick();

      expect(context!.beforeOutsideRef.value).toBe(null);
      expect(context!.afterOutsideRef.value).toBe(null);
    });

    it('gives the focus manager no guards while the portal keeps only its owner element', async () => {
      let context: PortalContextValue | undefined;
      const Probe = defineComponent({
        setup() {
          context = usePortalContext();
          return () => null;
        },
      });
      await render(
        <div data-testid="host">
          <PopupPortal guards={usePortalFocus}>
            <FocusManagerPart nextFocusableElement={appendUntabbableReference()}>
              <Probe />
            </FocusManagerPart>
          </PopupPortal>
        </div>,
      );

      expect(listPlaceOfPortal(screen.getByTestId('host'))).toEqual(['owner']);
      expect(context!.beforeOutsideRef.value).toBe(null);
      expect(context!.afterOutsideRef.value).toBe(null);
    });

    describe('the owner element', () => {
      it('is a span that the style of ownerVisuallyHidden hides', async () => {
        await render(
          <div data-testid="host">
            <PopupPortal guards={usePortalFocus}>
              <FocusManagerPart />
            </PopupPortal>
          </div>,
        );
        const owner = getOwner(screen.getByTestId('host'));

        expect(owner.tagName).toBe('SPAN');
        expect(owner).toHaveStyle({
          position: 'fixed',
          clipPath: 'inset(50%)',
          top: '0px',
          left: '0px',
        });
        expect(owner).not.toHaveAttribute('role');
      });

      it('has the role that portalOwnerRole gives', async () => {
        await render(
          <div data-testid="host">
            <PopupPortal guards={usePortalFocus} portalOwnerRole="group">
              <FocusManagerPart />
            </PopupPortal>
          </div>,
        );

        expect(getOwner(screen.getByTestId('host'))).toHaveAttribute('role', 'group');
      });

      it.each<{ name: string; ownedId: string | null; create: () => VNode }>([
        {
          name: 'the generated id',
          ownedId: null,
          create: () => (
            <PopupPortal guards={usePortalFocus} data-testid="portal">
              <FocusManagerPart />
            </PopupPortal>
          ),
        },
        {
          name: 'the id attribute',
          ownedId: 'custom-portal',
          create: () => (
            <PopupPortal guards={usePortalFocus} id="custom-portal" data-testid="portal">
              <FocusManagerPart />
            </PopupPortal>
          ),
        },
        {
          name: 'the id of the #render slot',
          ownedId: 'rendered-portal',
          create: () => (
            <PopupPortal
              guards={usePortalFocus}
              v-slots={{
                render: ({ props, children }: RenderSlotProps) => (
                  <div {...props} id="rendered-portal" data-testid="portal">
                    {h(children, null, () => (
                      <FocusManagerPart />
                    ))}
                  </div>
                ),
              }}
            />
          ),
        },
      ])('names the id that the portal element has: $name', async ({ ownedId, create }) => {
        await render(<div data-testid="host">{create()}</div>);
        const owner = getOwner(screen.getByTestId('host'));
        const portal = screen.getByTestId('portal');

        expect(portal.id).not.toBe('');
        expect(owner).toHaveAttribute('aria-owns', ownedId ?? portal.id);
      });

      it('names the new id when the id of the portal element changes', async () => {
        const id = shallowRef('first-portal');
        await render(() => (
          <div data-testid="host">
            <PopupPortal guards={usePortalFocus} id={id.value} data-testid="portal">
              <FocusManagerPart />
            </PopupPortal>
          </div>
        ));
        const owner = getOwner(screen.getByTestId('host'));
        expect(owner).toHaveAttribute('aria-owns', 'first-portal');

        id.value = 'second-portal';
        await flushMicrotasks();

        expect(screen.getByTestId('portal')).toHaveAttribute('id', 'second-portal');
        expect(owner).toHaveAttribute('aria-owns', 'second-portal');
      });

      it('VUE-124: names the id that a component in the #render slot gives, and follows each change', async () => {
        const ownId = shallowRef('first');
        await render(
          <div data-testid="host">
            <PopupPortal
              guards={usePortalFocus}
              v-slots={{
                render: ({ props, children }: RenderSlotProps) => (
                  <OwnIdElement {...props} tag="div" ownId={ownId}>
                    {h(children, null, () => (
                      <FocusManagerPart />
                    ))}
                  </OwnIdElement>
                ),
              }}
            />
          </div>,
        );
        const owner = getOwner(screen.getByTestId('host'));
        await flushMicrotasks();
        const steps = [owner.getAttribute('aria-owns')];

        ownId.value = 'second';
        await flushMicrotasks();
        steps.push(owner.getAttribute('aria-owns'));
        const element = document.getElementById('second');

        ownId.value = '';
        await flushMicrotasks();
        steps.push(owner.getAttribute('aria-owns'));

        expect(steps).toEqual(['first', 'second', null]);
        expect(element).not.toBeNull();
      });

      it('has the role and names the id when the popup opens after the mount', async () => {
        const open = shallowRef(false);
        await render(() => (
          <div data-testid="host">
            <PopupPortal guards={usePortalFocus} portalOwnerRole="group" data-testid="portal">
              <FocusManagerPart open={open.value} />
            </PopupPortal>
          </div>
        ));
        const host = screen.getByTestId('host');
        expect(listPlaceOfPortal(host)).toEqual([]);

        open.value = true;
        await nextTick();

        const owner = getOwner(host);
        expect(owner).toHaveAttribute('role', 'group');
        expect(owner).toHaveAttribute('aria-owns', screen.getByTestId('portal').id);
      });

      it('names no id when the #render slot gives the portal element no id', async () => {
        await render(
          <div data-testid="host">
            <PopupPortal
              guards={usePortalFocus}
              v-slots={{
                render: ({ props, children }: RenderSlotProps) => (
                  <div {...props} id={undefined}>
                    {h(children, null, () => (
                      <FocusManagerPart />
                    ))}
                  </div>
                ),
              }}
            />
          </div>,
        );
        const [firstGuard, owner, lastGuard] = screen.getByTestId('host').children;

        expect(firstGuard).toHaveAttribute('data-type', 'outside');
        expect(lastGuard).toHaveAttribute('data-type', 'outside');
        expect(owner.tagName).toBe('SPAN');
        expect(owner).not.toHaveAttribute('aria-owns');
      });
    });
  });

  describe('focus inside the portal', () => {
    it('makes the elements untabbable when the focus leaves the portal, and tabbable when it comes back', async () => {
      const tabindexAtFocusout: (string | null)[] = [];
      await render(
        <div>
          <input data-testid="outside" />
          <PopupPortal guards={usePortalFocus}>
            <input
              data-testid="first"
              onFocusout={(event: FocusEvent) => {
                tabindexAtFocusout.push((event.target as HTMLElement).getAttribute('tabindex'));
              }}
            />
            <input data-testid="second" />
          </PopupPortal>
        </div>,
      );
      const outside = screen.getByTestId('outside');
      const first = screen.getByTestId('first');
      const second = screen.getByTestId('second');

      // The focus moves into the portal, inside it, and nowhere.
      outside.focus();
      first.focus();
      second.focus();
      second.blur();
      expect(tabindexAtFocusout).toEqual([null]);
      expect(first).not.toHaveAttribute('tabindex');
      expect(second).not.toHaveAttribute('tabindex');

      second.focus();
      outside.focus();
      expect(first).toHaveAttribute('tabindex', '-1');
      expect(second).toHaveAttribute('tabindex', '-1');

      first.focus();
      expect(first).not.toHaveAttribute('tabindex');
      expect(second).not.toHaveAttribute('tabindex');
    });

    it('makes the elements tabbable again before a focus listener of an element in the portal runs', async () => {
      const tabindexAtFocus: (string | null)[] = [];
      await render(
        <div>
          <input data-testid="outside" />
          <PopupPortal guards={usePortalFocus}>
            <input
              data-testid="inside"
              onFocusin={(event: FocusEvent) => {
                tabindexAtFocus.push((event.target as HTMLElement).getAttribute('tabindex'));
              }}
            />
          </PopupPortal>
        </div>,
      );
      const inside = screen.getByTestId('inside');
      inside.focus();
      screen.getByTestId('outside').focus();
      expect(inside).toHaveAttribute('tabindex', '-1');

      inside.focus();

      expect(tabindexAtFocus.at(-1)).toBe(null);
    });

    it('leaves the elements tabbable when the focus manager is modal', async () => {
      await render(
        <div>
          <input data-testid="outside" />
          <PopupPortal guards={usePortalFocus}>
            <FocusManagerPart modal>
              <input data-testid="inside" />
            </FocusManagerPart>
          </PopupPortal>
        </div>,
      );

      screen.getByTestId('inside').focus();
      screen.getByTestId('outside').focus();

      expect(screen.getByTestId('inside')).not.toHaveAttribute('tabindex');
    });

    it('makes the elements tabbable again when the popup opens', async () => {
      const open = shallowRef(true);
      await render(() => (
        <div>
          <input data-testid="outside" />
          <PopupPortal guards={usePortalFocus}>
            <FocusManagerPart open={open.value}>
              <input data-testid="inside" />
            </FocusManagerPart>
          </PopupPortal>
        </div>
      ));
      const inside = screen.getByTestId('inside');
      inside.focus();
      screen.getByTestId('outside').focus();
      expect(inside).toHaveAttribute('tabindex', '-1');

      open.value = false;
      await nextTick();
      expect(inside).toHaveAttribute('tabindex', '-1');

      open.value = true;
      await nextTick();
      expect(inside).not.toHaveAttribute('tabindex');
    });
  });

  it('VUE-5: takes the portal element and the guards out of the document while KeepAlive holds the part, and puts the same elements back', async () => {
    const Page = defineComponent({
      name: 'Page',
      setup: () => () => (
        <div data-testid="host">
          <PopupPortal guards={usePortalFocus} data-testid="portal">
            <FocusManagerPart>
              <input data-testid="input" />
            </FocusManagerPart>
          </PopupPortal>
        </div>
      ),
    });
    const Other = defineComponent({ name: 'Other', setup: () => () => <p /> });
    const showPage = shallowRef(true);
    await render(() => (
      <KeepAlive>{showPage.value ? <Page key="page" /> : <Other key="other" />}</KeepAlive>
    ));
    const portal = screen.getByTestId('portal');
    const input = screen.getByTestId<HTMLInputElement>('input');
    const guards = getOutsideGuards();
    const owner = getOwner(screen.getByTestId('host'));
    input.value = 'typed';
    input.focus();
    expect(guards).toHaveLength(2);
    expect(portal.parentElement).toBe(document.body);

    showPage.value = false;
    await nextTick();

    expect(portal.isConnected).toBe(false);
    expect(guards.map((guard) => guard.isConnected)).toEqual([false, false]);
    expect(owner.isConnected).toBe(false);
    expect(document.activeElement).toBe(document.body);

    showPage.value = true;
    await nextTick();

    expect(screen.getByTestId('portal')).toBe(portal);
    expect(portal.parentElement).toBe(document.body);
    expect(screen.getByTestId('input')).toBe(input);
    expect(input.value).toBe('typed');
    expect(getOutsideGuards().map((guard, index) => guard === guards[index])).toEqual([true, true]);
    expect(getOwner(screen.getByTestId('host'))).toBe(owner);
  });

  it('VUE-5: keeps the portal element, the guards and the owner element out of the document when the part mounts while KeepAlive holds its branch', async () => {
    const { HeldBranch, mountWhileHeld, show } = createHeldBranch(
      () => (
        <PopupPortal guards={usePortalFocus} data-testid="portal">
          <FocusManagerPart>
            <input />
          </FocusManagerPart>
        </PopupPortal>
      ),
      { renderBranch: (part) => <div data-testid="host">{part}</div> },
    );
    await render(() => <HeldBranch />);

    await mountWhileHeld();

    expect(screen.queryByTestId('portal')).toBe(null);
    expect(getOutsideGuards()).toEqual([]);
    expect(document.querySelector('[aria-owns]')).toBe(null);

    await show();

    const portal = screen.getByTestId('portal');
    const host = screen.getByTestId('host');
    expect(portal.parentElement).toBe(document.body);
    expect(listPlaceOfPortal(host)).toEqual(['guard outside', 'owner', 'guard outside']);
    expect(getOwner(host)).toHaveAttribute('aria-owns', portal.id);
  });

  it('VUE-120: sends the Tab key past the place of the portal while KeepAlive holds only the popup', async () => {
    const visible = shallowRef(true);
    await render(() => (
      <div>
        <input data-testid="trigger" />
        <PopupPortal guards={usePortalFocus}>
          <KeepAlive>
            {visible.value ? (
              <FocusManagerPart key="part">
                <input data-testid="first-inside" />
                <input data-testid="last-inside" />
              </FocusManagerPart>
            ) : null}
          </KeepAlive>
        </PopupPortal>
        <input data-testid="next" />
      </div>
    ));

    visible.value = false;
    await nextTick();

    screen.getByTestId('trigger').focus();
    await userEvent.tab();

    expect(screen.getByTestId('next')).toHaveFocus();
  });

  it('VUE-120: sends Shift+Tab past the place of the portal while KeepAlive holds only the popup', async () => {
    const visible = shallowRef(true);
    await render(() => (
      <div>
        <input data-testid="trigger" />
        <PopupPortal guards={usePortalFocus}>
          <KeepAlive>
            {visible.value ? (
              <FocusManagerPart key="part">
                <input data-testid="first-inside" />
                <input data-testid="last-inside" />
              </FocusManagerPart>
            ) : null}
          </KeepAlive>
        </PopupPortal>
        <input data-testid="next" />
      </div>
    ));

    visible.value = false;
    await nextTick();

    screen.getByTestId('next').focus();
    await userEvent.tab({ shift: true });

    expect(screen.getByTestId('trigger')).toHaveFocus();
  });

  it.each([
    { name: 'closeOnFocusOut true', closeOnFocusOut: true, shift: false, calls: 1 },
    { name: 'closeOnFocusOut false', closeOnFocusOut: false, shift: false, calls: 0 },
    { name: 'backward skip', closeOnFocusOut: true, shift: true, calls: 0 },
  ])(
    'VUE-120: asks for the close when the Tab key skips a held popup: $name',
    async ({ closeOnFocusOut, shift, calls }) => {
      const visible = shallowRef(true);
      const handleOpenChange = vi.fn();
      await render(() => (
        <div>
          <input data-testid="trigger" />
          <PopupPortal guards={usePortalFocus}>
            <KeepAlive>
              {visible.value ? (
                <FocusManagerPart
                  key="part"
                  closeOnFocusOut={closeOnFocusOut}
                  onOpenChange={handleOpenChange}
                >
                  <input data-testid="inside" />
                </FocusManagerPart>
              ) : null}
            </KeepAlive>
          </PopupPortal>
          <input data-testid="next" />
        </div>
      ));

      visible.value = false;
      await nextTick();

      screen.getByTestId(shift ? 'next' : 'trigger').focus();
      await userEvent.tab({ shift });

      expect(screen.getByTestId(shift ? 'trigger' : 'next')).toHaveFocus();
      expect(handleOpenChange).toHaveBeenCalledTimes(calls);
      if (calls > 0) {
        const [open, eventDetails] = handleOpenChange.mock.lastCall!;
        expect(open).toBe(false);
        expect(eventDetails.reason).toBe(REASONS.focusOut);
      }
    },
  );

  it.each([
    { name: 'forward', guardIndex: 0 },
    { name: 'backward', guardIndex: 1 },
  ])(
    'VUE-120: sends the focus to the reference of the focus manager when a guard skips a held popup with no tabbable outside: $name',
    async ({ guardIndex }) => {
      const reference = appendUntabbableReference();
      const visible = shallowRef(true);
      await render(() => (
        <div>
          <PopupPortal guards={usePortalFocus}>
            <KeepAlive>
              {visible.value ? (
                <FocusManagerPart key="part" domReference={reference}>
                  <input data-testid="inside" />
                </FocusManagerPart>
              ) : null}
            </KeepAlive>
          </PopupPortal>
        </div>
      ));

      visible.value = false;
      await nextTick();

      getOutsideGuards()[guardIndex].focus();

      expect(reference).toHaveFocus();
    },
  );

  it('VUE-120: enters the popup again through the same guards after KeepAlive shows it', async () => {
    const visible = shallowRef(true);
    await render(() => (
      <div>
        <input data-testid="trigger" />
        <PopupPortal guards={usePortalFocus}>
          <KeepAlive>
            {visible.value ? (
              <FocusManagerPart key="part">
                <input data-testid="first-inside" />
                <input data-testid="last-inside" />
              </FocusManagerPart>
            ) : null}
          </KeepAlive>
        </PopupPortal>
        <input data-testid="next" />
      </div>
    ));
    const guards = getOutsideGuards();

    visible.value = false;
    await nextTick();
    visible.value = true;
    await nextTick();

    expect(getOutsideGuards().map((guard, index) => guard === guards[index])).toEqual([true, true]);

    screen.getByTestId('trigger').focus();
    await userEvent.tab();
    expect(screen.getByTestId('first-inside')).toHaveFocus();

    screen.getByTestId('next').focus();
    await userEvent.tab({ shift: true });
    expect(screen.getByTestId('last-inside')).toHaveFocus();
  });

  describe('hydration', () => {
    it('renders no portal element and no guard on a server, and hydrates with no message', async () => {
      const serverHtml = await renderOnServer(HYDRATION_FILE);
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      // The portal leaves one comment between the two buttons. It has no guard and no content.
      expect(
        Array.from(template.content.firstElementChild!.childNodes, (node) => node.nodeName),
      ).toEqual(['BUTTON', '#comment', 'BUTTON']);

      await hydrate(PopupPortalHydration, { serverHtml });

      const portal = screen.getByTestId('portal');
      expect(portal.parentElement).toBe(document.body);
      expect(portal).toContainElement(screen.getByTestId('content'));
      expect(getOutsideGuards()).toHaveLength(2);
    });
  });
});
