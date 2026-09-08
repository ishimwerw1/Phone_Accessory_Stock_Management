const https = require('https');

const API_URL = 'https://open.er-api.com/v6/latest/USD';
const TIMEOUT_MS = 8000;

const httpGetJson = (url, timeoutMs = TIMEOUT_MS) =>
  new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Accept: 'application/json' } }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`Provider responded with status ${res.statusCode}`));
          }
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error('Invalid response from exchange-rate provider'));
        }
      });
    });
    req.on('error', (e) => reject(new Error(`Could not reach exchange-rate provider: ${e.message}`)));
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Exchange-rate provider timed out')));
  });

const parseRates = (json) => {
  if (!json || json.result !== 'success' || !json.rates) {
    throw new Error('Exchange-rate provider returned an unsuccessful response');
  }
  const usdToAed = Number(json.rates.AED);
  const usdToRwf = Number(json.rates.RWF);
  if (!usdToAed || !usdToRwf) {
    throw new Error('Exchange-rate provider response is missing AED/RWF rates');
  }
  const aedToUsd = 1 / usdToAed;
  return {
    aedToUsd,
    usdToRwf: usdToRwf,
    aedToRwf: usdToRwf / usdToAed,
    source: 'open.er-api.com',
    providerTime: json.time_last_update_utc || null,
  };
};

module.exports = {
  name: 'erApi',
  label: 'open.er-api.com (automatic)',
  fetchRates: async () => {
    const json = await httpGetJson(API_URL);
    return parseRates(json);
  },
};