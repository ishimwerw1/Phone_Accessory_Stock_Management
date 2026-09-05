import { useEffect, useMemo, useState } from 'react'
import { Card, Row, Col, Form, Button, Table, Badge, InputGroup } from 'react-bootstrap'
import api from '../../api/client'
import Chart from '../../components/common/Charts'
import Loading from '../../components/common/Loading'
import StatCard from '../../components/common/StatCard'
import { formatMoney } from '../../context/LanguageContext'
import { downloadCsv } from '../../utils/export'

const PERIODS = [
  ['today', 'Today'], ['week', 'This Week'], ['month', 'This Month'], ['year', 'This Year'], ['custom', 'Custom']
]
const PAGE_SIZE = 8

const SOURCE_LABELS = { RETAIL: 'Direct Sales', ORDER: 'From Orders', ON_DEMAND: 'On-demand Sourcing' }
const SOURCE_ICONS = { RETAIL: 'bi-bag-check', ORDER: 'bi-clipboard-check', ON_DEMAND: 'bi-truck' }
const SOURCE_BADGES = { RETAIL: 'primary', ORDER: 'success', ON_DEMAND: 'warning' }
const SOURCE_HINTS = {
  RETAIL: 'Sales recorded directly at the till from existing stock.',
  ORDER: 'Sales created by converting customer orders — unpaid portions are booked as customer debt.',
  ON_DEMAND: 'Sales sourced from a supplier after the customer orders — until the payment is collected the balance is a debt owed to you.',
}

const CHART_H = 280
const chartFont = { family: "'Segoe UI', system-ui, sans-serif" }
const axisOpts = { grid: { color: 'rgba(0,0,0,.06)' }, ticks: { font: { size: 10, ...chartFont }, color: '#6b7a90' } }

export default function SalesReport() {
  const [period, setPeriod] = useState('month')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const load = () => {
    const params = {}
    if (period === 'custom') {
      if (from) params.from = from
      if (to) params.to = to
    } else params.period = period
    api.get('/reports/sales', { params }).then((r) => setData(r.data.data))
  }

  useEffect(load, [period, from, to])
  useEffect(() => { setPage(1) }, [search, period])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.toLowerCase()
    return (data.byDate || []).filter((d) =>
      String(d._id).toLowerCase().includes(q) ||
      String(d.count).includes(q) ||
      String(d.total).includes(q) ||
      String(d.paid).includes(q)
    )
  }, [data, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  if (!data) return <Loading full />
  const s = data.totals || { total: 0, paid: 0, cost: 0, count: 0, profit: 0, outstanding: 0 }
  const avgSale = s.count > 0 ? s.total / s.count : 0
  const byDate = data.byDate || []
  const byMethod = data.byMethod || []
  const byProduct = data.byProduct || []
  const byCashier = data.byCashier || []
  const byCustomer = data.byCustomer || []
  const sources = data.sources || []

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}><i className="bi bi-graph-up-arrow me-2" />Sales Report</h4>
        <div className="d-flex gap-2 flex-wrap align-items-center">
          <Form.Select size="sm" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: 140 }}>
            {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Form.Select>
          {period === 'custom' && (
            <>
              <Form.Control size="sm" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 140 }} />
              <Form.Control size="sm" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 140 }} />
            </>
          )}
          <Button size="sm" variant="outline-primary" onClick={() => downloadCsv('sales-report', byDate, [
            { key: '_id', label: 'Date' }, { key: 'count', label: 'Sales Count' },
            { key: 'total', label: 'Revenue' }, { key: 'paid', label: 'Received' }
          ])}><i className="bi bi-download me-1" />CSV</Button>
          <Button size="sm" variant="primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />PDF</Button>
        </div>
      </div>

      <Row className="g-3 mb-3">
        <Col xs={6} lg={3}><StatCard icon="bi-receipt" label="Total Sales" value={s.count} color="primary" /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-cash-stack" label="Revenue" value={formatMoney(s.total)} color="success" /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-wallet2" label="Amount Received" value={formatMoney(s.paid)} color="info" /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-cash-coin" label="Outstanding" value={formatMoney(s.outstanding)} color="danger" sub={`Discounts: ${formatMoney(data.discount || 0)}`} /></Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col md={3}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3 px-3">
              <div className="d-flex align-items-center gap-2 mb-1">
                <i className="bi bi-receipt-cutoff" style={{ color: '#1a6fb5', fontSize: '0.95rem' }} />
                <span className="text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>Avg. Sale Value</span>
              </div>
              <div className="fw-bold" style={{ color: '#0d3b66', fontSize: '1.15rem' }}>{formatMoney(avgSale)}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3 px-3">
              <div className="d-flex align-items-center gap-2 mb-1">
                <i className="bi bi-cart-check" style={{ color: '#1e7e46', fontSize: '0.95rem' }} />
                <span className="text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>Distinct Products Sold</span>
              </div>
              <div className="fw-bold" style={{ color: '#0d3b66', fontSize: '1.15rem' }}>{byProduct.length}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3 px-3">
              <div className="d-flex align-items-center gap-2 mb-1">
                <i className="bi bi-people" style={{ color: '#6f42c1', fontSize: '0.95rem' }} />
                <span className="text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>Cashiers Active</span>
              </div>
              <div className="fw-bold" style={{ color: '#0d3b66', fontSize: '1.15rem' }}>{byCashier.length}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3 px-3">
              <div className="d-flex align-items-center gap-2 mb-1">
                <i className="bi bi-people-fill" style={{ color: '#fd7e14', fontSize: '0.95rem' }} />
                <span className="text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>Top Customers</span>
              </div>
              <div className="fw-bold" style={{ color: '#0d3b66', fontSize: '1.15rem' }}>{byCustomer.length}</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col lg={8}>
          <Card style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="fw-semibold mb-0" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>Revenue Trend</h6>
                <small className="text-muted">Sales vs received</small>
              </div>
              <div style={{ height: CHART_H }}>
                <Chart type="line" {...{
                  data: {
                    labels: byDate.map((d) => d._id),
                    datasets: [
                      { label: 'Sales', data: byDate.map((d) => d.total), borderColor: '#0d3b66', backgroundColor: 'rgba(13,59,102,.08)', fill: true, tension: .4, borderWidth: 2, pointRadius: 2, pointHoverRadius: 5 },
                      { label: 'Received', data: byDate.map((d) => d.paid), borderColor: '#1e7e46', backgroundColor: 'rgba(30,126,70,.08)', fill: true, tension: .4, borderWidth: 2, pointRadius: 2, pointHoverRadius: 5 }
                    ]
                  },
                  options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 11 } } } },
                    scales: { y: { beginAtZero: true, ...axisOpts }, x: { ...axisOpts, ticks: { ...axisOpts.ticks, maxRotation: 0, maxTicksLimit: 10 } } }
                  }
                }} />
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="fw-semibold mb-0" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>Payment Methods</h6>
              </div>
              <div style={{ height: CHART_H }}>
                <Chart type="doughnut" {...{
                  data: {
                    labels: byMethod.map((m) => m._id),
                    datasets: [{ data: byMethod.map((m) => m.total), backgroundColor: ['#1e7e46', '#1a6fb5', '#0d3b66', '#f9a825', '#6c757d'], borderWidth: 2, borderColor: '#fff', hoverOffset: 6 }]
                  },
                  options: {
                    responsive: true, maintainAspectRatio: false, cutout: '60%',
                    plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12, font: { size: 11 } } } }
                  }
                }} />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col lg={6}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="fw-semibold mb-0" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>Top Selling Products</h6>
                <Badge bg="primary" className="rounded-pill" style={{ fontSize: '0.65rem' }}>{byProduct.length} items</Badge>
              </div>
              <div style={{ height: CHART_H }}>
                <Chart type="bar" {...{
                  data: {
                    labels: byProduct.slice(0, 12).map((p) => (p.name || '').length > 16 ? p.name.slice(0, 15) + '...' : p.name),
                    datasets: [{ label: 'Qty Sold', data: byProduct.map((p) => p.qty), backgroundColor: '#1a6fb5', borderRadius: 6, barThickness: 18 }]
                  },
                  options: {
                    responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                    plugins: { legend: { display: false }, tooltip: { callbacks: { title: (items) => byProduct[items[0].dataIndex]?.name } } },
                    scales: { x: { beginAtZero: true, ...axisOpts }, y: { ...axisOpts, ticks: { ...axisOpts.ticks, font: { size: 10 } } } }
                  }
                }} />
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3">
              <h6 className="fw-semibold mb-2" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>Top Customers</h6>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                <Table size="sm" hover className="mb-0">
                  <thead><tr><th>Customer</th><th className="text-end">Sales</th><th className="text-end">Total</th></tr></thead>
                  <tbody>
                    {byCustomer.length === 0 && <tr><td colSpan={3} className="text-center text-muted py-3">No data</td></tr>}
                    {byCustomer.map((c) => (
                      <tr key={c._id}>
                        <td><i className="bi bi-person-circle me-1 text-muted" style={{ fontSize: '0.8rem' }} />{c.name || 'Walk-in'}</td>
                        <td className="text-end">{c.count}</td>
                        <td className="text-end fw-semibold">{formatMoney(c.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col lg={6}>
          <Card style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3">
              <h6 className="fw-semibold mb-2" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>Sales by Cashier</h6>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                <Table size="sm" hover className="mb-0">
                  <thead><tr><th>Cashier</th><th className="text-end">Sales</th><th className="text-end">Revenue</th></tr></thead>
                  <tbody>
                    {byCashier.length === 0 && <tr><td colSpan={3} className="text-center text-muted py-3">No data</td></tr>}
                    {byCashier.map((c) => (
                      <tr key={c._id}>
                        <td><i className="bi bi-person-circle me-1 text-muted" style={{ fontSize: '0.8rem' }} />{c.name}</td>
                        <td className="text-end">{c.count}</td>
                        <td className="text-end fw-semibold">{formatMoney(c.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3">
              <h6 className="fw-semibold mb-2" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>Products by Revenue</h6>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                <Table size="sm" hover className="mb-0">
                  <thead><tr><th>Product</th><th className="text-end">Qty</th><th className="text-end">Revenue</th></tr></thead>
                  <tbody>
                    {byProduct.length === 0 && <tr><td colSpan={3} className="text-center text-muted py-3">No data</td></tr>}
                    {byProduct.map((p) => (
                      <tr key={p._id}>
                        <td className="text-truncate" style={{ maxWidth: 160 }}><i className="bi bi-box-seam me-1 text-muted" style={{ fontSize: '0.8rem' }} />{p.name}</td>
                        <td className="text-end">{p.qty}</td>
                        <td className="text-end fw-semibold">{formatMoney(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
        <Card.Body className="py-3">
          <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
            <h6 className="fw-semibold mb-0" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>Sales Breakdown by Period</h6>
            <InputGroup size="sm" style={{ maxWidth: 220 }}>
              <InputGroup.Text className="bg-light border-end-0"><i className="bi bi-search" style={{ fontSize: '0.75rem' }} /></InputGroup.Text>
              <Form.Control placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-light border-start-0" style={{ fontSize: '0.8rem' }} />
            </InputGroup>
          </div>
          <div className="table-responsive">
            <Table size="sm" hover className="mb-0">
              <thead>
                <tr>
                  <th>Period</th>
                  <th className="text-end">Sales Count</th>
                  <th className="text-end">Revenue</th>
                  <th className="text-end">Received</th>
                  <th className="text-end">Collection %</th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-3">No matching records</td></tr>}
                {paged.map((d) => {
                  const pct = d.total > 0 ? ((d.paid / d.total) * 100).toFixed(0) : 0
                  return (
                    <tr key={d._id}>
                      <td><i className="bi bi-calendar3 me-1 text-muted" style={{ fontSize: '0.75rem' }} />{d._id}</td>
                      <td className="text-end">{d.count}</td>
                      <td className="text-end fw-semibold">{formatMoney(d.total)}</td>
                      <td className="text-end" style={{ color: '#1e7e46' }}>{formatMoney(d.paid)}</td>
                      <td className="text-end">
                        <Badge bg={pct >= 80 ? 'success' : pct >= 50 ? 'warning' : 'danger'} className="rounded-pill" style={{ fontSize: '0.65rem', fontWeight: 500 }}>
                          {pct}%
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-2 pt-2" style={{ borderTop: '1px solid #f0f0f0' }}>
              <small className="text-muted">Showing {((safePage - 1) * PAGE_SIZE) + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}</small>
              <div className="d-flex gap-1">
                <Button size="sm" variant="outline-secondary" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>Prev</Button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let p
                  if (totalPages <= 5) p = i + 1
                  else if (safePage <= 3) p = i + 1
                  else if (safePage >= totalPages - 2) p = totalPages - 4 + i
                  else p = safePage - 2 + i
                  return <Button key={p} size="sm" variant={p === safePage ? 'primary' : 'outline-secondary'} onClick={() => setPage(p)} style={{ fontSize: '0.75rem', padding: '2px 8px', minWidth: 28 }}>{p}</Button>
                })}
                <Button size="sm" variant="outline-secondary" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>Next</Button>
              </div>
            </div>
          )}
        </Card.Body>
      </Card>

      <Card style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }} className="mb-3">
        <Card.Body className="py-3">
          <h6 className="fw-semibold mb-3" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>Revenue by Source</h6>
          <div className="table-responsive">
            <Table size="sm" hover className="mb-2">
              <thead>
                <tr>
                  <th>Source</th>
                  <th className="text-end">Sales Count</th>
                  <th className="text-end">Revenue</th>
                  <th className="text-end">Received</th>
                  <th className="text-end">Outstanding (Debt)</th>
                </tr>
              </thead>
              <tbody>
                {sources.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-3">No sales in this period</td></tr>}
                {sources.map((x) => (
                  <tr key={x.source}>
                    <td>
                      <i className={`bi ${SOURCE_ICONS[x.source] || 'bi-bag'} me-2 text-muted`} style={{ fontSize: '0.8rem' }} />
                      <Badge bg={SOURCE_BADGES[x.source] || 'secondary'} className="me-1 rounded-pill" style={{ fontSize: '0.65rem', fontWeight: 500 }}>
                        {SOURCE_LABELS[x.source] || x.source}
                      </Badge>
                    </td>
                    <td className="text-end">{x.count}</td>
                    <td className="text-end fw-semibold">{formatMoney(x.total)}</td>
                    <td className="text-end" style={{ color: '#1e7e46' }}>{formatMoney(x.paid)}</td>
                    <td className="text-end text-danger">{formatMoney(x.outstanding)}</td>
                  </tr>
                ))}
                {sources.length > 0 && (
                  <tr className="table-light fw-semibold">
                    <td>Total</td>
                    <td className="text-end">{sources.reduce((a, x) => a + x.count, 0)}</td>
                    <td className="text-end">{formatMoney(sources.reduce((a, x) => a + x.total, 0))}</td>
                    <td className="text-end">{formatMoney(sources.reduce((a, x) => a + x.paid, 0))}</td>
                    <td className="text-end">{formatMoney(sources.reduce((a, x) => a + x.outstanding, 0))}</td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
          <div className="small text-muted">
            {sources.map((x) => SOURCE_HINTS[x.source]).filter(Boolean).map((hint, i) => (
              <div key={i} className="mb-1"><i className="bi bi-info-circle me-1" />{hint}</div>
            ))}
          </div>
        </Card.Body>
      </Card>
    </div>
  )
}
