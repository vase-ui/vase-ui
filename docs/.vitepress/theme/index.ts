// The reference line gives the samples and the demos of the site the global types of `Temporal`.
/// <reference lib="esnext.temporal" />
// A browser that has no `Temporal` gets the polyfill, with all its calendars.
import 'temporal-polyfill/full/global';
// `vitepress/theme` also puts the Inter font in the build, and the site does not use that font.
import DefaultTheme from 'vitepress/theme-without-fonts';
import '@fontsource-variable/hanken-grotesk';
import '@fontsource-variable/geist-mono';
import './tokens.css';
import './look.css';

export default DefaultTheme;
