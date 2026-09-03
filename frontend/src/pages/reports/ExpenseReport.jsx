import { useEffect, useState } from 'react'
import { Card, Row, Col, Button, Form, Table } from 'react-bootstrap'
import api from '../../api/client'
import Loading from '../../components/common/Loading'
import StatCard from '../../components/common/StatCard'
import { formatMoney } from '../../context/LanguageContext'

export default function ExpenseReport() {
  const [data, setData] = useState(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = () => {
    const params = {}
    if (from) params.from = from
    if (to) params.to = to
    api.get('/reports/expenses', { params }).then((r) => setData(r.data.data))
  }

  useEffect(load, [from, to])

  if (!data) return <Loading full />
  const t = data.totals || {}

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}><i className="bi bi-wallet2 me-2" />Expense Report</h4>
        <div className="d-flex gap-2 flex-wrap">
          <Form.Control size="sm" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 150 }} />
          <Form.Control size="sm" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 150 }} />
          <Button size="sm" variant="primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />PDF</Button>
        </div>
      </div>

      <Row className="g-3 mb-4">
        <Col md={4}><StatCard icon="bi-wallet2" label="Total Expenses" value={formatMoney(t.total || 0)} color="danger" sub={`${t.count || 0} expense(s) recorded`} /></Col>
        <Col md={4}><StatCard icon="bi-tag" label="Categories Used" value={data.byCategory?.length || 0} color="primary" /></Col>
        <Col md={4}><StatCard icon="bi-people" label="Recorded By" value={data.byUser?.length || 0} color="info" /></Col>
      </Row>

      <Row className="g-3">
        <Col lg={6}>
          <Card body className="h-100">
            <Card.Title className="fs-6 fw-semibold mb-3"><i className="bi bi-bar-chart me-2 text-primary" />Expenses by Category</Card.Title>
            <div className="table-responsive">
              <Table size="sm" hover className="mb-0 align-middle">
                <thead><tr><th>Category</th><th>Count</th><th className="text-end">Amount</th></tr></thead>
                <tbody>
                  {data.byCategory?.map((c) => (
                    <tr key={c._id}>
                      <td><span className="badge badge-soft-primary">{c._id}</span></td>
                      <td>{c.count}</td>
                      <td className="text-end fw-semibold text-danger">{formatMoney(c.total)}</td>
                    </tr>
                  ))}
                  {(!data.byCategory || data.byCategory.length === 0) && (
                    <tr><td colSpan={3} className="text-center text-muted py-3">No data</td></tr>
                  )}
                </tbody>
              </Table>
            </div>
          </Card>
        </Col>

        <Col lg={6}>
          <Card body className="h-100">
            <Card.Title className="fs-6 fw-semibold mb-3"><i className="bi bi-people me-2 text-info" />Expenses by User</Card.Title>
            <div className="table-responsive">
              <Table size="sm" hover className="mb-0 align-middle">
                <thead><tr><th>User</th><th>Count</th><th className="text-end">Amount</th></tr></thead>
                <tbody>
                  {data.byUser?.map((u) => (
                    <tr key={u._id}>
                      <td className="small">{u.name || 'Unknown'}</td>
                      <td>{u.count}</td>
                      <td className="text-end fw-semibold text-danger">{formatMoney(u.total)}</td>
                    </tr>
                  ))}
                  {(!data.byUser || data.byUser.length === 0) && (
                    <tr><td colSpan={3} className="text-center text-muted py-3">No data</td></tr>
                  )}
                </tbody>
              </Table>
            </div>
          </Card>
        </Col>

        <Col lg={12}>
          <Card body>
            <Card.Title className="fs-6 fw-semibold mb-3"><i className="bi bi-calendar me-2 text-warning" />Expenses by Date</Card.Title>
            <div className="table-responsive">
              <Table size="sm" hover className="mb-0 align-middle">
                <thead><tr><th>Date</th><th>Count</th><th className="text-end">Amount</th></tr></thead>
                <tbody>
                  {data.byDate?.map((d) => (
                    <tr key={d._id}>
                      <td className="small">{d._id}</td>
                      <td>{d.count}</td>
                      <td className="text-end fw-semibold text-danger">{formatMoney(d.total)}</td>
                    </tr>
                  ))}
                  {(!data.byDate || data.byDate.length === 0) && (
                    <tr><td colSpan={3} className="text-center text-muted py-3">No data</td></tr>
                  )}
                </tbody>
              </Table>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
