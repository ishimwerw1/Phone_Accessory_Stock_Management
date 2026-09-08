const { Setting } = require('../models');
const { getProvider, listProviders } = require('./exchangeRateProviders');

const DEFAULT_TTL_HOURS = Number(process.env.EXCHANGE_RATE_TTL_HOURS) || 6;
const DEFAULT_PROVIDER = process.env.EXCHANGE_RATE_PROVIDER || 'erApi';

const RATE_KEYS = ['aedToUsd', 'aedToRwf', 'usdToRwf'];

const loadStore = async () => {
  const rows = await Setting.find({ key: { $in: ['aedToUsd', 'aedToRwf', 'usdToRwf', 'exchangeRateProvider', 'exchangeRateRefreshHours', 'exchangeRateUpdatedAt'] } }).lean();
  const map = {};
  rows.forEach((r) => { map[r.key] = r.value; });
  return map;
};

const persist = async (fields) => {
  await Promise.all(
    Object.entries(fields).map(([key, value]) => Setting.updateOne({ key }, { $set: { value } }, { upsert: true }))
  );
};

const toIso = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const cacheMeta = (map, provider) => {
  const aedToUsd = Number(map.aedToUsd) || 0;
  const usdToRwf = Number(map.usdToRwf) || 0;
  const aedToRwf = Number(map.aedToRwf) || (aedToUsd && usdToRwf ? aedToUsd * usdToRwf : 0);
  const updatedAt = map.exchangeRateUpdatedAt ? toIso(map.exchangeRateUpdatedAt) : null;
  return {
    aedToUsd,
    aedToRwf,
    usdToRwf,
    provider: map.exchangeRateProvider || provider,
    updatedAt,
    refreshHours: Number(map.exchangeRateRefreshHours) || DEFAULT_TTL_HOURS,
  };
};

const isFresh = (meta, now = Date.now()) => {
  if (!meta.updatedAt) return false;
  const ageMs = now - new Date(meta.updatedAt).getTime();
  return ageMs >= 0 && ageMs < meta.refreshHours * 3600 * 1000;
};

const buildResult = (rates, meta) => ({
  aedToUsd: rates.aedToUsd,
  aedToRwf: rates.aedToRwf,
  usdToRwf: rates.usdToRwf,
  provider: rates.provider || meta.provider,
  source: rates.source || null,
  updatedAt: rates.updatedAt || meta.updatedAt || null,
  refreshHours: meta.refreshHours,
  fromCache: Boolean(rates.fromCache),
  fresh: Boolean(rates.fresh),
  stale: Boolean(rates.stale),
  warning: rates.warning || null,
});

/**
 * Reference for manual provider: raw settings used directly.
 */
const getExchangeRates = async ({ force = false, forWrite = false } = {}) => {
  const map = await loadStore();
  const providerName = map.exchangeRateProvider || DEFAULT_PROVIDER;
  const meta = cacheMeta(map, providerName);

  const useCache = RATE_KEYS.some((k) => Number(map[k]) > 0);

  if (!force && useCache && isFresh(meta)) {
    return buildResult({ ...meta, fromCache: true, fresh: true }, meta);
  }

  let provider;
  try {
    provider = getProvider(providerName);
    const fetched = await provider.fetchRates({ store: map });
    const updatedAt = toIso(fetched.providerTime) || new Date().toISOString();
    await persist({
      aedToUsd: fetched.aedToUsd,
      aedToRwf: fetched.aedToRwf,
      usdToRwf: fetched.usdToRwf,
      exchangeRateProvider: providerName,
      exchangeRateUpdatedAt: updatedAt,
      exchangeRateRefreshHours: meta.refreshHours,
    });
    return buildResult({ ...fetched, updatedAt, provider: providerName, fromCache: false, fresh: true }, meta);
  } catch (err) {
    if (useCache) {
      const result = buildResult({
        ...meta,
        provider: providerName,
        fromCache: true,
        fresh: false,
        stale: true,
        warning: `Latest exchange rate could not be retrieved (${providerName}: ${err.message}). Using cached rate from ${meta.updatedAt || 'an earlier sync'}. Refresh the rate in Settings.`,
      }, meta);
      if (forWrite) {
        const e = new Error(result.warning);
        e.status = 503;
        throw e;
      }
      return result;
    }
    const e = new Error(`Exchange-rate provider unavailable (${providerName}: ${err.message}). Configure exchange rates in Settings.`);
    e.status = 503;
    throw e;
  }
};

/**
 * Force a refresh from the provider. Throws if the provider fails AND no usable
 * cached rate exists; otherwise returns the cached (stale) rate with a warning.
 */
const refreshExchangeRates = async () => getExchangeRates({ force: true });

const convertAEDtoRWF = (aedAmount, rates) => {
  const aed = Number(aedAmount) || 0;
  const aedToUsd = Number(rates.aedToUsd) || 0;
  const aedToRwf = Number(rates.aedToRwf) || (Number(rates.usdToRwf) && aedToUsd ? Number(rates.usdToRwf) * aedToUsd : 0);
  const usdValue = aed * aedToUsd;
  const rwfValue = aed * aedToRwf;
  return {
    usd: Math.round(usdValue * 100) / 100,
    rwf: Math.round(rwfValue * 100) / 100,
    aedToUsd,
    aedToRwf,
    usdToRwf: Number(rates.usdToRwf) || 0,
  };
};

const convertAEDtoUSD = (aedAmount, rates) => {
  const aedToUsd = Number(rates.aedToUsd) || 0;
  return Math.round((Number(aedAmount) || 0) * aedToUsd * 100) / 100;
};

/**
 * Builds the full set of price fields (RWF final price + snapshot) for a
 * product saved with an AED buying price. `rates` is the object returned by
 * getExchangeRates(), `conversion` is the output of convertAEDtoRWF().
 */
const buildPriceFields = (aedAmount, rates, conversion) => {
  const aed = Number(aedAmount) || 0;
  return {
    buyingPrice: conversion.rwf,
    buyingPriceAED: aed,
    buyingPriceOriginal: aed,
    buyingCurrency: 'AED',
    buyingPriceUSD: conversion.usd,
    buyingPriceRWF: conversion.rwf,
    aedToUsdRate: conversion.aedToUsd,
    aedToRwfRate: conversion.aedToRwf,
    exchangeRateUpdatedAt: rates.updatedAt || null,
    exchangeRateSnapshot: {
      aedToUsd: conversion.aedToUsd,
      aedToRwf: conversion.aedToRwf,
      usdToRwf: conversion.usdToRwf,
      provider: rates.provider || null,
      source: rates.source || null,
      updatedAt: rates.updatedAt || null,
    },
  };
};

/**
 * Fetches current rates (fresh enforced for writes) and returns the ready-to-merge
 * price fields for a product being created or updated with an AED buying price.
 */
const convertAEDPrice = async (aedAmount) => {
  const rates = await getExchangeRates({ force: false, forWrite: true });
  const conversion = convertAEDtoRWF(aedAmount, rates);
  return buildPriceFields(aedAmount, rates, conversion);
};

const availableProviders = () => listProviders().map((p) => p.name);

module.exports = {
  getExchangeRates,
  refreshExchangeRates,
  convertAEDPrice,
  convertAEDtoRWF,
  convertAEDtoUSD,
  buildPriceFields,
  availableProviders,
  DEFAULT_TTL_HOURS,
  DEFAULT_PROVIDER,
  RATE_KEYS,
};