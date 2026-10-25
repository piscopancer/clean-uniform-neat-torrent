import type { Api } from './index'

declare global {
  interface Window {
    readonly api: Api
  }
}
