import { useEffect, useState } from 'react'
import { Card, Row, Col, Form, Button, Alert, Badge } from 'react-bootstrap'
import api, { getError } from '../../api/client'

export default function StockIn() {
  const [products, setProducts] = useState([])
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [buyingPrice, setBuyingPrice] = useState('')
  const [reference, setReference] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/products', { params: { limit: 200, status: 'ACTIVE' } })
      .then((r) => setProducts(r.data.data.products || []))
      .catch((e) => setError(getError(e)))
  }, [])

  const selected = products.find((p) => p._id === productId)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess(null)
    if (!productId) return setError('Select a product.')
    if (!quantity || Number(quantity) <= 0) return setError('Enter a valid quantity.')
    setSaving(true)
    try {
      const { data } = await api.post('/stock/in', {
        productId,
        quantity: Number(quantity),
        buyingPrice: buyingPrice === '' ? undefined : Number(buyingPrice),
        reference: reference || undefined,
        reason: reason || undefined
      })
      const p = data.data
      setSuccess({ name: p.name, reference })
      setProductId('')
      setQuantity('')
      setBuyingPrice('')
      setReference('')
      setReason('')
    } catch (err) {
      setError(getError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h4 className="fw-bold mb-3" style={{ color: '#0d3b66' }}>
        <i className="bi bi-box-arrow-in-down me-2" />Stock In — Receive Goods
      </h4>

      {success && (
        <Alert variant="success" dismissible onClose={() => setSuccess(null)}>
          Stock received for <strong>{success.name}</strong>{success.reference ? ` (${success.reference})` : ''}.
        </Alert>
      )}

      <Row className="g-3">
        <Col lg={7}>
          <Form onSubmit={submit}>
            <Card body>
              {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
              <Form.Group className="mb-3">
                <Form.Label>Product *</Form.Label>
                <Form.Select value={productId} onChange={(e) => {
                  setProductId(e.target.value)
                  const p = products.find((x) => x._id === e.target.value)
                  if (p && !buyingPrice) setBuyingPrice(p.buyingPrice)
                }} required>
                  <option value="">-- Select product --</option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>{p.name} ({p.sku}) — stock: {p.quantity}</option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Row className="g-3">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Quantity *</Form.Label>
                    <Form.Control type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Buying Price (RWF)</Form.Label>
                    <Form.Control type="number" min="0" value={buyingPrice} onChange={(e) => setBuyingPrice(e.target.value)} placeholder={selected ? selected.buyingPrice : 'RWF'} />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>GRN / Reference</Form.Label>
                    <Form.Control value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Auto-generated if empty" />
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mt-3">
                <Form.Label>Reason / Notes</Form.Label>
                <Form.Control value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Purchased from supplier" />
              </Form.Group>

              <div className="d-flex justify-content-end mt-3 gap-2">
                {selected && (
                  <Badge bg="" className="badge-soft-info align-self-center">Current stock: {selected.quantity} → New: {selected.quantity + (Number(quantity) || 0)}</Badge>
                )}
                <Button type="submit" disabled={saving}>
                  {saving ? <><span className="spinner-border spinner-border-sm me-1" />Recording...</> : <><i className="bi bi-check-lg me-1" />Receive Stock</>}
                </Button>
              </div>
            </Card>
          </Form>
        </Col>
      </Row>
    </div>
  )
}
