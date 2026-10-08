import { errorMessageIncludes } from '../../utils/vaultErrors'

const RELEASED_WORKBOOK_MODEL_ERROR = 'null pointer passed to rust'
const WASM_BINDGEN_STACK_POINTER_EXPORT = '__wbindgen_add_to_stack_pointer'

export function isReleasedWorkbookModelError(error: unknown): boolean {
  return errorMessageIncludes(error, RELEASED_WORKBOOK_MODEL_ERROR)
}

export function isIronCalcWasmBridgeError(error: unknown): boolean {
  return isReleasedWorkbookModelError(error)
    || errorMessageIncludes(error, WASM_BINDGEN_STACK_POINTER_EXPORT)
}
