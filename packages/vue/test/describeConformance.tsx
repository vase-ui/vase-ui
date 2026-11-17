import { describe } from 'vitest';
import type { VNode } from 'vue';
import { testAsProp } from './conformanceTests/asProp';
import { testClassName } from './conformanceTests/className';
import { testPropForwarding } from './conformanceTests/propForwarding';
import { testRefForwarding } from './conformanceTests/refForwarding';
import { testRenderProp } from './conformanceTests/renderProp';
import { testRenderSlot } from './conformanceTests/renderSlot';
import { testScopedStyle } from './conformanceTests/scopedStyle';
import { testVaporConsumer } from './conformanceTests/vaporConsumer';
import { createDescribe } from './createDescribe';
import type { VaseUIRenderResult } from './createRenderer';

/**
 * Options read by the Vase UI conformance suites.
 * Declared explicitly, so that an option that no suite reads fails the type check
 * and does not silently do nothing.
 */
export interface VaseUiConformanceTestsOptions {
  /**
   * The suite always passes a vnode, so a part test can wrap it:
   * `(node) => render(<Root>{node}</Root>)`.
   * The promise resolves when the part has its element. For a part with no element at mount,
   * the option makes the element appear: it renders an open root, or it does the action that
   * mounts the part.
   */
  render: (element: VNode) => Promise<VaseUIRenderResult>;
  /**
   * The constructor that the exposed `element` of the part is expected to be an instance of.
   */
  refInstanceof: abstract new (...args: any[]) => unknown;
  /**
   * The tag that the `as` prop, the `#render` slot and the prop-forwarding tests render in place of
   * the default element.
   * Rendering a `button` also sets `nativeButton` on components that accept it, and for those
   * components the tests run again with a `div` and `nativeButton={false}`.
   * In the project `vapor`, `conformanceTests/VaporConsumer.vue` renders a static element for each
   * tag. Add a tag that a new call needs.
   * @default 'div'
   */
  testRenderPropWith?: string;
  /**
   * Whether the component accepts the `nativeButton` prop.
   */
  button?: boolean;
  /**
   * Whether the component is allowed to be wrapped by an extra element for testing.
   * @default true
   */
  wrappingAllowed?: boolean;
  /**
   * A CSS selector that matches a node of the part itself, inside its element.
   * Give it for a part whose `#render` slot has the `children` prop.
   */
  childrenSelector?: string;
  /**
   * Whether the element of the part is the one root node of the part. Vue then gives the element
   * the scope id of the component that renders the part, so a rule of `<style scoped>` matches it.
   * Give `false` only when the design needs a node beside the element or the element is in a
   * `Teleport`. The suite then asserts that the rule does not match.
   * @default true
   */
  elementIsRoot?: boolean;
}

function describeConformanceFn(
  minimalElement: VNode,
  getOptions: () => VaseUiConformanceTestsOptions,
) {
  testPropForwarding(minimalElement, getOptions);
  testRefForwarding(minimalElement, getOptions);
  testRenderProp(minimalElement, getOptions);
  testClassName(minimalElement, getOptions);
  testAsProp(minimalElement, getOptions);
  testRenderSlot(minimalElement, getOptions);
  testScopedStyle(minimalElement, getOptions);
  testVaporConsumer(minimalElement, getOptions);

  const { button = false, testRenderPropWith } = getOptions();
  if (button && testRenderPropWith === 'button') {
    // Button parts also support rendering a non-button element with `nativeButton={false}`.
    describe('with a non-native button', () => {
      const getNonNativeOptions = (): VaseUiConformanceTestsOptions => ({
        ...getOptions(),
        testRenderPropWith: 'div',
      });
      testPropForwarding(minimalElement, getNonNativeOptions);
      testRenderProp(minimalElement, getNonNativeOptions);
    });
  }
}

export const describeConformance = createDescribe('Base UI component API', describeConformanceFn);
