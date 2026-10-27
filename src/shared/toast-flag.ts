import { Schema } from 'effect'

// imported by scripts/dev.ts under plain Node, so this module must not use path aliases

/**
 * Environment variable through which the dev script hands --toast to the renderer; electron-vite exposes variables
 * with this prefix to the renderer as import.meta.env.
 */
export const toastEnv = 'RENDERER_VITE_TOAST'

/** Values of --toast: test lets the T key show a random toast of the app with made-up data. */
export const toastFlags = ['test'] as const
export const ToastFlag = Schema.Literals(toastFlags)
export type ToastFlag = typeof ToastFlag.Type
