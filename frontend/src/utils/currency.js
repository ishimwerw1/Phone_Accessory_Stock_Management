export const RATE_KEYS = ['aedToUsd', 'aedToRwf', 'usdToRwf']

export const round2 = (n) => Math.round(Number(n || 0) * 100) / 100

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export const extractRates = (data = {}) => {
  const aedToUsd = num(data?.aedToUsd)
  const aedToRwf = num(data?.aedToRwf) || (num(data?.usdToRwf) && aedToUsd ? round2(num(data?.usdToRwf) * aedToUsd) : 0)
  const usdToRwf = num(data?.usdToRwf) || (aedToUsd && num(data?.aedToRwf) ? round2(num(data?.aedToRwf) / aedToUsd) : 0)
  return {
    aedToUsd,
    aedToRwf,
    usdToRwf,
    provider: data?.provider || null,
    source: data?.source || null,
    updatedAt: data?.updatedAt || null,
    refreshHours: data?.refreshHours || null,
    fromCache: Boolean(data?.fromCache),
    stale: Boolean(data?.stale),
    warning: data?.warning || data?.error || null,
  }
}

export const convertAED = (aed, rates = {}) => {
  const amount = Number(aed || 0)
  const aedToUsd = num(rates.aedToUsd)
  const aedToRwf = num(rates.aedToRwf) || (num(rates.usdToRwf) && aedToUsd ? round2(num(rates.usdToRwf) * aedToUsd) : 0)
  return {
    usd: round2(amount * aedToUsd),
    rwf: round2(amount * aedToRwf),
    aedToUsd,
    aedToRwf,
    usdToRwf: num(rates.usdToRwf),
  }
}

export const fmtUSD = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const fmtRWF = (n) => `${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RWF`

export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString() : '—')