interface TranscriptScrollMetrics {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}

export function shouldFollowTranscript({ scrollTop, scrollHeight, clientHeight }: TranscriptScrollMetrics): boolean {
  return scrollHeight - scrollTop - clientHeight <= 24
}
