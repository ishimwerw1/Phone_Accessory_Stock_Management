import { useEffect, useState } from 'react'
import { Card, Row, Col, Table, Button, Badge } from 'react-bootstrap'
import api from '../../api/client'
import Loading from '../../components/common/Loading'
import StatCard from '../../components/common/StatCard'
import { formatMoney } from '../../context/LanguageContext'
import { downloadCsv } from '../../utils/export'

export default function CustomersReport() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get('/reports/customers').then((r) => setData(r.data.data))
  }, [])

  if (!data) return <Loading full />
  const top = data.top || []
  const debtors = data.debtors || []
  const totalDebt = debtors.reduce((s, c) => s + c.debt, 0)

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}><i className="bi bi-person-lines-fill me-2" />Customer Report</h4>
        <div className="d-flex gap-2">
          <Button size="sm" variant="outline-primary" onClick={() => downloadCsv('top-customers', top, [
            { key: 'name', label: 'Customer' }, { key: 'phone', label: 'Phone' },
            { key: 'total', label: 'Total Purchases' }, { key: 'paid', label: 'Total Paid' },
            { key: 'debt', label: 'Outstanding' }
          ])}><i className="bi bi-download me-1" />CSV</Button>
          <Button size="sm" variant="primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />PDF</Button>
        </div>
      </div>

      <Row className="g-3 mb-4">
        <Col md={4}><StatCard icon="bi-people" label="Top Customers" value={top.length} color="primary" sub="By total spend" /></Col>
        <Col md={4}><StatCard icon="bi-cash-coin" label="Customers With Debt" value={debtors.length} color="warning" /></Col>
        <Col md={4}><StatCard icon="bi-bank" label="Total Debt" value={formatMoney(totalDebt)} color="danger" /></Col>
      </Row>

      <Row className="g-3">
        <Col lg={6}>
          <Card body>
            <Card.Title className="fs-6 fw-semibold"><Badge bg="" className="badge-soft-success">TOP 20</Badge> Best Customers</Card.Title>
            <Table size="sm" hover responsive className="mb-0">
              <thead><tr><th>#</th><th>Customer</th><th>Phone</th><th>Purchases</th><th>Paid</th></tr></thead>
              <tbody>
                {top.map((c, i) => (
                  <tr key={c._id}>
                    <td>{i + 1}</td>
                    <td className="small fw-semibold">{c.name}</td>
                    <td><code style={{ fontSize: '0.72rem' }}>{c.phone}</code></td>
                    <td>{formatMoney(c.total)}</td>
                    <td className="text-success">{formatMoney(c.paid)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </Col>
        <Col lg={6}>
          <Card body>
            <Card.Title className="fs-6 fw-semibold"><Badge bg="" className="badge-soft-danger">DEBTORS</Badge> Customers With Outstanding Balance</Card.Title>
            <Table size="sm" hover responsive className="mb-0">
              <thead><tr><th>Customer</th><th>Phone</th><th>Outstanding</th></tr></thead>
              <tbody>
                {debtors.length === 0 && <tr><td colSpan={3} className="text-center text-muted py-3">No customer debts</td></tr>}
                {debtors.map((c) => (
                  <tr key={c._id}>
                    <td className="small fw-semibold">{c.name}</td>
                    <td><code style={{ fontSize: '0.72rem' }}>{c.phone}</code></td>
                    <td className="text-danger fw-bold">{formatMoney(c.debt)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
