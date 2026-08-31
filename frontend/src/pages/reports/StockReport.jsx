import { useEffect, useState } from 'react'
import { Card, Row, Col, Table, Button, Badge } from 'react-bootstrap'
import api from '../../api/client'
import Loading from '../../components/common/Loading'
import StatCard from '../../components/common/StatCard'
import StatusBadge from '../../components/common/StatusBadge'
import { formatMoney } from '../../context/LanguageContext'
import { downloadCsv } from '../../utils/export'

export default function StockReport() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get('/reports/stock').then((r) => setData(r.data.data))
  }, [])

  if (!data) return <Loading full />
  const products = data.products || []
  const low = data.low || []
  const out = data.out || []

  const stateOf = (p) => (p.quantity <= 0 ? 'OUT_OF_STOCK' : p.quantity <= (p.minStock || 0) ? 'LOW_STOCK' : 'IN_STOCK')

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}><i className="bi bi-boxes me-2" />Stock Report</h4>
        <div className="d-flex gap-2">
          <Button size="sm" variant="outline-primary" onClick={() => downloadCsv('stock-report', products, [
            { key: 'name', label: 'Product' }, { key: 'sku', label: 'SKU' },
            { key: (r) => r.category?.name || '', label: 'Category' },
            { key: 'quantity', label: 'Quantity' },
            { key: 'minStock', label: 'Min Level' },
            { key: 'buyingPrice', label: 'Buying Price' }, { key: 'sellingPrice', label: 'Selling Price' }
          ])}><i className="bi bi-download me-1" />CSV</Button>
          <Button size="sm" variant="primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />PDF</Button>
        </div>
      </div>

      <Row className="g-3 mb-4">
        <Col md={12}>
          <StatCard icon="bi-exclamation-triangle" label="Alerts" value={`${low.length} low · ${out.length} out`} color="warning" />
        </Col>
      </Row>

      <Row className="g-3 mb-4">
        <Col lg={6}>
          <Card body>
            <Card.Title className="fs-6 fw-semibold"><Badge bg="" className="badge-soft-warning">LOW STOCK</Badge> ({low.length})</Card.Title>
            <Table size="sm" hover className="mb-0">
              <thead><tr><th>Product</th><th>Qty</th><th>Min</th></tr></thead>
              <tbody>
                {low.slice(0, 8).map((p) => (
                  <tr key={p._id}><td>{p.name}</td><td className="fw-bold text-warning">{p.quantity}</td><td>{p.minStock}</td></tr>
                ))}
                {low.length === 0 && <tr><td colSpan={3} className="text-center text-muted py-3">None</td></tr>}
              </tbody>
            </Table>
          </Card>
        </Col>
        <Col lg={6}>
          <Card body>
            <Card.Title className="fs-6 fw-semibold"><Badge bg="" className="badge-soft-danger">OUT OF STOCK</Badge> ({out.length})</Card.Title>
            <Table size="sm" hover className="mb-0">
              <thead><tr><th>Product</th><th>Min Level</th><th>Status</th></tr></thead>
              <tbody>
                {out.slice(0, 8).map((p) => (
                  <tr key={p._id}><td>{p.name}</td><td>{p.minStock}</td><td><StatusBadge value="OUT_OF_STOCK" /></td></tr>
                ))}
                {out.length === 0 && <tr><td colSpan={3} className="text-center text-muted py-3">None</td></tr>}
              </tbody>
            </Table>
          </Card>
        </Col>
      </Row>

      <Card body>
        <Card.Title className="fs-6 fw-semibold">Current Stock — All Products</Card.Title>
        <div className="table-responsive" style={{ maxHeight: 420, overflowY: 'auto' }}>
          <Table size="sm" striped hover className="mb-0">
            <thead>
              <tr><th>Product</th><th>SKU</th><th>Category</th><th>Qty</th><th>Buy</th><th>Sell</th><th>Value (Cost)</th><th>Status</th></tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p._id}>
                  <td className="small fw-semibold">{p.name}</td>
                  <td><code style={{ fontSize: '0.7rem' }}>{p.sku}</code></td>
                  <td className="small">{p.category?.name || '-'}</td>
                  <td className={`fw-bold ${p.quantity === 0 ? 'text-danger' : p.quantity <= (p.minStock || 0) ? 'text-warning' : ''}`}>{p.quantity}</td>
                  <td>{Number(p.buyingPrice).toLocaleString()}</td>
                  <td>{Number(p.sellingPrice).toLocaleString()}</td>
                  <td>{formatMoney(p.quantity * (p.buyingPrice || 0))}</td>
                  <td><StatusBadge value={stateOf(p)} /></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
