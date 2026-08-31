import { useEffect, useState } from 'react'
import { Modal, Form, Row, Col, Button, Alert } from 'react-bootstrap'
import api from '../../api/client'
import { getError } from '../../api/client'

const empty = {
  name: '', sku: '', barcode: '', category: '', subcategory: '', brand: '',
  compatibleModels: [], partType: '', condition: 'NEW', description: '',
  buyingPrice: '', sellingPrice: '', quantity: 0, minStock: 5,
  supplier: '', location: '', image: '', status: 'ACTIVE'
}

export default function ProductForm({ show, onClose, onSaved, product }) {
  const isEdit = Boolean(product)
  const [form, setForm] = useState(empty)
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [brands, setBrands] = useState([])
  const [models, setModels] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!show) return
    setError('')
    if (product) {
      const { _id, image, createdAt, updatedAt, stockStatus, stockState, __v, ...rest } = product
      setForm({
        ...empty,
        ...rest,
        category: rest.category?._id || rest.category || '',
        subcategory: rest.subcategory?._id || rest.subcategory || '',
        brand: rest.brand?._id || rest.brand || '',
        supplier: rest.supplier?._id || rest.supplier || '',
        compatibleModels: (rest.compatibleModels || []).map((m) => m?._id || m)
      })
    } else {
      setForm(empty)
    }
    Promise.all([
      api.get('/categories'),
      api.get('/suppliers'),
      api.get('/brands'),
      api.get('/phone-models')
    ]).then(([catRes, supRes, brandRes, modelRes]) => {
      setCategories(catRes.data.data)
      setSuppliers(supRes.data.data)
      setBrands(brandRes.data.data)
      setModels(modelRes.data.data)
    }).catch(() => {})
  }, [show, product])

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const toggleModel = (id) =>
    setForm((f) => {
      const cur = f.compatibleModels || []
      return {
        ...f,
        compatibleModels: cur.includes(id) ? cur.filter((m) => m !== id) : [...cur, id]
      }
    })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload = {
        ...form,
        category: form.category || null,
        subcategory: form.subcategory || null,
        brand: form.brand || null,
        supplier: form.supplier || null,
        compatibleModels: form.compatibleModels || [],
        quantity: Number(form.quantity) || 0,
        buyingPrice: Number(form.buyingPrice) || 0,
        sellingPrice: Number(form.sellingPrice) || 0,
        minStock: Number(form.minStock) || 0
      }
      if (isEdit) {
        await api.put(`/products/${product._id}`, payload)
      } else {
        await api.post('/products', payload)
      }
      onSaved()
    } catch (err) {
      setError(getError(err))
    } finally {
      setSaving(false)
    }
  }

  const parentCategories = categories.filter((c) => !c.parent)

  return (
    <Modal show={show} onHide={onClose} centered size="lg" backdrop="static">
      <Form onSubmit={submit}>
        <Modal.Header closeButton>
          <Modal.Title className="fs-6 fw-bold">
            <i className="bi bi-box-seam me-2 text-primary" />
            {isEdit ? 'Edit Product' : 'Add Product'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
          <Row className="g-3">
            <Col md={8}>
              <Form.Group>
                <Form.Label>Product Name *</Form.Label>
                <Form.Control value={form.name} onChange={set('name')} required placeholder="e.g. OLED Screen iPhone 11, Battery Samsung A32" />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>SKU / Code</Form.Label>
                <Form.Control value={form.sku} onChange={set('sku')} placeholder="Auto-generates if empty" style={{ textTransform: 'uppercase' }} />
                <Form.Text muted>Leave empty and a unique part code is generated.</Form.Text>
              </Form.Group>
            </Col>

            <Col md={4}>
              <Form.Group>
                <Form.Label>Category *</Form.Label>
                <Form.Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value, subcategory: '' }))} required>
                  <option value="">-- Select --</option>
                  {parentCategories.map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Subcategory</Form.Label>
                <Form.Select value={form.subcategory} onChange={set('subcategory')}>
                  <option value="">-- None --</option>
                  {(categories.find((c) => c._id === form.category)?.children || []).map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Brand</Form.Label>
                <Form.Select value={form.brand} onChange={set('brand')}>
                  <option value="">-- None --</option>
                  {brands.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col md={3}>
              <Form.Group>
                <Form.Label>Buying Price *</Form.Label>
                <Form.Control type="number" min="0" step="0.01" value={form.buyingPrice} onChange={set('buyingPrice')} required />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Selling Price *</Form.Label>
                <Form.Control type="number" min="0" step="0.01" value={form.sellingPrice} onChange={set('sellingPrice')} required />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Min Stock Level</Form.Label>
                <Form.Control type="number" min="0" value={form.minStock} onChange={set('minStock')} />
              </Form.Group>
            </Col>
            {!isEdit && (
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Opening Quantity</Form.Label>
                  <Form.Control type="number" min="0" value={form.quantity} onChange={set('quantity')} />
                  <Form.Text muted>Recorded as an opening-stock transaction.</Form.Text>
                </Form.Group>
              </Col>
            )}

            {models.length > 0 && (
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Compatible Phone Models</Form.Label>
                  <div className="d-flex flex-wrap gap-2 border rounded p-2" style={{ maxHeight: 140, overflowY: 'auto' }}>
                    {models.map((m) => {
                      const active = (form.compatibleModels || []).includes(m._id)
                      return (
                        <Button
                          key={m._id}
                          type="button"
                          size="sm"
                          variant={active ? 'primary' : 'outline-secondary'}
                          onClick={() => toggleModel(m._id)}
                        >
                          {m.name}
                        </Button>
                      )
                    })}
                  </div>
                </Form.Group>
              </Col>
            )}

            <Col md={4}>
              <Form.Group>
                <Form.Label>Supplier</Form.Label>
                <Form.Select value={form.supplier} onChange={set('supplier')}>
                  <option value="">-- None --</option>
                  {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Storage Location</Form.Label>
                <Form.Control value={form.location} onChange={set('location')} placeholder="e.g. Shelf A2" />
              </Form.Group>
            </Col>
            <Col md={12}>
              <Form.Group>
                <Form.Label>Description</Form.Label>
                <Form.Control as="textarea" rows={2} value={form.description} onChange={set('description')} placeholder="e.g. Original iPhone 11 display assembly, AMOLED quality" />
              </Form.Group>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</> : <><i className="bi bi-check-lg me-1" />Save Product</>}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}
