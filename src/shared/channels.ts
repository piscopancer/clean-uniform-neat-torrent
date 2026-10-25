/** IPC channel of a main-to-renderer push event; kept free of imports so the sandboxed preload can bundle it cheaply. */
export const eventChannel = <const K extends string>(name: K) => `event:${name}` as const
