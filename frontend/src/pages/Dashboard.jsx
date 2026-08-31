import { useEffect, useState } from 'react'
import { Row, Col, Card, Table, Badge, Button } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, ArcElement, Tooltip, Legend, Filler
} from 'chart.js'
import { Line, Doughnut } from 'react-chartjs-2'
import api from '../api/client'
import StatCard from '../components/common/StatCard'
import StatusBadge from '../components/common/StatusBadge'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler)

const METHOD_LABELS = { CASH: 'cash', MOMO: 'momo', BANK: 'bank', LOAN: 'loan' }

export default function Dashboard() {
  const { t } = useLanguage()
  const { user, hasPermission } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const isSuperAdmin = user?.roleName === 'Super Admin' || user?.role === 'SUPER_ADMIN' ||
    user?.role?.name === 'Super Admin'

  useEffect(() => {
    api.get('/reports/dashboard', { params: { period: 'today' } })
      .then((res) => setData(res.data.data))
      .catch((err) => setError(err?.response?.data?.message || 'Failed to load dashboard'))
  }, [])

  if (error) return <Card body className="text-danger m-2 m-md-3">{error}</Card>
  if (!data) {
    return (
      <div className="p-2 p-md-3">
        <div className="loading-shimmer mb-3 mb-md-4" style={{ height: 90, borderRadius: 14 }} />
        <Row className="g-2 g-md-3 mb-3 mb-md-4">
          {[...Array(4)].map((_, i) => (
            <Col key={i} xs={12} sm={6} xl={3}>
              <div className="loading-shimmer" style={{ height: 84, borderRadius: 12 }} />
            </Col>
          ))}
        </Row>
        <Row className="g-2 g-md-3">
          <Col xs={12} lg={6}>
            <div className="loading-shimmer" style={{ height: 300, borderRadius: 12 }} />
          </Col>
          <Col xs={12} lg={6}>
            <div className="loading-shimmer" style={{ height: 300, borderRadius: 12 }} />
          </Col>
        </Row>
      </div>
    )
  }

  const rawTrend = data.salesTrend
  const salesTrend = Array.isArray(rawTrend)
    ? rawTrend
    : (rawTrend && rawTrend._id ? [rawTrend] : [])
  const trendLabels = salesTrend.map((d) => d._id.slice(5))
  const trendData = {
    labels: trendLabels,
    datasets: [{
      label: t('revenue'),
      data: salesTrend.map((d) => d.total),
      borderColor: '#0d3b66',
      backgroundColor: 'rgba(13,59,102,0.12)',
      fill: true,
      tension: 0.35,
      pointRadius: 3
    }]
  }

  const byMethodMap = {};
  const rawByMethod = data.byMethod;
  if (Array.isArray(rawByMethod)) rawByMethod.forEach((m) => { byMethodMap[m._id] = m.total })
  else if (rawByMethod && rawByMethod._id) byMethodMap[rawByMethod._id] = rawByMethod.total
  const methodTotal = Object.values(byMethodMap).reduce((a, b) => a + (b || 0), 0)
  const methodData = {
    labels: ['Cash', 'MoMo', 'Bank', 'Loan'],
    datasets: [{
      data: [byMethodMap.CASH || 0, byMethodMap.MOMO || 0, byMethodMap.BANK || 0, byMethodMap.LOAN || 0],
      backgroundColor: ['#1e7e46', '#1a6fb5', '#0d3b66', '#f9a825'],
      borderWidth: 0
    }]
  }

  const recentTxns = data.recentTxns || []
  const low = data.lowStock || []
  const out = data.outOfStock || []
  const topProducts = Array.isArray(data.topProducts)
    ? data.topProducts
    : (data.topProducts && data.topProducts._id ? [data.topProducts] : [])

  return (
    <div className="p-2 p-sm-3 p-md-4">
      {/* Hero banner */}
      <div className="hero-banner mb-3 mb-md-4 p-3 p-md-4 rounded-3">
        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3">
          <div>
            <h4 className="fw-bold mb-1 text-white fs-5 fs-md-4">
              {greeting()}, <span className="text-warning">{user?.name?.split(' ')[0]}</span>
            </h4>
            <p className="text-white-50 small mb-0">
              <i className="bi bi-calendar3 me-1" />{new Date().toLocaleDateString(undefined, { dateStyle: 'full' })}
            </p>
          </div>
          <div className="d-flex flex-row gap-3 gap-sm-4 text-white text-center w-100 w-sm-auto justify-content-between justify-content-sm-end pt-2 pt-sm-0 border-top border-sm-0 border-white-10">
            <div>
              <div className="fs-6 fs-md-5 fw-bold">{data.todaySales}</div>
              <div className="text-white-50" style={{ fontSize: '0.68rem' }}>{t('sales').toUpperCase()}</div>
            </div>
            <div>
              <div className="fs-6 fs-md-5 fw-bold">{Number(data.todayRevenue || 0).toLocaleString()}</div>
              <div className="text-white-50" style={{ fontSize: '0.68rem' }}>RWF {t('today').toUpperCase()}</div>
            </div>
            <div>
              <div className="fs-6 fs-md-5 fw-bold">{data.lowStockCount + data.outOfStockCount}</div>
              <div className="text-white-50" style={{ fontSize: '0.68rem' }}>{t('lowStockAlerts').toUpperCase()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      {(hasPermission('sales.create') || hasPermission('products.create') || hasPermission('stock.create')) && (
        <Row className="g-2 g-md-3 mb-3 mb-md-4 stagger qa-row">
          {hasPermission('sales.create') && (
            <Col xs={6} sm={4} md={4} xl={2}>
              <Link to="/sales/new" className="qa-tile text-decoration-none w-100" style={{ '--qa-color': '#1e7e46' }}>
                <i className="bi bi-cart-plus" /><span>{t('newSale')}</span>
              </Link>
            </Col>
          )}
          {hasPermission('products.create') && (
            <Col xs={6} sm={4} md={4} xl={2}>
              <Link to="/products" className="qa-tile text-decoration-none w-100" style={{ '--qa-color': '#0d3b66' }}>
                <i className="bi bi-plus-square-dotted" /><span>{t('products')}</span>
              </Link>
            </Col>
          )}
          {hasPermission('stock.create') && (
            <Col xs={6} sm={4} md={4} xl={2}>
              <Link to="/stock/in" className="qa-tile text-decoration-none w-100" style={{ '--qa-color': '#b7791f' }}>
                <i className="bi bi-box-arrow-in-down" /><span>{t('stockIn')}</span>
              </Link>
            </Col>
          )}
          {hasPermission('customers.create') && (
            <Col xs={6} sm={4} md={4} xl={2}>
              <Link to="/customers" className="qa-tile text-decoration-none w-100" style={{ '--qa-color': '#1a6fb5' }}>
                <i className="bi bi-person-plus" /><span>{t('customers')}</span>
              </Link>
            </Col>
          )}
          {hasPermission('loans.read') && (
            <Col xs={6} sm={4} md={4} xl={2}>
              <Link to="/loans" className="qa-tile text-decoration-none w-100" style={{ '--qa-color': '#c0392b' }}>
                <i className="bi bi-cash-coin" /><span>{t('loans')}</span>
              </Link>
            </Col>
          )}
          {hasPermission('reports.read') && (
            <Col xs={6} sm={4} md={4} xl={2}>
              <Link to="/reports/financial" className="qa-tile text-decoration-none w-100" style={{ '--qa-color': '#6f42c1' }}>
                <i className="bi bi-graph-up-arrow" /><span>{t('reports')}</span>
              </Link>
            </Col>
          )}
        </Row>
      )}

      {/* Primary KPI Row */}
      <Row className="g-2 g-md-3 mb-3 mb-md-4 stagger">
        <Col xs={12} sm={6} xl={3}>
          <StatCard icon="bi-box-seam" label={t('totalProducts')} value={data.totalProducts} color="primary" sub={`${Number(data.totalStockItems || 0).toLocaleString()} units in stock`} />
        </Col>
        <Col xs={12} sm={6} xl={3}>
          <StatCard icon="bi-cash-stack" label={t('todaysRevenue')} value={`${Number(data.todayRevenue || 0).toLocaleString()} RWF`} color="success" sub={`${data.todaySales} ${t('sales').toLowerCase()} · stock value ${Number(data.stockValue || 0).toLocaleString()}`} />
        </Col>
        <Col xs={12} sm={6} xl={3}>
          <StatCard icon="bi-people" label={t('totalCustomers')} value={data.totalCustomers} color="info" sub={`${data.totalSuppliers} ${t('suppliers').toLowerCase()}`} />
        </Col>
        <Col xs={12} sm={6} xl={3}>
          <StatCard icon="bi-cash-coin" label={t('outstandingLoans')} value={`${Number(data.outstandingLoans || 0).toLocaleString()} RWF`} color="warning" link="/loans" />
        </Col>
      </Row>

      {/* Secondary KPI Row */}
      <Row className="g-2 g-md-3 mb-3 mb-md-4 stagger">
        <Col xs={12} sm={6} xl={3}>
          <StatCard icon="bi-exclamation-triangle" label={t('lowStockProducts')} value={data.lowStockCount} color="warning" link="/stock/low" />
        </Col>
        <Col xs={12} sm={6} xl={3}>
          <StatCard icon="bi-x-octagon" label={t('outOfStockProducts')} value={data.outOfStockCount} color="danger" link="/stock/low" />
        </Col>
        <Col xs={12} sm={6} xl={3}>
          <StatCard icon="bi-graph-up-arrow" label="Total Sales" value={`${Number(data.totalSalesValue || 0).toLocaleString()} RWF`} color="info" sub={`${Number(data.totalPaid || 0).toLocaleString()} RWF collected`} />
        </Col>
        <Col xs={12} sm={6} xl={3}>
          <StatCard icon="bi-tools" label="Phone Spare Parts" value={data.totalProducts} color="primary" sub="Screens · Batteries · Boards · Chargers" />
        </Col>
      </Row>

      {/* Admin Panel */}
      {isSuperAdmin && (
        <Card className="mb-3 mb-md-4 border-0 shadow-sm" style={{ background: 'linear-gradient(135deg,#0d3b66 0%,#1a5fa8 100%)' }}>
          <Card.Body className="p-3 p-md-4">
            <div className="d-flex align-items-center mb-3">
              <i className="bi bi-shield-lock text-white me-2 fs-5" />
              <span className="text-white fw-bold">Administration</span>
              <span className="text-white-50 small ms-2 d-none d-md-inline">— manage people, security and data</span>
            </div>
            <div className="d-flex flex-wrap gap-2">
              {(isSuperAdmin || hasPermission('users.read')) && (
                <Button as={Link} to="/users" variant="light" size="sm" className="flex-grow-1 flex-sm-grow-0"><i className="bi bi-person-plus me-1" />{t('users')}</Button>
              )}
              {(isSuperAdmin || hasPermission('auditLogs.read')) && (
                <Button as={Link} to="/audit-logs" variant="light" size="sm" className="flex-grow-1 flex-sm-grow-0"><i className="bi bi-journal-text me-1" />{t('auditLogs')}</Button>
              )}
              {(isSuperAdmin || hasPermission('reports.read')) && (
                <Button as={Link} to="/reports/financial" variant="light" size="sm" className="flex-grow-1 flex-sm-grow-0"><i className="bi bi-printer me-1" />{t('reports')}</Button>
              )}
              {(isSuperAdmin || hasPermission('settings.read')) && (
                <Button as={Link} to="/settings" variant="light" size="sm" className="flex-grow-1 flex-sm-grow-0"><i className="bi bi-gear me-1" />{t('settings')}</Button>
              )}
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Charts Row */}
      <Row className="g-2 g-md-3 mb-3 mb-md-4">
        <Col xs={12} lg={6}>
          <Card className="h-100 shadow-sm">
            <Card.Body className="p-3">
              <Card.Title className="fs-6 fw-semibold mb-3">{t('salesOverview')} — {t('thisWeek')}</Card.Title>
              <div style={{ height: 'clamp(220px, 30vw, 320px)', position: 'relative' }}>
                <Line data={trendData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card className="h-100 shadow-sm">
            <Card.Body className="p-3">
              <Card.Title className="fs-6 fw-semibold mb-3">{t('byPaymentMethod')}</Card.Title>
              {methodTotal === 0 ? (
                <div className="text-center text-muted py-5"><i className="bi bi-pie-chart fs-2 d-block opacity-50" />{t('noData')}</div>
              ) : (
                <div style={{ height: 'clamp(220px, 30vw, 320px)', position: 'relative' }}>
                  <Doughnut data={methodData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Tables Grid */}
      <Row className="g-2 g-md-3">
        <Col xs={12} lg={6}>
          <Card className="shadow-sm border-0 h-100">
            <Card.Header className="bg-white fw-semibold fs-6 py-3"><i className="bi bi-clock-history me-2 text-primary" />{t('recentTransactions')}</Card.Header>
            <div className="table-responsive">
              <Table size="sm" hover className="mb-0 align-middle text-nowrap">
                <thead><tr><th>{t('type')}</th><th>{t('products')}</th><th>Qty</th><th>→</th><th>{t('performedBy')}</th></tr></thead>
                <tbody>
                  {recentTxns.map((tx) => (
                    <tr key={tx._id}>
                      <td><Badge bg="" className={`badge-soft-${tx.type === 'STOCK_IN' || tx.type === 'RETURN' ? 'success' : tx.type === 'SALE' ? 'info' : 'warning'}`}>{tx.type.replace(/_/g, ' ')}</Badge></td>
                      <td className="small text-truncate" style={{ maxWidth: 140 }}>{tx.productName}</td>
                      <td>{tx.quantity}</td>
                      <td className="small text-muted">{tx.prevQuantity} → <strong>{tx.newQuantity}</strong></td>
                      <td className="small text-truncate" style={{ maxWidth: 120 }}>{tx.performedBy?.name || '—'}</td>
                    </tr>
                  ))}
                  {recentTxns.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-3">{t('noData')}</td></tr>}
                </tbody>
              </Table>
            </div>
          </Card>
        </Col>

        <Col xs={12} lg={6}>
          <Card className="shadow-sm border-0 h-100">
            <Card.Header className="bg-white fw-semibold fs-6 py-3"><i className="bi bi-box2-heart me-2 text-warning" />{t('topProducts')}</Card.Header>
            <div className="table-responsive">
              <Table size="sm" hover className="mb-0 align-middle text-nowrap">
                <thead><tr><th>{t('products')}</th><th>Units Sold</th></tr></thead>
                <tbody>
                  {(topProducts).slice(0, 8).map((p, i) => (
                    <tr key={i}>
                      <td className="small">
                        <span className="badge rounded-pill bg-secondary opacity-75 me-2">{i + 1}</span>
                        {p._id}
                      </td>
                      <td className="small fw-semibold">{p.count}</td>
                    </tr>
                  ))}
                  {topProducts.length === 0 && <tr><td colSpan={2} className="text-center text-muted py-3">{t('noData')}</td></tr>}
                </tbody>
              </Table>
            </div>
          </Card>
        </Col>

        <Col xs={12} lg={6}>
          <Card className="shadow-sm border-0 h-100">
            <Card.Header className="bg-white fw-semibold fs-6 py-3"><i className="bi bi-exclamation-triangle me-2 text-warning" />{t('lowStockAlerts')}</Card.Header>
            <div className="table-responsive">
              <Table size="sm" hover className="mb-0 align-middle text-nowrap">
                <thead><tr><th>{t('products')}</th><th>Qty</th><th>Min</th><th>{t('status')}</th></tr></thead>
                <tbody>
                  {[...low.map((p) => ({ ...p, _state: 'LOW_STOCK' })), ...out.map((p) => ({ ...p, _state: 'OUT_OF_STOCK' }))].slice(0, 10).map((p) => (
                    <tr key={p._id}>
                      <td className="small">{p.name} <small className="text-muted">({p.sku})</small></td>
                      <td className="fw-semibold">{p.quantity}</td>
                      <td>{p.minStock}</td>
                      <td><StatusBadge value={p._state} /></td>
                    </tr>
                  ))}
                  {low.length === 0 && out.length === 0 && (
                    <tr><td colSpan={4} className="text-center text-muted py-3">{t('noData')}</td></tr>
                  )}
                </tbody>
              </Table>
            </div>
          </Card>
        </Col>

        <Col xs={12} lg={6}>
          <Card className="shadow-sm border-0 h-100">
            <Card.Header className="bg-white fw-semibold fs-6 py-3"><i className="bi bi-cash-coin me-2 text-danger" />{t('outstandingLoans')}</Card.Header>
            <div className="p-4 text-center">
              <div className="display-6 fw-bold text-danger">{Number(data.outstandingLoans || 0).toLocaleString()} RWF</div>
              <div className="text-muted small mt-1">Outstanding loan balance</div>
              <Button as={Link} to="/loans" variant="outline-danger" size="sm" className="mt-3"><i className="bi bi-cash-coin me-1" />{t('loans')}</Button>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

const greeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
