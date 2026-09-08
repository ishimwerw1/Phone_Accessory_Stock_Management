const manual = {
  name: 'manual',
  label: 'Manual (admin-entered rates)',
  fetchRates: async ({ store }) => {
    const aedToUsd = Number(store.aedToUsd) || 0;
    const aedToRwf = Number(store.aedToRwf) || (Number(store.usdToRwf) && aedToUsd ? Number(store.usdToRwf) * aedToUsd : 0);
    const usdToRwf = Number(store.usdToRwf) || (aedToUsd ? aedToRwf / aedToUsd : 0);
    if (!aedToUsd || !aedToRwf) {
      throw new Error('Manual exchange rates are not configured. Enter AED→USD and AED→RWF in Settings.');
    }
    return {
      aedToUsd,
      aedToRwf,
      usdToRwf,
      source: 'manual',
      providerTime: null,
    };
  },
};

module.exports = manual;