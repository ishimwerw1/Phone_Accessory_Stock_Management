const { success, error, asyncHandler } = require('../utils/response');
const { getExchangeRates, refreshExchangeRates } = require('../utils/exchangeRate');
const { listProviders } = require('../utils/exchangeRateProviders');

exports.getRates = asyncHandler(async (req, res) => {
  const rates = await getExchangeRates();
  success(res, 'Exchange rates', {
    ...rates,
    availableProviders: listProviders(),
    refreshHours: rates.refreshHours,
  });
});

exports.refresh = asyncHandler(async (req, res) => {
  let rates;
  try {
    rates = await refreshExchangeRates();
  } catch (e) {
    return error(res, e.message, e.status || 503);
  }
  success(res, 'Exchange rates refreshed', {
    ...rates,
    availableProviders: listProviders(),
    refreshHours: rates.refreshHours,
  });
});