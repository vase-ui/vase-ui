import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { defineComponent, KeepAlive, nextTick, shallowRef } from 'vue';
import type { VNode } from 'vue';
import { createRenderer, describeConformance, hydrate, renderOnServer, screen } from '#test-utils';
import FocusManagerPart from '../../../../test/fixtures/FocusManagerPart.vue';
import { REASONS } from '../../../internals/reasons';
import { createAttribute } from '../createAttribute';
import { usePortalContext } from './FloatingPortalContext';
import type { PortalContextValue } from './FloatingPortalContext';
import FloatingPortal from './FloatingPortal.vue';
import FloatingPortalHydration from './FloatingPortalHydration.test.vue';

const HYDRATION_FILE = 'src/utils/popups/portal/FloatingPortalHydration.test.vue';

type RenderSlotProps = { props: Record<string, unknown> };

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

describe('FloatingPortal', () => {
  const { render } = createRenderer();

  describeConformance(<FloatingPortal />, () => ({
    render,
    refInstanceof: window.HTMLDivElement,
  }));

  describe('guards and owner element', () => {
    it('renders the guards and the owner element around the place of the portal', async () => {
      await render(
        <div data-testid="host">
          <input data-testid="trigger" />
          <FloatingPortal data-testid="portal">
            <FocusManagerPart>
              <input data-testid="inside" />
            </FocusManagerPart>
          </FloatingPortal>
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
          <FloatingPortal>{hasFocusManager.value ? <FocusManagerPart /> : null}</FloatingPortal>
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
          <FloatingPortal>
            {managerProps ? <FocusManagerPart {...managerProps} /> : null}
          </FloatingPortal>
        </div>,
      );

      expect(listPlaceOfPortal(screen.getByTestId('host'))).toEqual([]);
    });

    it('sends the Tab key from the trigger to the first field of the popup, and Shift+Tab from the next field to the last one', async () => {
      await render(
        <div>
          <input data-testid="trigger" />
          <FloatingPortal>
            <FocusManagerPart>
              <input data-testid="first-inside" />
              <input data-testid="last-inside" />
            </FocusManagerPart>
          </FloatingPortal>
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
          <FloatingPortal>
            <FocusManagerPart>
              <input data-testid="inside" />
            </FocusManagerPart>
          </FloatingPortal>
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
          <FloatingPortal>
            <FocusManagerPart domReference={reference}>
              <input data-testid="inside" />
            </FocusManagerPart>
          </FloatingPortal>
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
            <FloatingPortal>
              <FocusManagerPart {...managerProps}>
                <input data-testid="inside" />
              </FocusManagerPart>
            </FloatingPortal>
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
            <FloatingPortal>
              <FocusManagerPart domReference={reference}>
                <input data-testid="inside" />
              </FocusManagerPart>
            </FloatingPortal>
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
          <FloatingPortal data-testid="portal">
            <FocusManagerPart open={open.value}>
              <Probe />
            </FocusManagerPart>
          </FloatingPortal>
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

    describe('the owner element', () => {
      it('is a span that the style of ownerVisuallyHidden hides', async () => {
        await render(
          <div data-testid="host">
            <FloatingPortal>
              <FocusManagerPart />
            </FloatingPortal>
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
            <FloatingPortal portalOwnerRole="group">
              <FocusManagerPart />
            </FloatingPortal>
          </div>,
        );

        expect(getOwner(screen.getByTestId('host'))).toHaveAttribute('role', 'group');
      });

      it.each<{ name: string; ownedId: string | null; create: () => VNode }>([
        {
          name: 'the generated id',
          ownedId: null,
          create: () => (
            <FloatingPortal data-testid="portal">
              <FocusManagerPart />
            </FloatingPortal>
          ),
        },
        {
          name: 'the id attribute',
          ownedId: 'custom-portal',
          create: () => (
            <FloatingPortal id="custom-portal" data-testid="portal">
              <FocusManagerPart />
            </FloatingPortal>
          ),
        },
        {
          name: 'the id of the #render slot',
          ownedId: 'rendered-portal',
          create: () => (
            <FloatingPortal
              v-slots={{
                render: ({ props }: RenderSlotProps) => (
                  <div {...props} id="rendered-portal" data-testid="portal">
                    <FocusManagerPart />
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
            <FloatingPortal id={id.value} data-testid="portal">
              <FocusManagerPart />
            </FloatingPortal>
          </div>
        ));
        const owner = getOwner(screen.getByTestId('host'));
        expect(owner).toHaveAttribute('aria-owns', 'first-portal');

        id.value = 'second-portal';
        await nextTick();

        expect(screen.getByTestId('portal')).toHaveAttribute('id', 'second-portal');
        expect(owner).toHaveAttribute('aria-owns', 'second-portal');
      });

      it('names no id when the #render slot gives the portal element no id', async () => {
        await render(
          <div data-testid="host">
            <FloatingPortal
              v-slots={{
                render: ({ props }: RenderSlotProps) => (
                  <div {...props} id={undefined}>
                    <FocusManagerPart />
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
          <FloatingPortal>
            <input
              data-testid="first"
              onFocusout={(event: FocusEvent) => {
                tabindexAtFocusout.push((event.target as HTMLElement).getAttribute('tabindex'));
              }}
            />
            <input data-testid="second" />
          </FloatingPortal>
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
          <FloatingPortal>
            <input
              data-testid="inside"
              onFocusin={(event: FocusEvent) => {
                tabindexAtFocus.push((event.target as HTMLElement).getAttribute('tabindex'));
              }}
            />
          </FloatingPortal>
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
          <FloatingPortal>
            <FocusManagerPart modal>
              <input data-testid="inside" />
            </FocusManagerPart>
          </FloatingPortal>
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
          <FloatingPortal>
            <FocusManagerPart open={open.value}>
              <input data-testid="inside" />
            </FocusManagerPart>
          </FloatingPortal>
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
          <FloatingPortal data-testid="portal">
            <FocusManagerPart>
              <input data-testid="input" />
            </FocusManagerPart>
          </FloatingPortal>
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

  describe('hydration', () => {
    it('renders no portal element and no guard on a server, and hydrates with no message', async () => {
      const serverHtml = await renderOnServer(HYDRATION_FILE);
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      // The portal leaves one comment between the two buttons. It has no guard and no content.
      expect(
        Array.from(template.content.firstElementChild!.childNodes, (node) => node.nodeName),
      ).toEqual(['BUTTON', '#comment', 'BUTTON']);

      await hydrate(FloatingPortalHydration, { serverHtml });

      // `hydrate` mounts two apps, so the document holds two portals, each with two guards.
      const portals = screen.getAllByTestId('portal');
      expect(portals).toHaveLength(2);
      for (const portal of portals) {
        expect(portal.parentElement).toBe(document.body);
        expect(portal).toContainElement(portal.querySelector('[data-testid="content"]'));
      }
      expect(getOutsideGuards()).toHaveLength(4);
    });
  });
});
