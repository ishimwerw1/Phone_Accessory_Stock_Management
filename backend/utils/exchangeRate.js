const { Setting } = require('../models');

const DEFAULT_AED_TO_USD = 0.2723;
const DEFAULT_USD_TO_RWF = 1330;

const getExchangeRates = async () => {
  const rows = await Setting.find({ key: { $in: ['aedToUsd', 'usdToRwf'] } }).lean();
  const map = {};
  rows.forEach((r) => { map[r.key] = r.value; });
  return {
    aedToUsd: Number(map.aedToUsd) || DEFAULT_AED_TO_USD,
    usdToRwf: Number(map.usdToRwf) || DEFAULT_USD_TO_RWF,
  };
};

const convertAEDtoRWF = (aedAmount, rates) => {
  const usd = Number(aedAmount) * rates.aedToUsd;
  const rwf = usd * rates.usdToRwf;
  return { usd: Math.round(usd * 100) / 100, rwf: Math.round(rwf) };
};

const convertAEDtoUSD = (aedAmount, rates) => {
  return Math.round(Number(aedAmount) * rates.aedToUsd * 100) / 100;
};

module.exports = { getExchangeRates, convertAEDtoRWF, convertAEDtoUSD, DEFAULT_AED_TO_USD, DEFAULT_USD_TO_RWF };
