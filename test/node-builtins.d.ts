/**
 * The project has no @types/node and installs none. This stands in for it,
 * declaring only the two Node builtin functions the fixture loader uses.
 */
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: string): string
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string
}
