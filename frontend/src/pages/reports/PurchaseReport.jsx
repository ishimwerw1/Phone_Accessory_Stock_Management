import { useEffect, useState } from 'react'
import { Card, Row, Col, Button, Form, Table } from 'react-bootstrap'
import api from '../../api/client'
import Loading from '../../components/common/Loading'
import StatCard from '../../components/common/StatCard'
import { formatMoney } from '../../context/LanguageContext'

export default function PurchaseReport() {
  const [data, setData] = useState(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = () => {
    const params = {}
    if (from) params.from = from
    if (to) params.to = to
    api.get('/reports/purchases', { params }).then((r) => setData(r.data.data))
  }

  useEffect(load, [from, to])

  if (!data) return <Loading full />
  const t = data.totals || {}

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}><i className="bi bi-bag me-2" />Purchase Report</h4>
        <div className="d-flex gap-2 flex-wrap">
          <Form.Control size="sm" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 150 }} />
          <Form.Control size="sm" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 150 }} />
          <Button size="sm" variant="primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />PDF</Button>
        </div>
      </div>

      <Row className="g-3 mb-2">
        <Col md={3}><StatCard icon="bi-bag" label="Normal Purchases" value={formatMoney(data.normal?.total || 0)} color="primary" sub={`${data.normal?.count || 0} purchase(s)`} /></Col>
        <Col md={3}><StatCard icon="bi-cart-check" label="On-demand Sourcing" value={formatMoney(data.onDemand?.total || 0)} color="warning" sub={`${data.onDemand?.count || 0} purchase(s)`} /></Col>
        <Col md={3}><StatCard icon="bi-cash-stack" label="Total Paid" value={formatMoney(t.paid || 0)} color="success" /></Col>
        <Col md={3}><StatCard icon="bi-cash-coin" label="Outstanding" value={formatMoney(t.remaining || 0)} color="danger" /></Col>
      </Row>

      <Row className="g-3 mb-4">
        <Col md={3}><StatCard icon="bi-bag-fill" label="Total Purchases (All)" value={formatMoney(t.total || 0)} color="info" sub={`${t.count || 0} purchase(s)`} /></Col>
        <Col md={3}><StatCard icon="bi-credit-card" label="Payments Made" value={formatMoney(data.payments?.total || 0)} color="success" sub={`${data.payments?.count || 0} payment(s)`} /></Col>
      </Row>

      <Row className="g-3">
        <Col lg={8}>
          <Card body className="h-100">
            <Card.Title className="fs-6 fw-semibold mb-3"><i className="bi bi-truck me-2 text-primary" />Purchases by Supplier</Card.Title>
            <div className="table-responsive">
              <Table size="sm" hover className="mb-0 align-middle">
                <thead><tr><th>Supplier</th><th>Purchases</th><th>Total</th><th>Paid</th><th>Remaining</th></tr></thead>
                <tbody>
                  {data.bySupplier?.map((s) => (
                    <tr key={s._id}>
                      <td className="fw-semibold small">{s.name || 'Unknown'}</td>
                      <td>{s.count}</td>
                      <td>{formatMoney(s.total)}</td>
                      <td className="text-success">{formatMoney(s.paid)}</td>
                      <td className={s.remaining > 0 ? 'text-danger fw-semibold' : 'text-success'}>{formatMoney(s.remaining)}</td>
                    </tr>
                  ))}
                  {(!data.bySupplier || data.bySupplier.length === 0) && (
                    <tr><td colSpan={5} className="text-center text-muted py-3">No data</td></tr>
                  )}
                </tbody>
              </Table>
            </div>
          </Card>
        </Col>

        <Col lg={4}>
          <Card body className="bg-light h-100">
            <h6 className="fw-semibold"><i className="bi bi-exclamation-triangle me-2 text-danger" />Overdue Purchases</h6>
            {data.overdue?.count > 0 ? (
              <>
                <div className="fs-4 fw-bold text-danger mb-2">{formatMoney(data.overdue.total)}</div>
                <div className="small text-muted">{data.overdue.count} purchase(s) past due date</div>
              </>
            ) : (
              <div className="text-success small"><i className="bi bi-check-circle me-1" />No overdue purchases</div>
            )}

            <hr />
            <h6 className="fw-semibold"><i className="bi bi-info-circle me-2 text-primary" />Notes</h6>
            <ul className="small text-muted ps-3 mb-0">
              <li className="mb-1">Purchases automatically update stock quantities.</li>
              <li className="mb-1">Outstanding amounts track supplier debts.</li>
              <li className="mb-1">On-demand sourcing purchases do NOT affect your stock.</li>
              <li>Use date filters to narrow the period.</li>
            </ul>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
