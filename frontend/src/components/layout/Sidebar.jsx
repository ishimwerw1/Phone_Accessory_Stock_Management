// Sidebar.jsx
import { Nav } from 'react-bootstrap'
import { NavLink, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'

export default function Sidebar({ open, onClose }) {
  const { hasPermission, user } = useAuth()
  const { t } = useLanguage()

  const Item = ({ to, icon, labelKey, end }) => (
    <NavLink to={to} end={end} className={({ isActive }) => `bcml-nav-link${isActive ? ' active' : ''}`} onClick={onClose}>
      <i className={`bi ${icon}`} />
      <span className="text-truncate">{t(labelKey)}</span>
    </NavLink>
  )

  const GroupLabel = ({ children }) => <div className="bcml-nav-group-label text-truncate px-3 py-1">{children}</div>

  return (
    <div className={`bcml-sidebar ${open ? 'show' : ''} shadow-sm h-100 d-flex flex-column overflow-hidden`}>
      <Link to="/dashboard" className="bcml-brand text-decoration-none d-flex align-items-center gap-2 p-3 flex-shrink-0" onClick={onClose}>
        <img src="/logo.png" alt="logo" style={{ maxWidth: 36, height: 'auto' }} />
        <div className="bcml-brand-text text-white overflow-hidden">
          <div className="title text-truncate fw-bold lh-sm" style={{ fontSize: '0.9rem' }}>Phone Accessories</div>
          <div className="subtitle text-truncate text-white-50" style={{ fontSize: '0.75rem' }}>Stock Management Ltd</div>
        </div>
      </Link>

      <Nav className="flex-column pb-4 overflow-y-auto flex-grow-1 px-2">
        <Item to="/dashboard" icon="bi-speedometer2" labelKey="dashboard" end />

        {(hasPermission('products.read') || hasPermission('stock.read')) && (
          <>
            <GroupLabel>{t('inventory')}</GroupLabel>
            {hasPermission('products.read') && <Item to="/products" icon="bi-box-seam" labelKey="products" />}
            {hasPermission('categories.read') && <Item to="/categories" icon="bi-diagram-3" labelKey="categories" />}
            {hasPermission('stock.create') && <Item to="/stock/in" icon="bi-box-arrow-in-down" labelKey="stockIn" />}
            {hasPermission('stock.read') && <Item to="/stock/movements" icon="bi-arrow-left-right" labelKey="stockMovement" />}
            {hasPermission('stock.adjust') && <Item to="/stock/adjustments" icon="bi-sliders" labelKey="stockAdjustments" />}
            {hasPermission('products.read') && <Item to="/stock/low" icon="bi-exclamation-triangle" labelKey="lowStock" />}
          </>
        )}

        {(hasPermission('sales.create') || hasPermission('sales.read')) && (
          <>
            <GroupLabel>{t('sales')}</GroupLabel>
            {hasPermission('sales.create') && <Item to="/sales/new" icon="bi-cart-plus" labelKey="newSale" />}
            {hasPermission('sales.read') && <Item to="/sales" icon="bi-receipt" labelKey="sales" />}
          </>
        )}

        {(hasPermission('customers.read') || hasPermission('loans.read')) && (
          <>
            <GroupLabel>{t('customers')}</GroupLabel>
            {hasPermission('customers.read') && <Item to="/customers" icon="bi-people" labelKey="customers" />}
            {hasPermission('loans.read') && <Item to="/loans" icon="bi-cash-coin" labelKey="loans" />}
          </>
        )}

        {hasPermission('suppliers.read') && (
          <>
            <GroupLabel>{t('suppliers')}</GroupLabel>
            <Item to="/suppliers" icon="bi-truck" labelKey="suppliers" />
          </>
        )}

        {(hasPermission('purchases.read') || hasPermission('purchases.create')) && (
          <>
            <GroupLabel>{t('purchases')}</GroupLabel>
            {hasPermission('purchases.read') && <Item to="/purchases" icon="bi-bag" labelKey="purchases" />}
            {hasPermission('purchases.read') && <Item to="/supplier-payments" icon="bi-credit-card" labelKey="supplierPayments" />}
          </>
        )}

        {(hasPermission('expenses.read') || hasPermission('expenses.create')) && (
          <>
            <GroupLabel>{t('expenses')}</GroupLabel>
            {hasPermission('expenses.read') && <Item to="/expenses" icon="bi-wallet2" labelKey="expenses" />}
          </>
        )}

        {hasPermission('orders.read') && (
          <>
            <GroupLabel>{t('orders')}</GroupLabel>
            <Item to="/orders" icon="bi-clipboard-check" labelKey="orders" />
          </>
        )}

        {hasPermission('payments.read') && (
          <>
            <GroupLabel>{t('payments')}</GroupLabel>
            <Item to="/payments" icon="bi-wallet2" labelKey="payments" />
          </>
        )}

        {hasPermission('reports.read') && (
          <>
            <GroupLabel>{t('reports')}</GroupLabel>
            <Item to="/reports/sales" icon="bi-graph-up-arrow" labelKey="salesReports" />
            <Item to="/reports/stock" icon="bi-boxes" labelKey="stockReports" />
            <Item to="/reports/customers" icon="bi-person-lines-fill" labelKey="customerReports" />
            <Item to="/reports/loans" icon="bi-credit-card-2-front" labelKey="loanReports" />
            <Item to="/reports/financial" icon="bi-bank" labelKey="financialReports" />
            <Item to="/reports/expenses" icon="bi-wallet2" labelKey="expenseReports" />
            <Item to="/reports/purchases" icon="bi-bag" labelKey="purchaseReports" />
          </>
        )}
      </Nav>
    </div>
  )
}