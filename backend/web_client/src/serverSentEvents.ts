const EVENT_SEPARATOR = '\n\n'
const LINE_SEPARATOR = '\n'
const DATA_FIELD_PREFIX = 'data:'

/** The data of one event block; null for a comment or a block without data. */
function readEventData(eventBlock: string): string | null {
  const dataLines: string[] = eventBlock
    .split(LINE_SEPARATOR)
    .filter((line: string): boolean => line.startsWith(DATA_FIELD_PREFIX))
    .map((line: string): string =>
      line.slice(DATA_FIELD_PREFIX.length).trimStart(),
    )
  return dataLines.length === 0 ? null : dataLines.join(LINE_SEPARATOR)
}

/**
 * Read a `text/event-stream` body to its end, handing over the data of each
 * event as it arrives. Resolves when the server closes the stream.
 */
export async function readServerSentEvents(
  body: ReadableStream<Uint8Array>,
  onEventData: (data: string) => void,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let unread = ''
  for (;;) {
    const chunk = await reader.read()
    if (chunk.done) {
      return
    }
    unread += decoder.decode(chunk.value, { stream: true })
    const eventBlocks: string[] = unread.split(EVENT_SEPARATOR)
    // The last block is still being received.
    unread = eventBlocks.pop() ?? ''
    for (const eventBlock of eventBlocks) {
      const data = readEventData(eventBlock)
      if (data !== null) {
        onEventData(data)
      }
    }
  }
}
