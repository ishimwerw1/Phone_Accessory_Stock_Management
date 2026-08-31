import { useEffect, useState } from 'react'
import { Card, Row, Col, Button, Form } from 'react-bootstrap'
import api from '../../api/client'
import Loading from '../../components/common/Loading'
import StatCard from '../../components/common/StatCard'
import { formatMoney } from '../../context/LanguageContext'

export default function FinancialReport() {
  const [data, setData] = useState(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = () => {
    const params = {}
    if (from) params.from = from
    if (to) params.to = to
    api.get('/reports/financial', { params }).then((r) => setData(r.data.data))
  }

  useEffect(load, [from, to])

  if (!data) return <Loading full />
  const t = data.totals || {}

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}><i className="bi bi-bank me-2" />Financial Report</h4>
        <div className="d-flex gap-2 flex-wrap">
          <Form.Control size="sm" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 150 }} />
          <Form.Control size="sm" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 150 }} />
          <Button size="sm" variant="primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />PDF</Button>
        </div>
      </div>

      <Row className="g-3 mb-4">
        <Col md={3}><StatCard icon="bi-graph-up" label="Total Sales" value={formatMoney(t.sales || 0)} color="primary" sub={`${t.count || 0} sales`} /></Col>
        <Col md={3}><StatCard icon="bi-cash-stack" label="Amount Received" value={formatMoney(t.paid || 0)} color="success" /></Col>
        <Col md={3}><StatCard icon="bi-tags" label="Total Discounts" value={formatMoney(t.discounts || 0)} color="warning" /></Col>
        <Col md={3}><StatCard icon="bi-bar-chart-line" label="Gross Profit (est.)" value={formatMoney(t.profit || 0)} color="info" sub={`COGS: ${formatMoney(t.cost || 0)}`} /></Col>
      </Row>

      <Row className="g-3 mb-4">
        <Col md={4}><StatCard icon="bi-cash-coin" label="Outstanding / Credit" value={formatMoney(t.outstanding || 0)} color="danger" sub="Unpaid balance on completed sales" /></Col>
        <Col md={4}><StatCard icon="bi-box-arrow-down" label="Stock Received (qty)" value={(data.stockInQty || 0).toLocaleString()} color="primary" sub="Total units stocked in" /></Col>
        <Col md={4}><StatCard icon="bi-check-circle" label="Avg. Sale Value" value={formatMoney((t.count || 0) > 0 ? t.sales / t.count : 0)} color="success" /></Col>
      </Row>

      <Row className="g-3">
        <Col lg={8}>
          <Card body className="h-100">
            <Card.Title className="fs-6 fw-semibold">Income Statement Summary</Card.Title>
            <Row className="g-3">
              <Col md={6}>
                <Card className="border-0 bg-light">
                  <Card.Body>
                    <div className="d-flex justify-content-between border-bottom py-2">
                      <span className="text-muted small">Total Sales (Revenue)</span>
                      <strong>{formatMoney(t.sales || 0)}</strong>
                    </div>
                    <div className="d-flex justify-content-between border-bottom py-2">
                      <span className="text-muted small">Cost of Goods Sold</span>
                      <strong>−{formatMoney(t.cost || 0)}</strong>
                    </div>
                    <div className="d-flex justify-content-between border-bottom py-2">
                      <span className="text-muted small">Discounts Given</span>
                      <strong>−{formatMoney(t.discounts || 0)}</strong>
                    </div>
                    <div className="d-flex justify-content-between py-2">
                      <span className="fw-semibold small">Gross Profit</span>
                      <strong className={t.profit > 0 ? 'text-success' : 'text-danger'}>{formatMoney(t.profit || 0)}</strong>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6}>
                <Card className="border-0">
                  <Card.Body>
                    <div className="d-flex justify-content-between border-bottom py-2">
                      <span className="text-muted small">Sales Count</span>
                      <strong>{t.count || 0}</strong>
                    </div>
                    <div className="d-flex justify-content-between border-bottom py-2">
                      <span className="text-muted small">Amount Received</span>
                      <strong className="text-success">{formatMoney(t.paid || 0)}</strong>
                    </div>
                    <div className="d-flex justify-content-between py-2">
                      <span className="text-muted small">Credit Outstanding</span>
                      <strong className="text-danger">{formatMoney(t.outstanding || 0)}</strong>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>
        <Col lg={4}>
          <Card body className="bg-light h-100">
            <h6 className="fw-semibold"><i className="bi bi-info-circle me-2 text-primary" />Notes</h6>
            <ul className="small text-muted ps-3 mb-0">
              <li className="mb-2">Gross profit is estimated using each sold item's recorded cost at time of sale.</li>
              <li className="mb-2">Credits are unpaid balances on completed sales.</li>
              <li>Use date filters to narrow the period. Print to PDF for record keeping.</li>
            </ul>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
