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

module.exports = { resolveTransactionDate, isAdminRole, ADMIN_ROLES };