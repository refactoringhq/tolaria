export function isInsertBeforeInput(nativeEvent: Pick<InputEvent, 'inputType'>) {
  return typeof nativeEvent.inputType === 'string'
    && nativeEvent.inputType.startsWith('insert')
}
