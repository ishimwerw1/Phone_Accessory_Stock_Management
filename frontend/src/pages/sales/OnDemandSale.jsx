import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, Row, Col, Form, Button, InputGroup, ListGroup, Alert, Modal, Badge } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'
import api, { getError } from '../../api/client'
import { formatMoney } from '../../context/LanguageContext'
import { extractRates } from '../../utils/currency'
import ExchangeRateCard from '../../components/common/ExchangeRateCard'

export default function OnDemandSale() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [productSearch, setProductSearch] = useState('')
  const [suppliers, setSuppliers] = useState([])
  const [supplier, setSupplier] = useState(null)
  const [supplierQuery, setSupplierQuery] = useState('')
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState([])
  const [showCustomerResults, setShowCustomerResults] = useState(false)
  const [customer, setCustomer] = useState(null)
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' })
  const [cart, setCart] = useState([])
  const [discount, setDiscount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [amountPaidInput, setAmountPaidInput] = useState('')
  const [reference, setReference] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [completed, setCompleted] = useState(null)

  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [addingSupplier, setAddingSupplier] = useState(false)
  const [newSupplier, setNewSupplier] = useState({ name: '', phone: '', company: '' })

  const [showAddProduct, setShowAddProduct] = useState(false)
  const [addingProduct, setAddingProduct] = useState(false)
  const [newProduct, setNewProduct] = useState({ name: '', sellingPrice: '', buyingPriceAED: '' })
  const [duplicateWarning, setDuplicateWarning] = useState('')
  const [dupProduct, setDupProduct] = useState(null)
  const [rates, setRates] = useState(null)
  const [ratesError, setRatesError] = useState('')
  const searchTimer = useRef(null)
  const dupTimer = useRef(null)

  useEffect(() => {
    api.get('/products', { params: { limit: 200, status: 'ACTIVE' } })
      .then((r) => setProducts(r.data.data.products))
      .catch((e) => setError(getError(e)))
    api.get('/suppliers')
      .then((r) => setSuppliers(r.data.data))
      .catch(() => {})
    api.get('/exchange-rates')
      .then((r) => { setRates(extractRates(r.data.data)); setRatesError('') })
      .catch(() => setRatesError('Could not load the latest exchange rate.'))
  }, [])

  useEffect(() => {
    if (!customerQuery.trim() || customerQuery.length < 2) {
      setCustomerResults([])
      return
    }
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/customers', { params: { search: customerQuery.trim(), limit: 8 } })
        setCustomerResults(data.data)
        setShowCustomerResults(true)
      } catch { /* silent */ }
    }, 300)
    return () => clearTimeout(searchTimer.current)
  }, [customerQuery])

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    const list = q
      ? products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode || '').includes(q))
      : products
    return list.slice(0, 12)
  }, [products, productSearch])

  const filteredSuppliers = useMemo(() => {
    const q = supplierQuery.trim().toLowerCase()
    if (!q) return suppliers
    return suppliers.filter((s) => s.name.toLowerCase().includes(q) || s.company?.toLowerCase().includes(q) || (s.phone || '').includes(q))
  }, [suppliers, supplierQuery])

  const supplierCost = cart.reduce((s, i) => s + i.quantity * i.buyingPrice, 0)
  const subtotal = cart.reduce((s, i) => s + i.quantity * i.price, 0)
  const total = Math.max(0, subtotal - Number(discount || 0))
  const paidAmount = paymentMethod === 'LOAN' ? Number(amountPaidInput || 0) : total
  const balance = Math.max(0, total - paidAmount)
  const profit = total - supplierCost

  const getEffectiveSupplier = (item) => {
    if (item.supplierId) return suppliers.find((s) => s._id === item.supplierId)
    return supplier
  }

  const addToCart = (p) => {
    setError('')
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === p._id)
      if (existing) {
        return prev.map((i) => i.productId === p._id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, {
        productId: p._id,
        productName: p.name,
        sku: p.sku,
        quantity: 1,
        price: p.sellingPrice,
        buyingPrice: p.buyingPrice || 0,
        supplierId: '',
      }]
    })
  }

  const updateQty = (productId, qty) => {
    setCart((prev) => prev.map((i) => i.productId === productId ? { ...i, quantity: Math.max(0, Number(qty) || 0) } : i))
  }
  const updatePrice = (productId, value) => {
    setCart((prev) => prev.map((i) => i.productId === productId ? { ...i, price: Math.max(0, Number(value) || 0) } : i))
  }
  const updateBuyingPrice = (productId, value) => {
    setCart((prev) => prev.map((i) => i.productId === productId ? { ...i, buyingPrice: Math.max(0, Number(value) || 0) } : i))
  }
  const updateItemSupplier = (productId, supplierId) => {
    setCart((prev) => prev.map((i) => i.productId === productId ? { ...i, supplierId } : i))
  }

  const createSupplier = async () => {
    if (!newSupplier.name.trim()) return setError('Supplier name is required')
    setAddingSupplier(true)
    setError('')
    try {
      const { data } = await api.post('/suppliers', { name: newSupplier.name.trim(), company: newSupplier.company.trim(), phone: newSupplier.phone.trim() })
      const created = data.data
      setSupplier(created)
      setSupplierQuery(created.name)
      setNewSupplier({ name: '', phone: '', company: '' })
      setShowAddSupplier(false)
      api.get('/suppliers').then((r) => setSuppliers(r.data.data)).catch(() => {})
    } catch (err) {
      setError(getError(err))
    } finally {
      setAddingSupplier(false)
    }
  }

  const checkDuplicate = (name) => {
    clearTimeout(dupTimer.current)
    setDupProduct(null)
    setDuplicateWarning('')
    if (!name || name.trim().length < 2) return
    dupTimer.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/products/check-duplicate', { params: { name: name.trim() } })
        if (data.data.exists) {
          setDupProduct(data.data.product)
          setDuplicateWarning(`A product named "${data.data.product.name}" already exists (${data.data.product.sku}, selling at ${formatMoney(data.data.product.sellingPrice)}).`)
        }
      } catch { /* silent */ }
    }, 400)
  }

  const createProduct = async () => {
    if (!newProduct.name.trim()) return setError('Product name is required')
    if (dupProduct) {
      addToCart({ _id: dupProduct._id, name: dupProduct.name, sku: dupProduct.sku, sellingPrice: dupProduct.sellingPrice, buyingPrice: dupProduct.sellingPrice })
      setNewProduct({ name: '', sellingPrice: '', buyingPriceAED: '' })
      setDupProduct(null)
      setDuplicateWarning('')
      setShowAddProduct(false)
      return
    }
    setAddingProduct(true)
    setError('')
    try {
      const { data } = await api.post('/products', {
        name: newProduct.name.trim(),
        sellingPrice: Number(newProduct.sellingPrice || 0),
        buyingPriceAED: Number(newProduct.buyingPriceAED || 0),
      })
      const created = data.data
      addToCart(created)
      setNewProduct({ name: '', sellingPrice: '', buyingPriceAED: '' })
      setDupProduct(null)
      setDuplicateWarning('')
      setShowAddProduct(false)
      api.get('/products', { params: { limit: 200, status: 'ACTIVE' } }).then((r) => setProducts(r.data.data.products)).catch(() => {})
    } catch (err) {
      setError(getError(err))
    } finally {
      setAddingProduct(false)
    }
  }

  const submit = async () => {
    if (!supplier && !cart.some((i) => i.supplierId)) return setError('Please select a supplier (global or per-item) for on-demand sourcing')
    setSaving(true)
    setError('')
    try {
      const payload = {
        customer: customer
          ? { _id: customer._id }
          : (newCustomer.name || newCustomer.phone)
            ? { name: newCustomer.name, phone: newCustomer.phone }
            : undefined,
        supplier: supplier?._id || undefined,
        items: cart.map(({ productId, quantity, price, buyingPrice, supplierId }) => ({
          productId, quantity, price, buyingPrice,
          supplierId: supplierId || supplier?._id || undefined,
        })),
        discount: Number(discount || 0),
        amountPaid: paidAmount,
        paymentMethod,
        reference: reference || undefined,
        dueDate: dueDate || undefined,
        notes: notes || undefined,
      }
      const { data } = await api.post('/sales/on-demand', payload)
      setCompleted(data.data)
      setConfirming(false)
      window.dispatchEvent(new Event('stock-updated'))
    } catch (err) {
      setError(getError(err))
      setConfirming(false)
    } finally {
      setSaving(false)
    }
  }

  const resetAll = () => {
    setCompleted(null)
    setCart([]); setDiscount(0); setPaymentMethod('CASH'); setAmountPaidInput('')
    setReference(''); setDueDate(''); setNotes(''); setCustomer(null)
    setNewCustomer({ name: '', phone: '' }); setCustomerQuery(''); setError('')
  }

  if (completed) {
    const purchases = completed.purchases || (completed.purchase ? [completed.purchase] : [])
    return (
      <div className="text-center py-5">
        <div className="mb-3"><i className="bi bi-check-circle-fill text-success" style={{ fontSize: '4rem' }} /></div>
        <h3 className="fw-bold" style={{ color: '#0d3b66' }}>On-demand sale completed</h3>
        <p className="text-muted mb-1">Sale <strong>{completed.sale.saleNumber}</strong></p>
        <div className="d-flex justify-content-center gap-3 my-3 flex-wrap">
          <div className="border rounded p-3 bg-light">
            <div className="small text-muted">Customer pays</div>
            <div className="fw-bold fs-5">{formatMoney(completed.customerPayment)}</div>
          </div>
          <div className="border rounded p-3 bg-light">
            <div className="small text-muted">Total supplier cost</div>
            <div className="fw-bold fs-5">{formatMoney(completed.supplierAmount)}</div>
          </div>
          <div className="border rounded p-3 bg-light">
            <div className="small text-muted">Expected profit</div>
            <div className="fw-bold fs-5 text-success">{formatMoney(completed.profit)}</div>
          </div>
        </div>
        {purchases.length > 1 && (
          <div className="d-flex justify-content-center mb-3">
            <div className="border rounded p-3 bg-light text-start" style={{ minWidth: 300 }}>
              <strong className="small text-muted d-block mb-2">Supplier Breakdown</strong>
              {purchases.map((p) => (
                <div key={p._id} className="d-flex justify-content-between small mb-1">
                  <span>{p.supplierName}</span>
                  <span className="fw-semibold">{formatMoney(p.totalAmount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="d-flex justify-content-center gap-2 mt-3 flex-wrap">
          <Button variant="primary" onClick={() => navigate(`/sales/${completed.sale._id}`)}>
            <i className="bi bi-receipt me-1" />View / Print Invoice
          </Button>
          {purchases.map((p) => (
            <Button key={p._id} variant="outline-success" size="sm" onClick={() => navigate(`/purchases/${p._id}`)}>
              <i className="bi bi-truck me-1" />{p.supplierName} — {formatMoney(p.remainingAmount)}
            </Button>
          ))}
          <Button variant="outline-primary" onClick={() => resetAll()}><i className="bi bi-plus-lg me-1" />New On-demand Sale</Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h4 className="fw-bold mb-3" style={{ color: '#0d3b66' }}>
        <i className="bi bi-cart-plus me-2" />On-demand Sale (Sourcing)
      </h4>
      <p className="text-muted small mb-3">
        <i className="bi bi-info-circle me-1" />
        Sell a product not in stock: set the <strong>selling price</strong> (customer pays) and <strong>buying price</strong> (you pay supplier). Products can come from <strong>different suppliers</strong> — assign per item or use a default supplier.
      </p>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')} className="py-2 small">{error}</Alert>}

      <Row className="g-3">
        <Col lg={7}>
          <Card body className="mb-3">
            <Form.Label className="small fw-semibold">1. Customer</Form.Label>
            {customer ? (
              <div className="d-flex justify-content-between align-items-center border rounded p-2 bg-light">
                <div>
                  <strong className="small">{customer.name}</strong>
                  <span className="text-muted ms-2 small">{customer.phone}</span>
                </div>
                <Button size="sm" variant="link" onClick={() => { setCustomer(null); setCustomerQuery('') }}>change</Button>
              </div>
            ) : (
              <>
                <div className="position-relative">
                  <InputGroup>
                    <InputGroup.Text><i className="bi bi-person-search" /></InputGroup.Text>
                    <Form.Control
                      placeholder="Search customer by name or phone, or leave blank for walk-in"
                      value={customerQuery}
                      onChange={(e) => setCustomerQuery(e.target.value)}
                      onFocus={() => setShowCustomerResults(true)}
                      onBlur={() => setTimeout(() => setShowCustomerResults(false), 200)}
                    />
                  </InputGroup>
                  {showCustomerResults && customerResults.length > 0 && (
                    <ListGroup className="position-absolute w-100 shadow-sm" style={{ zIndex: 10 }}>
                      {customerResults.map((c) => (
                        <ListGroup.Item action key={c._id} onClick={() => { setCustomer(c); setCustomerQuery(c.name); setShowCustomerResults(false) }}>
                          <div className="d-flex justify-content-between small">
                            <span><i className="bi bi-person me-1" />{c.name}</span>
                            <span className="text-muted">{c.phone}</span>
                          </div>
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                  )}
                </div>
                {!customer && (
                  <Row className="g-2 mt-2">
                    <Col md={6}>
                      <Form.Control size="sm" placeholder="New customer name" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} />
                    </Col>
                    <Col md={6}>
                      <Form.Control size="sm" placeholder="New customer phone (e.g. 0788123456)" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} />
                    </Col>
                  </Row>
                )}
              </>
            )}
          </Card>

          <Card body className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <Form.Label className="small fw-semibold mb-0">2. Default Supplier <span className="text-muted fw-normal">(applies to all items unless overridden)</span></Form.Label>
              <Button size="sm" variant="outline-primary" onClick={() => setShowAddSupplier(true)}>
                <i className="bi bi-plus-lg me-1" />New Supplier
              </Button>
            </div>
            {supplier ? (
              <div className="d-flex justify-content-between align-items-center border rounded p-2 bg-light">
                <div className="small">
                  <strong>{supplier.name}</strong>
                  <span className="text-muted ms-2">{supplier.company || ''} {supplier.phone}</span>
                </div>
                <Button size="sm" variant="link" onClick={() => { setSupplier(null); setSupplierQuery('') }}>change</Button>
              </div>
            ) : (
              <InputGroup>
                <InputGroup.Text><i className="bi bi-truck" /></InputGroup.Text>
                <Form.Select value={supplierQuery} onChange={(e) => {
                  setSupplierQuery(e.target.value)
                  const s = suppliers.find((x) => x._id === e.target.value)
                  if (s) { setSupplier(s); setSupplierQuery(s.name) }
                }}>
                  <option value="">Select default supplier...</option>
                  {filteredSuppliers.map((s) => <option key={s._id} value={s._id}>{s.name}{s.company ? ` — ${s.company}` : ''}</option>)}
                </Form.Select>
              </InputGroup>
            )}
          </Card>

          <Card body className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <Form.Label className="small fw-semibold mb-0">3. Products to source</Form.Label>
              <Button size="sm" variant="outline-primary" onClick={() => { setDupProduct(null); setDuplicateWarning(''); setNewProduct({ name: '', sellingPrice: '', buyingPriceAED: '' }); setShowAddProduct(true) }}>
                <i className="bi bi-plus-lg me-1" />Add Product
              </Button>
            </div>
            <InputGroup className="mb-3">
              <InputGroup.Text><i className="bi bi-search" /></InputGroup.Text>
              <Form.Control
                placeholder="Search by name, SKU or barcode..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                autoFocus
              />
            </InputGroup>
            <Row className="g-2" xs={2} md={3}>
              {filteredProducts.map((p) => (
                <Col key={p._id}>
                  <Card className="pos-product-card" onClick={() => addToCart(p)}>
                    <Card.Body className="p-2">
                      <div className="d-flex gap-2 align-items-center">
                        {p.image
                          ? <img src={p.image} alt="" className="pos-thumb" style={{ width: 48 }} />
                          : <span className="pos-thumb d-inline-flex align-items-center justify-content-center" style={{ width: 48 }}><i className="bi bi-box text-secondary" /></span>}
                        <div className="min-w-0">
                          <div className="small fw-semibold text-truncate-2">{p.name}</div>
                          <div className="text-muted" style={{ fontSize: '0.72rem' }}>{p.sku}</div>
                        </div>
                      </div>
                      <div className="d-flex justify-content-between align-items-center mt-2">
                        <strong className="small">{formatMoney(p.sellingPrice)}</strong>
                        <span className="text-muted" style={{ fontSize: '0.7rem' }}>buy: {formatMoney(p.buyingPrice || 0)}</span>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
              {filteredProducts.length === 0 && <Col className="text-center text-muted py-4">No products found.</Col>}
            </Row>
          </Card>
        </Col>

        <Col lg={5}>
          <Card className="sticky-top" style={{ top: 76 }}>
            <Card.Header className="bg-white d-flex justify-content-between align-items-center">
              <span className="fw-semibold"><i className="bi bi-cart3 me-2" />Sourcing cart ({cart.length})</span>
              {cart.length > 0 && <Button variant="link" size="sm" className="p-0 text-danger text-decoration-none" onClick={() => setCart([])}>clear</Button>}
            </Card.Header>
            <Card.Body style={{ maxHeight: 320, overflowY: 'auto' }}>
              {cart.length === 0 ? (
                <div className="text-center text-muted py-4 small"><i className="bi bi-cart-x fs-2 d-block opacity-50 mb-1" />Cart is empty. Add products to source.</div>
              ) : cart.map((item) => {
                const effectiveSup = getEffectiveSupplier(item)
                return (
                <div key={item.productId} className="cart-line py-2">
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="min-w-0 pe-2">
                      <div className="small fw-semibold text-truncate-2">{item.productName}</div>
                      <div className="text-muted" style={{ fontSize: '0.72rem' }}>{item.sku}</div>
                    </div>
                    <button className="btn btn-sm btn-link text-danger p-0" onClick={() => setCart(cart.filter((i) => i.productId !== item.productId))}>
                      <i className="bi bi-x-lg small" />
                    </button>
                  </div>
                  <div className="d-flex align-items-center gap-2 mt-2">
                    <Button size="sm" variant="light" className="border py-0 px-2" onClick={() => updateQty(item.productId, item.quantity - 1)}>-</Button>
                    <Form.Control size="sm" type="number" min="1" value={item.quantity} onChange={(e) => updateQty(item.productId, e.target.value)} style={{ width: 64 }} />
                    <Button size="sm" variant="light" className="border py-0 px-2" onClick={() => updateQty(item.productId, item.quantity + 1)}>+</Button>
                  </div>
                  <div className="d-flex gap-2 mt-2">
                    <InputGroup size="sm">
                      <InputGroup.Text className="small">Sell</InputGroup.Text>
                      <Form.Control type="number" min="0" value={item.price} onChange={(e) => updatePrice(item.productId, e.target.value)} />
                    </InputGroup>
                    <InputGroup size="sm">
                      <InputGroup.Text className="small">Buy</InputGroup.Text>
                      <Form.Control type="number" min="0" value={item.buyingPrice} onChange={(e) => updateBuyingPrice(item.productId, e.target.value)} />
                    </InputGroup>
                  </div>
                  <div className="mt-2">
                    <Form.Select size="sm" value={item.supplierId || ''} onChange={(e) => updateItemSupplier(item.productId, e.target.value)} style={{ fontSize: '0.75rem' }}>
                      <option value="">{effectiveSup ? `${effectiveSup.name} (default)` : 'Select supplier...'}</option>
                      {suppliers.filter((s) => !item.supplierId || s._id !== (effectiveSup?._id)).map((s) => (
                        <option key={s._id} value={s._id}>{s.name}{s.company ? ` — ${s.company}` : ''}</option>
                      ))}
                    </Form.Select>
                  </div>
                  <div className="d-flex justify-content-between text-muted mt-1" style={{ fontSize: '0.72rem' }}>
                    <span>Customer: <strong className="text-dark">{formatMoney(item.quantity * item.price)}</strong></span>
                    <span>Supplier: <strong className="text-dark">{formatMoney(item.quantity * item.buyingPrice)}</strong></span>
                  </div>
                </div>
              )})}
            </Card.Body>

            <Card.Footer className="bg-white">
              <div className="d-flex justify-content-between small mb-1">
                <span className="text-muted">Subtotal (customer)</span><strong>{formatMoney(subtotal)}</strong>
              </div>
              <div className="d-flex justify-content-between small mb-1">
                <span className="text-muted">Supplier buying cost</span><strong>{formatMoney(supplierCost)}</strong>
              </div>
              <div className="d-flex justify-content-between align-items-center small mb-2">
                <span className="text-muted">Discount (RWF)</span>
                <Form.Control size="sm" type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} style={{ width: 110 }} />
              </div>
              <div className="d-flex justify-content-between small mb-1">
                <span className="text-muted">Expected profit</span>
                <strong className={profit >= 0 ? 'text-success' : 'text-danger'}>{formatMoney(profit)}</strong>
              </div>
              <hr className="my-2" />
              <div className="d-flex justify-content-between mb-3">
                <span className="fw-bold">TOTAL</span>
                <span className="fw-bold fs-5" style={{ color: '#0d3b66' }}>{formatMoney(total)}</span>
              </div>

              <Form.Group className="mb-2">
                <Form.Label className="small fw-semibold">4. Payment Method *</Form.Label>
                <div className="d-flex gap-2 flex-wrap">
                  {[['CASH', 'bi-cash', 'Cash'], ['MOMO', 'bi-phone', 'MoMo'], ['BANK', 'bi-bank', 'Bank'], ['LOAN', 'bi-credit-card', 'Loan']].map(([val, icon, label]) => (
                    <Button key={val} size="sm" variant={paymentMethod === val ? 'primary' : 'outline-secondary'} onClick={() => { setPaymentMethod(val); setAmountPaidInput('') }}>
                      <i className={`bi ${icon} me-1`} />{label}
                    </Button>
                  ))}
                </div>
              </Form.Group>

              {(paymentMethod === 'MOMO' || paymentMethod === 'BANK') && (
                <Form.Group className="mb-2">
                  <Form.Label className="small">{paymentMethod === 'MOMO' ? 'MoMo Transaction ID (optional)' : 'Bank Slip / Reference (optional)'}</Form.Label>
                  <Form.Control size="sm" value={reference} onChange={(e) => setReference(e.target.value)} />
                </Form.Group>
              )}

              {paymentMethod === 'LOAN' && (
                <>
                  <Row className="g-2 mb-2">
                    <Col sm={6}>
                      <Form.Group>
                        <Form.Label className="small">Down Payment (RWF)</Form.Label>
                        <Form.Control size="sm" type="number" min="0" max={total} value={amountPaidInput} onChange={(e) => setAmountPaidInput(e.target.value)} placeholder="0" />
                      </Form.Group>
                    </Col>
                    <Col sm={6}>
                      <Form.Group>
                        <Form.Label className="small">Due Date</Form.Label>
                        <Form.Control size="sm" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                      </Form.Group>
                    </Col>
                  </Row>
                  <Alert variant="warning" className="py-2 small mb-2">
                    <i className="bi bi-exclamation-triangle me-1" />
                    Credit sale: a loan record will be created for <strong>{formatMoney(balance)}</strong>.
                  </Alert>
                </>
              )}

              <Form.Group className="mb-3">
                <Form.Control size="sm" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Form.Group>

              <Button className="w-100 py-2 fw-semibold" variant="success"
                disabled={cart.length === 0 || saving} onClick={() => setConfirming(true)}>
                <i className="bi bi-check-circle me-1" />Complete Sourcing Sale — {formatMoney(total)}
              </Button>
            </Card.Footer>
          </Card>
        </Col>
      </Row>

      <Modal show={confirming} onHide={() => !saving && setConfirming(false)} centered backdrop="static">
        <Modal.Header closeButton={!saving}><Modal.Title className="fs-6 fw-bold"><i className="bi bi-patch-check me-2 text-success" />Confirm On-demand Sale</Modal.Title></Modal.Header>
        <Modal.Body>
          <table className="table table-sm small mb-3">
            <tbody>
              <tr><td className="text-muted">Customer</td><td className="text-end fw-semibold">{customer ? `${customer.name} (${customer.phone})` : `${newCustomer.name || '-'} (${newCustomer.phone || '-'})`}</td></tr>
              <tr><td className="text-muted">Customer pays</td><td className="text-end fw-bold">{formatMoney(total)}</td></tr>
              <tr><td className="text-muted">Supplier buying cost</td><td className="text-end">{formatMoney(supplierCost)}</td></tr>
              <tr><td className="text-muted">Expected profit</td><td className={`text-end fw-bold ${profit >= 0 ? 'text-success' : 'text-danger'}`}>{formatMoney(profit)}</td></tr>
              <tr><td className="text-muted">Payment Method</td><td className="text-end">{paymentMethod}</td></tr>
              <tr><td className="text-muted">Amount Paid</td><td className="text-end">{formatMoney(paidAmount)}</td></tr>
              {balance > 0 && (
                <tr className="table-warning"><td className="text-muted">Credit Balance</td><td className="text-end fw-bold text-danger">{formatMoney(balance)}</td></tr>
              )}
            </tbody>
          </table>
          {(() => {
            const supBreakdown = {}
            cart.forEach((item) => {
              const sid = item.supplierId || supplier?._id || 'unknown'
              const sname = getEffectiveSupplier(item)?.name || 'Unknown Supplier'
              if (!supBreakdown[sid]) supBreakdown[sid] = { name: sname, amount: 0 }
              supBreakdown[sid].amount += item.quantity * item.buyingPrice
            })
            const supList = Object.values(supBreakdown)
            return supList.length > 0 && (
              <div className="small mb-2">
                <strong className="text-muted d-block mb-1">Supplier debt breakdown:</strong>
                {supList.map((s, i) => (
                  <div key={i} className="d-flex justify-content-between">
                    <span>{s.name}</span>
                    <span className="fw-semibold">{formatMoney(s.amount)}</span>
                  </div>
                ))}
              </div>
            )
          })()}
          <p className="small text-muted mb-0"><i className="bi bi-info-circle me-1" />{cart.length > 1 ? 'Separate supplier purchases will be recorded for each supplier.' : 'A supplier purchase'} ({formatMoney(supplierCost)}) will be recorded and must be paid to the supplier(s). Stock is NOT reduced.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setConfirming(false)} disabled={saving}>Cancel</Button>
          <Button variant="success" onClick={submit} disabled={saving}>
            {saving ? <><span className="spinner-border spinner-border-sm me-1" />Processing...</> : <><i className="bi bi-check-lg me-1" />Confirm & Complete</>}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showAddSupplier} onHide={() => !addingSupplier && setShowAddSupplier(false)} centered>
        <Modal.Header closeButton={!addingSupplier}><Modal.Title className="fs-6 fw-bold"><i className="bi bi-truck me-2" />Add New Supplier</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-2">
            <Form.Label className="small fw-semibold">Supplier Name *</Form.Label>
            <Form.Control autoFocus value={newSupplier.name} onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })} />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label className="small fw-semibold">Company</Form.Label>
            <Form.Control value={newSupplier.company} onChange={(e) => setNewSupplier({ ...newSupplier, company: e.target.value })} />
          </Form.Group>
          <Form.Group className="mb-0">
            <Form.Label className="small fw-semibold">Phone</Form.Label>
            <Form.Control value={newSupplier.phone} onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowAddSupplier(false)} disabled={addingSupplier}>Cancel</Button>
          <Button onClick={createSupplier} disabled={addingSupplier}>
            {addingSupplier ? <><span className="spinner-border spinner-border-sm me-1" />Adding...</> : 'Add Supplier'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showAddProduct} onHide={() => !addingProduct && setShowAddProduct(false)} centered>
        <Modal.Header closeButton={!addingProduct}><Modal.Title className="fs-6 fw-bold"><i className="bi bi-box-seam me-2" />Add New Product</Modal.Title></Modal.Header>
        <Modal.Body>
          {duplicateWarning && (
            <Alert variant="warning" className="py-2 small mb-3">
              <i className="bi bi-exclamation-triangle me-1" />{duplicateWarning}
              <div className="mt-1">
                <Button size="sm" variant="outline-warning" onClick={() => {
                  if (dupProduct) { addToCart(dupProduct); setShowAddProduct(false); setDupProduct(null); setDuplicateWarning(''); setNewProduct({ name: '', sellingPrice: '', buyingPriceAED: '' }) }
                }}>
                  <i className="bi bi-plus-lg me-1" />Add existing product instead
                </Button>
              </div>
            </Alert>
          )}
          <Form.Group className="mb-2">
            <Form.Label className="small fw-semibold">Product Name *</Form.Label>
            <Form.Control autoFocus value={newProduct.name} onChange={(e) => { setNewProduct({ ...newProduct, name: e.target.value }); checkDuplicate(e.target.value) }} placeholder="e.g. Samsung S21 LCD" />
          </Form.Group>
          <Row className="g-2">
            <Col sm={6}>
              <Form.Group>
                <Form.Label className="small fw-semibold">Selling Price (RWF) *</Form.Label>
                <Form.Control type="number" min="0" value={newProduct.sellingPrice} onChange={(e) => setNewProduct({ ...newProduct, sellingPrice: e.target.value })} />
              </Form.Group>
            </Col>
            <Col sm={6}>
              <Form.Group>
                <Form.Label className="small fw-semibold">Buy Price Per Unit (AED)</Form.Label>
                <InputGroup size="sm">
                  <InputGroup.Text>AED</InputGroup.Text>
                  <Form.Control type="number" min="0" value={newProduct.buyingPriceAED} onChange={(e) => setNewProduct({ ...newProduct, buyingPriceAED: e.target.value })} placeholder="e.g. 500" />
                </InputGroup>
              </Form.Group>
            </Col>
          </Row>
          {ratesError && <Alert variant="warning" className="py-1 px-2 small mt-2 mb-0"><i className="bi bi-exclamation-triangle me-1" />{ratesError}</Alert>}
          <ExchangeRateCard aed={newProduct.buyingPriceAED} rates={rates} />
          <p className="small text-muted mt-2 mb-0"><i className="bi bi-info-circle me-1" />A SKU is generated automatically. The product starts with 0 stock.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowAddProduct(false)} disabled={addingProduct}>Cancel</Button>
          {dupProduct ? (
            <Button variant="warning" onClick={createProduct} disabled={addingProduct}>
              <i className="bi bi-plus-lg me-1" />Add Existing Product
            </Button>
          ) : (
            <Button onClick={createProduct} disabled={addingProduct}>
              {addingProduct ? <><span className="spinner-border spinner-border-sm me-1" />Creating...</> : <><i className="bi bi-check-lg me-1" />Create & Add to Cart</>}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  )
}
