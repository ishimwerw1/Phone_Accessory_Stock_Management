const isUtcMidnight = (d) =>
  d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0

export const todayStr = () => {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

export const toDateInput = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return ''
  // Dates stored at UTC midnight represent a pure calendar day — read the UTC parts
  // so the selected day never shifts across timezones.
  if (isUtcMidnight(d)) {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  }
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

export const formatDisplayDate = (value) => {
  if (!value) return '-'
  const d = new Date(value)
  if (isNaN(d.getTime())) return '-'
  if (isUtcMidnight(d)) return d.toLocaleDateString(undefined, { timeZone: 'UTC' })
  return d.toLocaleDateString()
}