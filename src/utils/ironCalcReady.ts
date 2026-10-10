import ironCalcWasmUrl from '@ironcalc/wasm/wasm_bg.wasm?url'
import { init as initIronCalc } from '@ironcalc/workbook'

let ironCalcInitPromise: Promise<void> | null = null

export function ensureIronCalcReady(): Promise<void> {
  if (!ironCalcInitPromise) {
    ironCalcInitPromise = initIronCalc(ironCalcWasmUrl)
      .then(() => undefined)
      .catch((error: Error) => {
        ironCalcInitPromise = null
        throw error
      })
  }
  return ironCalcInitPromise
}
