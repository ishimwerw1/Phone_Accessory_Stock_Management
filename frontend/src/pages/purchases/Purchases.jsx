import { useCallback, useEffect, useState } from 'react'
import { Card, Button, Modal, Form, Row, Col, Alert, Badge } from 'react-bootstrap'
import api, { getError } from '../../api/client'
import DataTable from '../../components/common/DataTable'
import StatusBadge from '../../components/common/StatusBadge'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { useAuth } from '../../context/AuthContext'
import { formatMoney } from '../../context/LanguageContext'

export default function Purchases() {
  const [purchases, setPurchases] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [paymentFilter, setPaymentFilter] = useState('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [detailData, setDetailData] = useState(null)
  const [form, setForm] = useState({ supplier: '', items: [{ product: '', quantity: '', costPrice: '' }], paymentMethod: 'CASH', amountPaid: '', dueDate: '', notes: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const { hasPermission } = useAuth()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 20 }
      if (statusFilter !== 'ALL') params.status = statusFilter
      if (paymentFilter !== 'ALL') params.paymentStatus = paymentFilter
      if (from) params.from = from
      if (to) params.to = to
      const { data } = await api.get('/purchases', { params })
      setPurchases(data.data.purchases)
      setTotal(data.data.total)
      setPages(data.data.pages)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, paymentFilter, from, to])

  useEffect(() => { load() }, [load])

  const loadFormDeps = async () => {
    try {
      const [sRes, pRes] = await Promise.all([
        api.get('/suppliers'),
        api.get('/products', { params: { limit: 200 } })
      ])
      const supData = sRes.data.data
      setSuppliers(Array.isArray(supData) ? supData : [])
      const prodData = pRes.data.data
      setProducts(Array.isArray(prodData) ? (prodData.products || prodData) : [])
    } catch {}
  }

  const openForm = () => {
    setError('')
    setForm({ supplier: '', items: [{ product: '', quantity: '', costPrice: '' }], paymentMethod: 'CASH', amountPaid: '', dueDate: '', notes: '' })
    loadFormDeps()
    setShowForm(true)
  }

  const addItem = () => {
    setForm({ ...form, items: [...form.items, { product: '', quantity: '', costPrice: '' }] })
  }

  const removeItem = (idx) => {
    if (form.items.length <= 1) return
    setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })
  }

  const updateItem = (idx, field, value) => {
    const items = [...form.items]
    items[idx] = { ...items[idx], [field]: value }
    setForm({ ...form, items })
  }

  const totalAmount = form.items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0
    const price = Number(item.costPrice) || 0
    return sum + qty * price
  }, 0)

  const submit = async (ev) => {
    ev.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        supplier: form.supplier,
        items: form.items.map((i) => ({ product: i.product, quantity: Number(i.quantity), costPrice: Number(i.costPrice) })),
        paymentMethod: form.paymentMethod,
        amountPaid: form.amountPaid ? Number(form.amountPaid) : 0,
        dueDate: form.dueDate || undefined,
        notes: form.notes || undefined,
      }
      await api.post('/purchases', payload)
      setShowForm(false)
      load()
    } catch (err) {
      setError(getError(err))
    } finally {
      setSaving(false)
    }
  }

  const openDetail = async (p) => {
    try {
      const { data } = await api.get(`/purchases/${p._id}`)
      setDetailData(data.data)
      setShowDetail(true)
    } catch {}
  }

  const doDelete = async () => {
    if (!confirmDel) return
    setDeleting(true)
    try {
      await api.delete(`/purchases/${confirmDel._id}`)
      setConfirmDel(null)
      load()
    } catch (err) {
      setError(getError(err))
      setConfirmDel(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}>
          <i className="bi bi-bag me-2" />Purchases <span className="text-muted fs-6">({total})</span>
        </h4>
        {hasPermission('purchases.create') && (
          <Button onClick={openForm}><i className="bi bi-plus-lg me-1" />New Purchase</Button>
        )}
      </div>

      <Card body>
        {error && <Alert variant="danger" dismissible onClose={() => setError('')} className="py-2 small mb-3">{error}</Alert>}

        <div className="d-flex flex-wrap gap-2 mb-3">
          <Form.Select size="sm" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} style={{ maxWidth: 150 }}>
            <option value="ALL">All Statuses</option>
            <option value="RECEIVED">Received</option>
            <option value="PENDING">Pending</option>
            <option value="CANCELLED">Cancelled</option>
          </Form.Select>
          <Form.Select size="sm" value={paymentFilter} onChange={(e) => { setPaymentFilter(e.target.value); setPage(1) }} style={{ maxWidth: 150 }}>
            <option value="ALL">All Payments</option>
            <option value="PAID">Paid</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="UNPAID">Unpaid</option>
          </Form.Select>
          <Form.Control size="sm" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} style={{ maxWidth: 155 }} />
          <Form.Control size="sm" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} style={{ maxWidth: 155 }} />
        </div>

        <DataTable
          columns={[
            { key: 'purchaseNumber', label: 'Purchase #', render: (p) => (
              <button className="btn btn-link text-decoration-none p-0 fw-semibold" style={{ color: '#0d3b66', fontSize: '0.85rem' }} onClick={() => openDetail(p)}>
                {p.purchaseNumber}
              </button>
            )},
            { key: 'createdAt', label: 'Date', render: (p) => new Date(p.createdAt).toLocaleDateString() },
            { key: 'supplier', label: 'Supplier', render: (p) => (
              <span className="small">{p.supplier?.name || '-'}<br /><small className="text-muted">{p.supplier?.phone}</small></span>
            )},
            { key: 'items', label: 'Items', render: (p) => `${p.items?.length || 0} product(s)` },
            { key: 'totalAmount', label: 'Total', render: (p) => <strong>{formatMoney(p.totalAmount)}</strong> },
            { key: 'paymentStatus', label: 'Payment', render: (p) => <StatusBadge value={p.paymentStatus} /> },
            { key: 'status', label: 'Status', render: (p) => <StatusBadge value={p.status} /> },
            { key: 'actions', label: 'Actions', render: (p) => (
              <div className="d-flex gap-1">
                <Button size="sm" variant="light" className="border" onClick={() => openDetail(p)}><i className="bi bi-eye" /></Button>
                {p.status !== 'CANCELLED' && hasPermission('purchases.delete') && (
                  <Button size="sm" variant="outline-danger" onClick={() => setConfirmDel(p)}><i className="bi bi-trash" /></Button>
                )}
              </div>
            )}
          ]}
          data={purchases}
          loading={loading}
          page={page}
          pages={pages}
          total={total}
          onPageChange={setPage}
        />
      </Card>

      {/* Create Purchase Modal */}
      <Modal show={showForm} onHide={() => !saving && setShowForm(false)} size="lg" centered backdrop="static">
        <Form onSubmit={submit}>
          <Modal.Header closeButton={!saving}>
            <Modal.Title className="fs-6 fw-bold">New Purchase Order</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Supplier *</Form.Label>
                  <Form.Select value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} required>
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.phone})</option>)}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Payment Method</Form.Label>
                  <Form.Select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                    <option value="CASH">Cash</option>
                    <option value="MOMO">MoMo</option>
                    <option value="BANK">Bank</option>
                    <option value="CREDIT">Credit</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Amount Paid (RWF)</Form.Label>
                  <Form.Control type="number" min="0" value={form.amountPaid} onChange={(e) => setForm({ ...form, amountPaid: e.target.value })} placeholder="0" />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Due Date</Form.Label>
                  <Form.Control type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Notes</Form.Label>
                  <Form.Control value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
                </Form.Group>
              </Col>
            </Row>

            <hr />
            <div className="d-flex justify-content-between align-items-center mb-2">
              <strong className="small">Items</strong>
              <Button size="sm" variant="outline-primary" onClick={addItem}><i className="bi bi-plus me-1" />Add Item</Button>
            </div>

            {form.items.map((item, idx) => (
              <Row key={idx} className="g-2 mb-2 align-items-end">
                <Col md={5}>
                  <Form.Select size="sm" value={item.product} onChange={(e) => updateItem(idx, 'product', e.target.value)} required>
                    <option value="">Select Product</option>
                    {products.map((p) => <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>)}
                  </Form.Select>
                </Col>
                <Col md={2}>
                  <Form.Control size="sm" type="number" min="1" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} required />
                </Col>
                <Col md={3}>
                  <Form.Control size="sm" type="number" min="0" placeholder="Cost Price" value={item.costPrice} onChange={(e) => updateItem(idx, 'costPrice', e.target.value)} required />
                </Col>
                <Col md={1}>
                  <small className="text-muted">{item.quantity && item.costPrice ? formatMoney(Number(item.quantity) * Number(item.costPrice)) : ''}</small>
                </Col>
                <Col md={1}>
                  {form.items.length > 1 && (
                    <Button size="sm" variant="outline-danger" onClick={() => removeItem(idx)}><i className="bi bi-x" /></Button>
                  )}
                </Col>
              </Row>
            ))}

            <div className="text-end mt-2">
              <strong>Total: {formatMoney(totalAmount)}</strong>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setShowForm(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create Purchase'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Detail Modal */}
      <Modal show={showDetail} onHide={() => setShowDetail(null)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-6 fw-bold">
            <i className="bi bi-bag me-2" />{detailData?.purchase?.purchaseNumber}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {detailData && (() => {
            const p = detailData.purchase
            return (
              <>
                <Row className="g-3 mb-3 small">
                  <Col sm={6}>
                    <div className="text-muted">Supplier</div>
                    <strong>{p.supplier?.name}</strong><br />
                    <small>{p.supplier?.phone}</small>
                  </Col>
                  <Col sm={3}>
                    <div className="text-muted">Payment</div>
                    <StatusBadge value={p.paymentStatus} />
                  </Col>
                  <Col sm={3}>
                    <div className="text-muted">Status</div>
                    <StatusBadge value={p.status} />
                  </Col>
                  <Col sm={4}>
                    <div className="text-muted">Total Amount</div>
                    <strong className="fs-6">{formatMoney(p.totalAmount)}</strong>
                  </Col>
                  <Col sm={4}>
                    <div className="text-muted">Paid</div>
                    <strong className="text-success">{formatMoney(p.amountPaid)}</strong>
                  </Col>
                  <Col sm={4}>
                    <div className="text-muted">Remaining</div>
                    <strong className="text-danger">{formatMoney(p.remainingAmount)}</strong>
                  </Col>
                </Row>

                <strong className="small d-block mb-2">Items Purchased</strong>
                <div className="table-responsive mb-3">
                  <table className="table table-sm table-hover align-middle mb-0">
                    <thead><tr><th>Product</th><th>SKU</th><th>Qty</th><th>Cost</th><th>Subtotal</th></tr></thead>
                    <tbody>
                      {p.items?.map((item, i) => (
                        <tr key={i}>
                          <td className="small">{item.productName || item.product?.name}</td>
                          <td><code className="small">{item.sku || item.product?.sku}</code></td>
                          <td>{item.quantity}</td>
                          <td>{formatMoney(item.costPrice)}</td>
                          <td className="fw-semibold">{formatMoney(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {detailData.payments?.length > 0 && (
                  <>
                    <strong className="small d-block mb-2">Supplier Payments</strong>
                    <div className="table-responsive">
                      <table className="table table-sm table-hover align-middle mb-0">
                        <thead><tr><th>#</th><th>Date</th><th>Amount</th><th>Method</th><th>By</th></tr></thead>
                        <tbody>
                          {detailData.payments.map((pay) => (
                            <tr key={pay._id}>
                              <td><code className="small">{pay.paymentNumber}</code></td>
                              <td className="small">{new Date(pay.date).toLocaleDateString()}</td>
                              <td className="fw-semibold text-success">{formatMoney(pay.amount)}</td>
                              <td><StatusBadge value={pay.paymentMethod} /></td>
                              <td className="small">{pay.receivedBy?.name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {p.notes && <div className="mt-3 small text-muted"><strong>Notes:</strong> {p.notes}</div>}
              </>
            )
          })()}
        </Modal.Body>
      </Modal>

      <ConfirmDialog
        show={Boolean(confirmDel)}
        onClose={() => setConfirmDel(null)}
        title="Cancel Purchase"
        message={`Cancel purchase "${confirmDel?.purchaseNumber}"? Stock will be reversed.`}
        confirmLabel="Cancel Purchase"
        variant="danger"
        loading={deleting}
        onConfirm={doDelete}
      />
    </div>
  )
}
