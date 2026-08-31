import { useEffect, useState } from 'react'
import { Card, Row, Col, Table, Button, Badge, Form, InputGroup } from 'react-bootstrap'
import api from '../../api/client'
import Chart from '../../components/common/Charts'
import Loading from '../../components/common/Loading'
import StatCard from '../../components/common/StatCard'
import StatusBadge from '../../components/common/StatusBadge'
import { formatMoney } from '../../context/LanguageContext'

const PAGE_SIZE = 8
const CHART_H = 280

const STATUS_OPTIONS = [
  ['all', 'All Status'], ['ACTIVE', 'Active'], ['PARTIALLY_PAID', 'Partially Paid'],
  ['PAID', 'Paid'], ['OVERDUE', 'Overdue'], ['CANCELLED', 'Cancelled']
]

export default function LoansReport() {
  const [report, setReport] = useState(null)
  const [loans, setLoans] = useState([])
  const [totalLoans, setTotalLoans] = useState(0)
  const [loanPage, setLoanPage] = useState(1)
  const [loanPages, setLoanPages] = useState(1)
  const [loanStats, setLoanStats] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const loadReport = () => {
    api.get('/reports/loans').then((r) => setReport(r.data.data))
  }

  const loadLoans = () => {
    const params = { page: loanPage, limit: PAGE_SIZE }
    if (search) params.search = search
    if (statusFilter !== 'all') params.status = statusFilter
    if (from) params.from = from
    if (to) params.to = to
    api.get('/loans', { params }).then((r) => {
      setLoans(r.data.data.loans)
      setTotalLoans(r.data.data.total)
      setLoanPages(Math.ceil(r.data.data.total / PAGE_SIZE) || 1)
      setLoanStats(r.data.data.stats)
    })
  }

  useEffect(loadReport, [])
  useEffect(loadLoans, [loanPage, search, statusFilter, from, to])
  useEffect(() => { setLoanPage(1) }, [search, statusFilter, from, to])

  if (!report) return <Loading full />
  const t = report.totals || { total: 0, paid: 0, outstanding: 0, count: 0 }
  const overdue = report.overdue || { sum: 0, count: 0 }
  const repayments = report.repayments || { sum: 0, count: 0 }
  const byStatus = report.byStatus || []
  const stats = loanStats || {}

  const paidPct = t.total > 0 ? ((t.paid / t.total) * 100).toFixed(1) : 0

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}><i className="bi bi-credit-card-2-front me-2" />Loan Report</h4>
        <div className="d-flex gap-2 flex-wrap align-items-center">
          <Button size="sm" variant="primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />PDF</Button>
        </div>
      </div>

      <Row className="g-3 mb-3">
        <Col xs={6} lg={3}><StatCard icon="bi-arrow-up-right-circle" label="Total Loans" value={formatMoney(t.total)} color="primary" /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-check-circle" label="Total Repaid" value={formatMoney(t.paid)} color="success" /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-cash-coin" label="Outstanding" value={formatMoney(t.outstanding)} color="danger" /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-alarm" label="Overdue Loans" value={overdue.count} color="warning" sub={formatMoney(overdue.sum)} /></Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col md={3}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3 px-3">
              <div className="d-flex align-items-center gap-2 mb-1">
                <i className="bi bi-percent" style={{ color: '#1e7e46', fontSize: '0.95rem' }} />
                <span className="text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>Repayment Rate</span>
              </div>
              <div className="fw-bold" style={{ color: '#0d3b66', fontSize: '1.15rem' }}>{paidPct}%</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3 px-3">
              <div className="d-flex align-items-center gap-2 mb-1">
                <i className="bi bi-people" style={{ color: '#1a6fb5', fontSize: '0.95rem' }} />
                <span className="text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>Active Loans</span>
              </div>
              <div className="fw-bold" style={{ color: '#0d3b66', fontSize: '1.15rem' }}>{stats.active || 0}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3 px-3">
              <div className="d-flex align-items-center gap-2 mb-1">
                <i className="bi bi-hourglass-split" style={{ color: '#f9a825', fontSize: '0.95rem' }} />
                <span className="text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>Partial</span>
              </div>
              <div className="fw-bold" style={{ color: '#0d3b66', fontSize: '1.15rem' }}>{stats.partial || 0}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3 px-3">
              <div className="d-flex align-items-center gap-2 mb-1">
                <i className="bi bi-check-circle-fill" style={{ color: '#1e7e46', fontSize: '0.95rem' }} />
                <span className="text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>Fully Paid</span>
              </div>
              <div className="fw-bold" style={{ color: '#0d3b66', fontSize: '1.15rem' }}>{stats.paid || 0}</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col lg={4}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="fw-semibold mb-0" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>Loan Status</h6>
              </div>
              <div style={{ height: CHART_H }}>
                <Chart type="doughnut" {...{
                  data: {
                    labels: byStatus.map((s) => s._id.replace(/_/g, ' ')),
                    datasets: [{ data: byStatus.map((s) => s.count), backgroundColor: ['#1a6fb5', '#f9a825', '#1e7e46', '#c0392b', '#6c757d'], borderWidth: 2, borderColor: '#fff', hoverOffset: 6 }]
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
        <Col lg={8}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="fw-semibold mb-0" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>Repayments</h6>
                <small className="text-muted">{repayments.count} repayment(s) recorded</small>
              </div>
              <div className="d-flex align-items-center justify-content-center" style={{ height: CHART_H }}>
                <div className="text-center">
                  <div className="text-muted small text-uppercase" style={{ letterSpacing: '.04em' }}>Total Repaid</div>
                  <div className="fw-bold" style={{ color: '#1e7e46', fontSize: '2.4rem' }}>{formatMoney(repayments.sum)}</div>
                  <div className="text-muted small mt-2"><i className="bi bi-check-circle me-1" />All recorded loan repayments</div>
                </div>
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
                <h6 className="fw-semibold mb-0" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>Status Breakdown</h6>
                <Badge bg="info" className="rounded-pill" style={{ fontSize: '0.65rem' }}>{byStatus.length} statuses</Badge>
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                <Table size="sm" hover className="mb-0">
                  <thead><tr><th>Status</th><th className="text-end">Count</th><th className="text-end">Outstanding</th></tr></thead>
                  <tbody>
                    {byStatus.map((s) => (
                      <tr key={s._id}>
                        <td><StatusBadge value={s._id} /></td>
                        <td className="text-end">{s.count}</td>
                        <td className="text-end fw-semibold">{formatMoney(s.sum)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="fw-semibold mb-0" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>
                  <Badge bg="danger" className="rounded-pill me-1" style={{ fontSize: '0.6rem' }}>OVERDUE</Badge> Overdue Summary
                </h6>
              </div>
              <div className="d-flex justify-content-center align-items-center py-4">
                <div className="text-center">
                  <div className="text-muted small text-uppercase" style={{ letterSpacing: '.04em' }}>Overdue Balance</div>
                  <div className="fw-bold" style={{ color: '#c0392b', fontSize: '2rem' }}>{formatMoney(overdue.sum)}</div>
                  <div className="text-muted small mt-2">{overdue.count} loan(s) past due</div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
        <Card.Body className="py-3">
          <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
            <h6 className="fw-semibold mb-0" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>All Loans</h6>
            <div className="d-flex gap-2 flex-wrap align-items-center">
              <Form.Select size="sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 130, fontSize: '0.8rem' }}>
                {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Form.Select>
              <Form.Control size="sm" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 130, fontSize: '0.8rem' }} />
              <Form.Control size="sm" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 130, fontSize: '0.8rem' }} />
              <InputGroup size="sm" style={{ width: 180 }}>
                <InputGroup.Text className="bg-light border-end-0"><i className="bi bi-search" style={{ fontSize: '0.75rem' }} /></InputGroup.Text>
                <Form.Control placeholder="Search loans..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-light border-start-0" style={{ fontSize: '0.8rem' }} />
              </InputGroup>
              <Button size="sm" variant="outline-secondary" onClick={() => { setSearch(''); setStatusFilter('all'); setFrom(''); setTo('') }} style={{ fontSize: '0.75rem' }}>
                <i className="bi bi-x-circle me-1" />Clear
              </Button>
            </div>
          </div>
          <div className="table-responsive">
            <Table size="sm" hover className="mb-0">
              <thead>
                <tr>
                  <th>Loan</th>
                  <th>Customer</th>
                  <th className="text-end">Total</th>
                  <th className="text-end">Paid</th>
                  <th className="text-end">Remaining</th>
                  <th className="text-center">Status</th>
                  <th>Due&nbsp;Date</th>
                </tr>
              </thead>
              <tbody>
                {loans.length === 0 && <tr><td colSpan={7} className="text-center text-muted py-3">No loans found</td></tr>}
                {loans.map((l) => (
                  <tr key={l._id}>
                    <td><code style={{ fontSize: '0.7rem', background: '#f0f4f8', padding: '1px 5px', borderRadius: 4 }}>{l.loanNumber}</code></td>
                    <td>
                      <div className="fw-medium small">{l.customerName}</div>
                      <small className="text-muted d-block">{l.customerPhone}</small>
                    </td>
                    <td className="text-end fw-semibold">{formatMoney(l.totalAmount)}</td>
                    <td className="text-end" style={{ color: '#1e7e46' }}>{formatMoney(l.amountPaid)}</td>
                    <td className="text-end fw-bold" style={{ color: l.outstanding > 0 ? '#c0392b' : '#1e7e46' }}>{formatMoney(l.outstanding)}</td>
                    <td className="text-center"><StatusBadge value={l.status} /></td>
                    <td className="small text-muted">{l.dueDate ? new Date(l.dueDate).toLocaleDateString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          {loanPages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-2 pt-2" style={{ borderTop: '1px solid #f0f0f0' }}>
              <small className="text-muted">Showing {((loanPage - 1) * PAGE_SIZE) + 1}–{Math.min(loanPage * PAGE_SIZE, totalLoans)} of {totalLoans}</small>
              <div className="d-flex gap-1">
                <Button size="sm" variant="outline-secondary" disabled={loanPage <= 1} onClick={() => setLoanPage(loanPage - 1)} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>Prev</Button>
                {Array.from({ length: Math.min(loanPages, 5) }, (_, i) => {
                  let p
                  if (loanPages <= 5) p = i + 1
                  else if (loanPage <= 3) p = i + 1
                  else if (loanPage >= loanPages - 2) p = loanPages - 4 + i
                  else p = loanPage - 2 + i
                  return <Button key={p} size="sm" variant={p === loanPage ? 'primary' : 'outline-secondary'} onClick={() => setLoanPage(p)} style={{ fontSize: '0.75rem', padding: '2px 8px', minWidth: 28 }}>{p}</Button>
                })}
                <Button size="sm" variant="outline-secondary" disabled={loanPage >= loanPages} onClick={() => setLoanPage(loanPage + 1)} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>Next</Button>
              </div>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  )
}
