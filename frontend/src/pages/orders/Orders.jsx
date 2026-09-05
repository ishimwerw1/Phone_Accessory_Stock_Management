import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Form, Button, Modal, Alert, Row, Col } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'
import api, { getError } from '../../api/client'
import DataTable from '../../components/common/DataTable'
import StatusBadge from '../../components/common/StatusBadge'
import { formatMoney } from '../../context/LanguageContext'

export default function Orders() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState('ALL')
  const [fulfilling, setFulfilling] = useState(null)
  const [lines, setLines] = useState([])
  const [payMethod, setPayMethod] = useState('CASH')
  const [amountPaid, setAmountPaid] = useState('')
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [products, setProducts] = useState([])
  const [newOrder, setNewOrder] = useState({ customerName: '', customerPhone: '', notes: '', expectedDeliveryDate: '', items: [{ product: '', name: '', quantity: '1', price: '' }], discount: '0' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 20 }
      if (status !== 'ALL') params.status = status
      const { data } = await api.get('/orders', { params })
      setOrders(data.data.orders)
      setPages(data.data.pages)
      setTotal(data.data.total)
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => { load() }, [load])

  const openFulfill = (order) => {
    setLines(order.items.map((it) => ({
      product: it.product?._id || it.product || '',
      name: it.name,
      sku: it.sku,
      quantity: it.quantity,
      price: it.price,
    })))
    setPayMethod('CASH')
    setAmountPaid('')
    setReference('')
    setError('')
    setFulfilling(order)
  }

  const openCreate = () => {
    setError('')
    setNewOrder({ customerName: '', customerPhone: '', notes: '', expectedDeliveryDate: '', items: [{ product: '', name: '', quantity: '1', price: '' }], discount: '0' })
    api.get('/products', { params: { limit: 200, status: 'ACTIVE' } }).then((r) => setProducts(r.data.data.products)).catch(() => {})
    setShowCreate(true)
  }

  const newSubtotal = useMemo(() => newOrder.items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.price) || (i.product ? products.find((p) => p._id === i.product)?.sellingPrice || 0 : 0)), 0), [newOrder.items, products])
  const newTotal = Math.max(0, newSubtotal - Number(newOrder.discount || 0))

  const selectOrderProduct = (idx, pid) => {
    const p = products.find((x) => x._id === pid)
    const items = [...newOrder.items]
    items[idx] = p
      ? { product: p._id, name: p.name, quantity: items[idx].quantity, price: p.sellingPrice }
      : { ...items[idx], product: '', name: items[idx].name }
    setNewOrder({ ...newOrder, items })
  }

  const addNewOrderItem = () => setNewOrder({ ...newOrder, items: [...newOrder.items, { product: '', name: '', quantity: '1', price: '' }] })
  const removeNewOrderItem = (idx) => { if (newOrder.items.length <= 1) return; setNewOrder({ ...newOrder, items: newOrder.items.filter((_, i) => i !== idx) }) }

  const submitOrder = async () => {
    if (!newOrder.customerName.trim()) return setError('Customer name is required')
    const clean = newOrder.items.filter((i) => i.product || i.name.trim())
    if (!clean.length) return setError('Add at least one item')
    setSaving(true); setError('')
    try {
      await api.post('/orders', {
        customerName: newOrder.customerName.trim(),
        customerPhone: newOrder.customerPhone.trim() || undefined,
        notes: newOrder.notes.trim() || undefined,
        expectedDeliveryDate: newOrder.expectedDeliveryDate || undefined,
        discount: Number(newOrder.discount || 0),
        items: clean.map((i) => i.product
          ? { product: i.product, quantity: Number(i.quantity), price: Number(i.price) }
          : { name: i.name, quantity: Number(i.quantity), price: Number(i.price) }),
      })
      setShowCreate(false)
      setPage(1)
      load()
    } catch (err) {
      setError(getError(err))
    } finally {
      setSaving(false)
    }
  }

  const fulfill = async () => {
    if (!fulfilling) return
    setSaving(true)
    setError('')
    try {
      const payload = {
        paymentMethod: payMethod,
        amountPaid: amountPaid === '' ? undefined : Number(amountPaid),
        paymentReference: reference || undefined,
        items: lines.map((l) => ({ product: l.product || undefined, price: Number(l.price), quantity: Number(l.quantity) })),
      }
      const { data } = await api.post(`/orders/${fulfilling._id}/fulfill`, payload)
      setFulfilling(null)
      setAmountPaid(''); setReference('')
      window.dispatchEvent(new Event('stock-updated'))
      if (data?.data?.sale) navigate(`/sales/${data.data.sale}`)
      else load()
    } catch (err) {
      setError(getError(err))
    } finally {
      setSaving(false)
    }
  }

  const markProcessing = async (order) => {
    try {
      await api.put(`/orders/${order._id}/status`, { status: 'PROCESSING' })
      load()
    } catch (err) { alert(getError(err)) }
  }

  const cancelOrder = async (order) => {
    if (!window.confirm(`Cancel order ${order.orderNumber}?`)) return
    try {
      await api.put(`/orders/${order._id}/cancel`)
      load()
    } catch (err) {
      alert(getError(err))
    }
  }

  const fulfillTotal = useMemo(() => {
    if (!fulfilling) return 0
    return lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.price) || 0), 0) - Number(fulfilling.discount || 0)
  }, [lines, fulfilling])

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}>
            <i className="bi bi-clipboard-check me-2" />Orders <span className="text-muted fs-6">({total})</span>
          </h4>
        </div>
        <div className="d-flex gap-2">
          <Form.Select size="sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} style={{ maxWidth: 160 }}>
            {['ALL', 'PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED'].map((s) => <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s}</option>)}
          </Form.Select>
          <Button size="sm" onClick={openCreate}><i className="bi bi-plus-lg me-1" />New Order</Button>
        </div>
      </div>

      <Card body>
        <DataTable
          columns={[
            { key: 'orderNumber', label: 'Order #', render: (o) => <strong>{o.orderNumber}</strong> },
            { key: 'createdAt', label: 'Date', render: (o) => new Date(o.createdAt).toLocaleString() },
            { key: 'customer', label: 'Customer', render: (o) => (
              <span className="small">{o.customer?.name}<br /><small className="text-muted">{o.customer?.phone}</small></span>
            )},
            { key: 'items', label: 'Items', render: (o) => `${o.items.length} product(s)` },
            { key: 'total', label: 'Total', render: (o) => formatMoney(o.total) },
            { key: 'expectedDeliveryDate', label: 'Delivery', render: (o) => o.expectedDeliveryDate ? new Date(o.expectedDeliveryDate).toLocaleDateString() : '-' },
            { key: 'status', label: 'Status', render: (o) => <StatusBadge value={o.status} /> },
            { key: 'createdBy', label: 'By', render: (o) => o.createdBy?.fullName },
            { key: 'actions', label: 'Actions', render: (o) => (
              <div className="d-flex gap-1">
                {(o.status === 'PENDING' || o.status === 'PROCESSING') && (
                  <Button size="sm" variant="light" className="border" onClick={() => markProcessing(o)} title="Mark processing" disabled={o.status === 'PROCESSING'}>
                    <i className="bi bi-gear" />
                  </Button>
                )}
                {(o.status === 'PENDING' || o.status === 'PROCESSING' || o.status === 'CONFIRMED') && (
                  <Button size="sm" variant="primary" onClick={() => openFulfill(o)}><i className="bi bi-bag-check me-1" />Convert to Sale</Button>
                )}
                {o.status !== 'CANCELLED' && (
                  <Button size="sm" variant="light" className="border text-danger" onClick={() => cancelOrder(o)}><i className="bi bi-x-lg" /></Button>
                )}
              </div>
            )}
          ]}
          data={orders}
          loading={loading}
          page={page}
          pages={pages}
          total={total}
          onPageChange={setPage}
        />
      </Card>

      {/* Create order modal */}
      <Modal show={showCreate} onHide={() => !saving && setShowCreate(false)} size="lg" centered backdrop="static">
        <Modal.Header closeButton={!saving}><Modal.Title className="fs-6 fw-bold"><i className="bi bi-clipboard-plus me-2" />New Order</Modal.Title></Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
          <Row className="g-2 mb-3">
            <Col sm={4}><Form.Control size="sm" placeholder="Customer name *" value={newOrder.customerName} onChange={(e) => setNewOrder({ ...newOrder, customerName: e.target.value })} /></Col>
            <Col sm={4}><Form.Control size="sm" placeholder="Customer phone" value={newOrder.customerPhone} onChange={(e) => setNewOrder({ ...newOrder, customerPhone: e.target.value })} /></Col>
            <Col sm={4}><Form.Control size="sm" type="date" value={newOrder.expectedDeliveryDate} onChange={(e) => setNewOrder({ ...newOrder, expectedDeliveryDate: e.target.value })} /></Col>
          </Row>

          <div className="d-flex justify-content-between align-items-center mb-2">
            <strong className="small">Items</strong>
            <Button size="sm" variant="outline-primary" onClick={addNewOrderItem}><i className="bi bi-plus me-1" />Add Item</Button>
          </div>
          {newOrder.items.map((it, idx) => (
            <div key={idx} className="d-flex gap-2 mb-2 align-items-center">
              <Form.Select size="sm" style={{ maxWidth: 260 }} value={it.product} onChange={(e) => selectOrderProduct(idx, e.target.value)}>
                <option value="">Select product (optional)</option>
                {products.map((p) => <option key={p._id} value={p._id}>{p.name} — {formatMoney(p.sellingPrice)}</option>)}
              </Form.Select>
              {!it.product && (
                <Form.Control size="sm" placeholder="Product name" value={it.name} onChange={(e) => { const items = [...newOrder.items]; items[idx] = { ...items[idx], name: e.target.value }; setNewOrder({ ...newOrder, items }) }} />
              )}
              <Form.Control size="sm" type="number" min="1" style={{ width: 70 }} value={it.quantity} onChange={(e) => { const items = [...newOrder.items]; items[idx] = { ...items[idx], quantity: e.target.value }; setNewOrder({ ...newOrder, items }) }} />
              <Form.Control size="sm" type="number" min="0" style={{ width: 110 }} placeholder="Unit price" value={it.price} onChange={(e) => { const items = [...newOrder.items]; items[idx] = { ...items[idx], price: e.target.value }; setNewOrder({ ...newOrder, items }) }} />
              <span className="small text-muted" style={{ minWidth: 80, textAlign: 'right' }}>
                {formatMoney((Number(it.quantity) || 0) * (Number(it.price) || (it.product ? products.find((p) => p._id === it.product)?.sellingPrice || 0 : 0)))}
              </span>
              {newOrder.items.length > 1 && <Button size="sm" variant="outline-danger" onClick={() => removeNewOrderItem(idx)}><i className="bi bi-x" /></Button>}
            </div>
          ))}

          <div className="d-flex justify-content-end align-items-center gap-2 mt-2">
            <span className="text-muted small">Discount (RWF)</span>
            <Form.Control size="sm" type="number" min="0" style={{ width: 110 }} value={newOrder.discount} onChange={(e) => setNewOrder({ ...newOrder, discount: e.target.value })} />
            <strong>Total: {formatMoney(newTotal)}</strong>
          </div>
          <Form.Control size="sm" className="mt-2" placeholder="Notes (optional)" value={newOrder.notes} onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })} />
          <p className="small text-muted mt-2 mb-0"><i className="bi bi-info-circle me-1" />You can create an order without selecting an existing product (just type a product name & unit price). This lets you order items not yet in your catalog.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowCreate(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submitOrder} disabled={saving}>{saving ? 'Saving...' : 'Create Order'}</Button>
        </Modal.Footer>
      </Modal>

      {/* Fulfill / convert to sale modal */}
      <Modal show={Boolean(fulfilling)} onHide={() => !saving && setFulfilling(null)} size="lg" centered backdrop="static">
        <Modal.Header closeButton={!saving}>
          <Modal.Title className="fs-6 fw-bold">Convert Order {fulfilling?.orderNumber} to Sale</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
          <p className="small text-muted">
            Creates a real sale for <strong>{fulfilling?.customer?.name}</strong>. Edit quantities/prices below before confirming — stock is reduced for the quantities entered.
          </p>
          <div className="table-responsive mb-3">
            <table className="table table-sm align-middle mb-0">
              <thead><tr><th>Product</th><th style={{ width: 90 }}>Qty</th><th style={{ width: 120 }}>Unit Price</th><th className="text-end" style={{ width: 110 }}>Subtotal</th></tr></thead>
              <tbody>
                {lines.map((l, idx) => (
                  <tr key={idx}>
                    <td className="small">{l.name}<br /><small className="text-muted">{l.sku}</small></td>
                    <td><Form.Control size="sm" type="number" min="1" value={l.quantity} onChange={(e) => { const n = [...lines]; n[idx] = { ...n[idx], quantity: e.target.value }; setLines(n) }} /></td>
                    <td><Form.Control size="sm" type="number" min="0" value={l.price} onChange={(e) => { const n = [...lines]; n[idx] = { ...n[idx], price: e.target.value }; setLines(n) }} /></td>
                    <td className="text-end fw-semibold">{formatMoney((Number(l.quantity) || 0) * (Number(l.price) || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="d-flex justify-content-end mb-2">
            <strong>Total: {formatMoney(fulfillTotal)}</strong>
          </div>
          <Row className="g-2 mb-2">
            <Col sm={4}>
              <Form.Group>
                <Form.Label className="small fw-semibold">Payment Method *</Form.Label>
                <Form.Select size="sm" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  <option value="CASH">Cash</option>
                  <option value="MOMO">MoMo</option>
                  <option value="BANK">Bank</option>
                  <option value="LOAN">Loan / Credit</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col sm={4}>
              <Form.Group>
                <Form.Label className="small fw-semibold">{payMethod === 'LOAN' ? 'Down Payment (RWF)' : 'Amount Paid (RWF)'}</Form.Label>
                <Form.Control size="sm" type="number" min="0" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder={payMethod === 'LOAN' ? '0' : String(fulfillTotal)} />
              </Form.Group>
            </Col>
            {(payMethod === 'MOMO' || payMethod === 'BANK') && (
              <Col sm={4}>
                <Form.Group>
                  <Form.Label className="small fw-semibold">Reference</Form.Label>
                  <Form.Control size="sm" value={reference} onChange={(e) => setReference(e.target.value)} />
                </Form.Group>
              </Col>
            )}
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setFulfilling(null)} disabled={saving}>Cancel</Button>
          <Button onClick={fulfill} disabled={saving || !lines.length}>
            {saving ? 'Processing...' : <><i className="bi bi-bag-check me-1" />Create Sale</>}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
