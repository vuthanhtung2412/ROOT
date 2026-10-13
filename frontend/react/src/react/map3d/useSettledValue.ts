import { useEffect, useState } from 'react'

/**
 * A value that follows `value` once it has stopped changing for a while:
 * a window edge being dragged passes through many sizes, only the last one
 * is worth the work.
 */
export function useSettledValue<Value>(
  value: Value,
  settleMilliseconds: number,
): Value {
  const [settled, setSettled] = useState<Value>(value)

  useEffect(() => {
    const timer: number = window.setTimeout((): void => {
      setSettled(value)
    }, settleMilliseconds)
    return (): void => {
      window.clearTimeout(timer)
    }
  }, [value, settleMilliseconds])

  return settled
}
