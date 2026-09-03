import { useCallback, useEffect, useState } from 'react'
import { Card, Button, Modal, Form, Row, Col, Alert } from 'react-bootstrap'
import api, { getError } from '../../api/client'
import DataTable from '../../components/common/DataTable'
import StatusBadge from '../../components/common/StatusBadge'
import { formatMoney } from '../../context/LanguageContext'

export default function SupplierPayments() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [purchases, setPurchases] = useState([])
  const [selectedPurchase, setSelectedPurchase] = useState(null)
  const [form, setForm] = useState({ purchaseId: '', amount: '', paymentMethod: 'CASH', reference: '', note: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/supplier-payments', { params: { page, limit: 20 } })
      setPayments(data.data.payments)
      setTotal(data.data.total)
      setPages(data.data.pages)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { load() }, [load])

  const openForm = async () => {
    setError('')
    setForm({ purchaseId: '', amount: '', paymentMethod: 'CASH', reference: '', note: '' })
    setSelectedPurchase(null)
    try {
      const { data } = await api.get('/purchases/supplier-debts', { params: { limit: 100 } })
      setPurchases(data.data.purchases || [])
    } catch {}
    setShowForm(true)
  }

  const onPurchaseSelect = (purchaseId) => {
    const p = purchases.find((x) => x._id === purchaseId)
    setSelectedPurchase(p || null)
    setForm({ ...form, purchaseId, amount: '' })
  }

  const submit = async (ev) => {
    ev.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.post('/supplier-payments', {
        purchaseId: form.purchaseId,
        amount: Number(form.amount),
        paymentMethod: form.paymentMethod,
        reference: form.reference || undefined,
        note: form.note || undefined,
      })
      setShowForm(false)
      load()
    } catch (err) {
      setError(getError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}>
          <i className="bi bi-credit-card me-2" />Supplier Payments <span className="text-muted fs-6">({total})</span>
        </h4>
        <Button onClick={openForm}><i className="bi bi-plus-lg me-1" />Record Payment</Button>
      </div>

      <Card body>
        <DataTable
          columns={[
            { key: 'paymentNumber', label: 'Receipt #', render: (p) => <strong>{p.paymentNumber}</strong> },
            { key: 'date', label: 'Date', render: (p) => new Date(p.date || p.createdAt).toLocaleString() },
            { key: 'purchase', label: 'Purchase', render: (p) => <span className="small">{p.purchase?.purchaseNumber || p.purchaseNumber || '-'}</span> },
            { key: 'supplier', label: 'Supplier', render: (p) => <span className="small">{p.supplier?.name || p.supplierName || '-'}</span> },
            { key: 'amount', label: 'Amount', render: (p) => <strong className="text-success">{formatMoney(p.amount)}</strong> },
            { key: 'previousRemaining', label: 'Was Owing', render: (p) => formatMoney(p.previousRemaining) },
            { key: 'newRemaining', label: 'Now Owing', render: (p) => <strong className={p.newRemaining > 0 ? 'text-danger' : 'text-success'}>{formatMoney(p.newRemaining)}</strong> },
            { key: 'paymentMethod', label: 'Method', render: (p) => <StatusBadge value={p.paymentMethod} /> },
            { key: 'reference', label: 'Ref', render: (p) => p.reference ? <code className="small">{p.reference}</code> : '-' },
            { key: 'receivedBy', label: 'By', render: (p) => <span className="small">{p.receivedBy?.name || '-'}</span> },
          ]}
          data={payments}
          loading={loading}
          page={page}
          pages={pages}
          total={total}
          onPageChange={setPage}
        />
      </Card>

      {/* Record Payment Modal */}
      <Modal show={showForm} onHide={() => !saving && setShowForm(false)} centered backdrop="static">
        <Form onSubmit={submit}>
          <Modal.Header closeButton={!saving}>
            <Modal.Title className="fs-6 fw-bold">Record Supplier Payment</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
            <Row className="g-3">
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Purchase *</Form.Label>
                  <Form.Select value={form.purchaseId} onChange={(e) => onPurchaseSelect(e.target.value)} required>
                    <option value="">Select unpaid purchase...</option>
                    {purchases.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.purchaseNumber} — {p.supplier?.name} — Owing: {formatMoney(p.remainingAmount)}
                      </option>
                    ))}
                  </Form.Select>
                  {purchases.length === 0 && <Form.Text className="text-muted">No unpaid purchases found.</Form.Text>}
                </Form.Group>
              </Col>

              {selectedPurchase && (
                <Col md={12}>
                  <div className="bg-light rounded p-3 small">
                    <Row className="g-2">
                      <Col sm={4}><span className="text-muted">Total:</span> <strong>{formatMoney(selectedPurchase.totalAmount)}</strong></Col>
                      <Col sm={4}><span className="text-muted">Paid:</span> <strong className="text-success">{formatMoney(selectedPurchase.amountPaid)}</strong></Col>
                      <Col sm={4}><span className="text-muted">Remaining:</span> <strong className="text-danger">{formatMoney(selectedPurchase.remainingAmount)}</strong></Col>
                    </Row>
                  </div>
                </Col>
              )}

              <Col md={6}>
                <Form.Group>
                  <Form.Label>Amount (RWF) *</Form.Label>
                  <Form.Control type="number" min="1" max={selectedPurchase?.remainingAmount || undefined} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                  {selectedPurchase && <Form.Text className="text-muted">Max: {formatMoney(selectedPurchase.remainingAmount)}</Form.Text>}
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Payment Method</Form.Label>
                  <Form.Select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                    <option value="CASH">Cash</option>
                    <option value="MOMO">MoMo</option>
                    <option value="BANK">Bank</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Reference</Form.Label>
                  <Form.Control value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Transaction reference" />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Note</Form.Label>
                  <Form.Control value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional note" />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setShowForm(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || !form.purchaseId}>{saving ? 'Recording...' : 'Record Payment'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  )
}
