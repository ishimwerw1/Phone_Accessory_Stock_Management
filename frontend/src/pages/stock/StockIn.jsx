import { useEffect, useState } from 'react'
import { Card, Row, Col, Form, Button, Alert, Badge, InputGroup } from 'react-bootstrap'
import api, { getError } from '../../api/client'
import { extractRates } from '../../utils/currency'
import ExchangeRateCard from '../../components/common/ExchangeRateCard'

export default function StockIn() {
  const [products, setProducts] = useState([])
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [buyingPriceAED, setBuyingPriceAED] = useState('')
  const [rates, setRates] = useState(null)
  const [ratesError, setRatesError] = useState('')
  const [reference, setReference] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/products', { params: { limit: 200, status: 'ACTIVE' } })
      .then((r) => setProducts(r.data.data.products || []))
      .catch((e) => setError(getError(e)))
    api.get('/exchange-rates')
      .then((r) => { setRates(extractRates(r.data.data)); setRatesError('') })
      .catch(() => setRatesError('Could not load the latest exchange rate.'))
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
        buyingPriceAED: buyingPriceAED === '' ? undefined : Number(buyingPriceAED),
        reference: reference || undefined,
        reason: reason || undefined
      })
      const p = data.data
      setSuccess({ name: p.name, reference })
      setProductId('')
      setQuantity('')
      setBuyingPriceAED('')
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
                <Form.Select value={productId} onChange={(e) => setProductId(e.target.value)} required>
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
                <Col md={8}>
                  <Form.Group>
                    <Form.Label>Buy Price Per Unit (AED)</Form.Label>
                    <InputGroup>
                      <InputGroup.Text>AED (UAE Dirham)</InputGroup.Text>
                      <Form.Control
                        type="number"
                        min="0"
                        value={buyingPriceAED}
                        onChange={(e) => setBuyingPriceAED(e.target.value)}
                        placeholder={selected ? `${selected.buyingPrice} RWF currently` : 'e.g. 500'}
                      />
                    </InputGroup>
                    <Form.Text muted>Leave empty to keep the existing buying price. New AED price is converted to RWF.</Form.Text>
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>GRN / Reference</Form.Label>
                    <Form.Control value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Auto-generated if empty" />
                  </Form.Group>
                </Col>
              </Row>

              {ratesError && <Alert variant="warning" className="py-1 px-2 small mt-2 mb-0"><i className="bi bi-exclamation-triangle me-1" />{ratesError}</Alert>}
              <ExchangeRateCard aed={buyingPriceAED} rates={rates} quantity={quantity} showTotal />

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
