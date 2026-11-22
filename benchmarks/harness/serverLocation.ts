// `count.ts` and `options.ts` read the URL parameters when they load. The server render has no
// page, so it reads the parameters of a page that has none.
globalThis.location = { search: '' } as Location;
