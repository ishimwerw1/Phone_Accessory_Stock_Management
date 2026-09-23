const ADMIN_ROLES = ['SUPER_ADMIN', 'MANAGER'];

const isAdminRole = (user) => Boolean(user && ADMIN_ROLES.includes(user.role));

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });
const forbidden = (message) => Object.assign(new Error(message), { status: 403 });

const resolveTransactionDate = (value, user) => {
  if (value === undefined || value === null || value === '') return null;
  if (!isAdminRole(user)) {
    throw forbidden('Only admins (Super Admin / Manager) can set a custom transaction date');
  }
  let date;
  if (value instanceof Date) {
    date = value;
  } else {
    const raw = String(value);
    if (!/^\d{4}-\d{2}-\d{2}/.test(raw)) throw badRequest('Invalid transaction date format — use YYYY-MM-DD');
    date = new Date(raw);
  }
  if (isNaN(date.getTime())) throw badRequest('Invalid transaction date');
  if (date.getTime() > Date.now()) throw badRequest('Transaction date cannot be in the future');
  return date;
};

const todayUtc = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

// Normalizes a calendar date ("YYYY-MM-DD" or Date) to a Date at UTC midnight so
// that the selected day is never shifted by server/client timezones. Returns null
// when the value is empty/absent.
const normalizeDateOnly = (value) => {
  if (value === undefined || value === null || value === '') return null;
  let y, m, d;
  if (value instanceof Date) {
    y = value.getUTCFullYear();
    m = value.getUTCMonth() + 1;
    d = value.getUTCDate();
  } else {
    const raw = String(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw badRequest('Invalid date format — use YYYY-MM-DD');
    [y, m, d] = raw.split('-').map(Number);
    if (!(m >= 1 && m <= 12) || !(d >= 1 && d <= 31)) throw badRequest('Invalid date');
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (isNaN(date.getTime()) || date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    throw badRequest('Invalid date');
  }
  return date;
};

module.exports = { resolveTransactionDate, normalizeDateOnly, todayUtc, isAdminRole, ADMIN_ROLES };