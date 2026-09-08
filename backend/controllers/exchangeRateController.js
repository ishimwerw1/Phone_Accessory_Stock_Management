const { success, asyncHandler } = require('../utils/response');
const { getExchangeRates } = require('../utils/exchangeRate');

exports.getRates = asyncHandler(async (req, res) => {
  const rates = await getExchangeRates();
  success(res, 'Exchange rates', rates);
});