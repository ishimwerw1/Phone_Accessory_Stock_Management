export const DEFAULT_AED_TO_USD = 0.2723
export const DEFAULT_USD_TO_RWF = 1330
export const RATE_KEYS = ['aedToUsd', 'usdToRwf']

export const extractRates = (settings = {}) => {
  const aedToUsd = Number(settings?.aedToUsd)
  const usdToRwf = Number(settings?.usdToRwf)
  return {
    aedToUsd: aedToUsd > 0 ? aedToUsd : DEFAULT_AED_TO_USD,
    usdToRwf: usdToRwf > 0 ? usdToRwf : DEFAULT_USD_TO_RWF
  }
}

export const convertAED = (aed, rates) => {
  const aedAmount = Number(aed || 0)
  const usd = aedAmount * rates.aedToUsd
  const rwf = usd * rates.usdToRwf
  return {
    usd: Math.round(usd * 100) / 100,
    rwf: Math.round(rwf)
  }
}