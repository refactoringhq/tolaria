export function isLinux(): boolean {
  if (typeof navigator === 'undefined') return false
  return navigator.userAgent.includes('Linux') && !navigator.userAgent.includes('Android')
}

export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false
  return navigator.userAgent.includes('Mac OS X') || navigator.userAgent.includes('Macintosh')
}
