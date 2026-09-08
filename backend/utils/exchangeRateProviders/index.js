const erApi = require('./erApi');
const manual = require('./manual');

const PROVIDERS = [erApi, manual];
const REGISTRY = Object.fromEntries(PROVIDERS.map((p) => [p.name, p]));

const getProvider = (name) => REGISTRY[name] || erApi;

const listProviders = () => PROVIDERS.map((p) => ({ name: p.name, label: p.label }));

module.exports = { getProvider, listProviders, PROVIDERS };