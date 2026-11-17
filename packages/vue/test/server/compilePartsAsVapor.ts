import type { Plugin } from 'vite';

const SRC = `${import.meta.dirname.replace(/\/test\/server$/, '')}/src/`;
const TEST_OR_TYPE_TEST = /\.(?:test|spec)\.vue$/;
const SCRIPT_SETUP = /<script\b[^>]*\bsetup\b/;

/**
 * Compiles each part SFC as a Vapor component. Adds `vapor` to its `<script setup>` below `src`,
 * except for test and type-test SFCs.
 */
export function compilePartsAsVapor(): Plugin {
  return {
    name: 'vase-ui:compile-parts-as-vapor',
    enforce: 'pre',
    transform(code, id) {
      if (!id.startsWith(SRC) || !id.endsWith('.vue') || TEST_OR_TYPE_TEST.test(id)) {
        return null;
      }
      if (!SCRIPT_SETUP.test(code)) {
        this.error(`${id} has no <script setup>, so it cannot compile as a Vapor component.`);
      }
      return { code: code.replace(SCRIPT_SETUP, (tag) => `${tag} vapor`), map: null };
    },
  };
}
