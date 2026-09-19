import { useState } from 'react'
import { Dropdown, Modal, Form, Button, Alert, Table, Row, Col } from 'react-bootstrap'
import api, { getError } from '../../api/client'
import StatusBadge from '../common/StatusBadge'
import ConfirmDialog from '../common/ConfirmDialog'
import ProductSelect from '../common/ProductSelect'
import { formatMoney } from '../../context/LanguageContext'

const METHODS = [['CASH', 'Cash'], ['MOMO', 'MoMo'], ['BANK', 'Bank']]

export default function LoanItemActions({ loan, item, products = [], payments = [], canRepay = false, canEdit = false, onChanged }) {
  const itemId = item.itemId || item._id
  const loanId = loan._id || loan.itemLoanId
  const loanNumber = loan.loanNumber || item.loanNumber
  const returned = item.returned || item.status === 'RETURNED'

  const [showDetails, setShowDetails] = useState(false)
  const [showPay, setShowPay] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showReturn, setShowReturn] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [payForm, setPayForm] = useState({ amount: '', method: 'CASH', reference: '', date: '', note: '' })
  const [editForm, setEditForm] = useState({ product: String(item.productId || item.product || ''), quantity: item.quantity, price: item.price })

  const itemPayments = (payments || []).filter(
    (p) => p.loanItem && String(p.loanItem) === String(itemId)
  )
  const itemPaid = itemPayments.reduce((s, p) => s + (p.amount || 0), 0)
  const itemRemaining = Math.max(0, item.total - itemPaid)

  const openPay = () => {
    setError('')
    setPayForm({ amount: String(item.outstanding ?? itemRemaining ?? 0), method: 'CASH', reference: '', date: '', note: '' })
    setShowPay(true)
  }
  const openEdit = () => {
    setError('')
    setEditForm({ product: String(item.productId || item.product || ''), quantity: item.quantity, price: item.price })
    setShowEdit(true)
  }

  const doPay = async () => {
    const amount = Number(payForm.amount)
    if (!amount || amount <= 0) return setError('Enter a valid payment amount.')
    if (amount > item.outstanding) return setError(`Amount cannot exceed the remaining balance of ${formatMoney(item.outstanding)}.`)
    setSaving(true)
    setError('')
    try {
      await api.post(`/loans/${loanId}/items/${itemId}/pay`, {
        amount,
        method: payForm.method,
        reference: payForm.reference || undefined,
        date: payForm.date || undefined,
        note: payForm.note || undefined,
      })
      setShowPay(false)
      onChanged?.()
    } catch (err) {
      setError(getError(err))
    } finally {
      setSaving(false)
    }
  }

  const doEdit = async () => {
    const qty = Number(editForm.quantity)
    const price = Number(editForm.price)
    if (!qty || qty <= 0) return setError('Enter a valid quantity.')
    if (price < 0) return setError('Enter a valid price.')
    setSaving(true)
    setError('')
    try {
      await api.patch(`/loans/${loanId}/items/${itemId}`, {
        product: editForm.product || undefined,
        quantity: qty,
        price,
      })
      setShowEdit(false)
      onChanged?.()
    } catch (err) {
      setError(getError(err))
    } finally {
      setSaving(false)
    }
  }

  const doReturn = async () => {
    setSaving(true)
    setError('')
    try {
      await api.post(`/loans/${loanId}/items/${itemId}/return`, { reason: '' })
      setShowReturn(false)
      onChanged?.()
    } catch (err) {
      setError(getError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Dropdown align="end" popperConfig={{ strategy: 'fixed' }}>
        <Dropdown.Toggle variant="light" size="sm" className="py-0 px-1 border no-caret btn-icon-action" title="Actions">
          <i className="bi bi-three-dots" />
        </Dropdown.Toggle>
        <Dropdown.Menu className="shadow-sm">
          <Dropdown.Item onClick={() => setShowDetails(true)}><i className="bi bi-eye me-2" />View Details</Dropdown.Item>
          {!returned && canRepay && (item.outstanding ?? itemRemaining) > 0 && (
            <Dropdown.Item onClick={openPay}><i className="bi bi-cash-stack me-2 text-success" />Record Payment</Dropdown.Item>
          )}
          {!returned && canEdit && (
            <Dropdown.Item onClick={openEdit}><i className="bi bi-pencil me-2" />Edit</Dropdown.Item>
          )}
          {!returned && canEdit && (
            <Dropdown.Item onClick={() => { setError(''); setShowReturn(true) }} className="text-danger">
              <i className="bi bi-arrow-return-left me-2" />Remove / Return Product
            </Dropdown.Item>
          )}
        </Dropdown.Menu>
      </Dropdown>

      {/* Details */}
      <Modal show={showDetails} onHide={() => setShowDetails(false)} centered size="lg">
        <Modal.Header closeButton><Modal.Title className="fs-6 fw-bold"><i className="bi bi-box-seam me-2" />Product Details</Modal.Title></Modal.Header>
        <Modal.Body>
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
            <div>
              <h5 className="mb-0">{item.name}</h5>
              {item.sku && <small className="text-muted">{item.sku}</small>}
            </div>
            <StatusBadge value={item.status || 'UNPAID'} />
          </div>
          <div className="row g-2 small mb-2">
            <div className="col-6 col-md-3"><span className="text-muted d-block">Quantity</span><strong>{item.quantity}</strong></div>
            <div className="col-6 col-md-3"><span className="text-muted d-block">Unit Price</span><strong>{formatMoney(item.price)}</strong></div>
            <div className="col-6 col-md-3"><span className="text-muted d-block">Total</span><strong>{formatMoney(item.total)}</strong></div>
            <div className="col-6 col-md-3"><span className="text-muted d-block">Date</span><strong>{new Date(item.date || Date.now()).toLocaleDateString()}</strong></div>
            <div className="col-6 col-md-3"><span className="text-muted d-block">Amount Paid</span><strong className="text-success">{formatMoney(item.amountPaid)}</strong></div>
            <div className="col-6 col-md-3"><span className="text-muted d-block">Remaining</span><strong className="text-danger">{formatMoney(item.outstanding)}</strong></div>
            <div className="col-6 col-md-3"><span className="text-muted d-block">Loan</span><strong><code>{item.loanNumber || loanNumber || '-'}</code></strong></div>
            {returned && (
              <div className="col-6 col-md-3"><span className="text-muted d-block">Returned On</span><strong>{item.returnedOn ? new Date(item.returnedOn).toLocaleString() : '-'}</strong></div>
            )}
          </div>
          {returned && item.returnReason && (
            <Alert variant="secondary" className="py-2 small"><i className="bi bi-arrow-return-left me-1" />Return reason: {item.returnReason}</Alert>
          )}
          <strong className="small text-uppercase text-muted d-block mb-1">Payment History (this product)</strong>
          <Table size="sm" hover responsive className="mb-0 align-middle">
            <thead><tr><th>Date</th><th className="text-end">Amount</th><th>Method</th><th>Ref</th><th className="text-end">Remaining</th><th>By</th></tr></thead>
            <tbody>
              {itemPayments.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-3">No payments recorded for this product yet.</td></tr>}
              {itemPayments.map((p) => (
                <tr key={p._id}>
                  <td className="small">{new Date(p.date || p.createdAt).toLocaleString()}</td>
                  <td className="text-end fw-semibold text-success">{formatMoney(p.amount)}</td>
                  <td><StatusBadge value={p.method} /></td>
                  <td className="small">{p.reference || '-'}</td>
                  <td className="text-end small">{formatMoney(p.remainingAfter ?? p.newOutstanding)}</td>
                  <td className="small">{p.receivedBy?.name || '-'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Modal.Body>
        <Modal.Footer>
          {!returned && canRepay && (item.outstanding ?? itemRemaining) > 0 && (
            <Button variant="success" onClick={() => { setShowDetails(false); openPay() }}><i className="bi bi-cash-stack me-1" />Record Payment</Button>
          )}
          <Button variant="light" onClick={() => setShowDetails(false)}>Close</Button>
        </Modal.Footer>
      </Modal>

      {/* Record Payment */}
      <Modal show={showPay} onHide={() => setShowPay(false)} centered backdrop="static">
        <Form onSubmit={(e) => { e.preventDefault(); doPay() }}>
          <Modal.Header closeButton={!saving}><Modal.Title className="fs-6 fw-bold"><i className="bi bi-cash-stack me-2 text-success" />Record Payment — {item.name}</Modal.Title></Modal.Header>
          <Modal.Body>
            {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
            <Alert variant="info" className="py-2 small">Remaining: <strong>{formatMoney(item.outstanding)}</strong></Alert>
            <Form.Group className="mb-2">
              <Form.Label className="small fw-semibold">Payment Amount (RWF) *</Form.Label>
              <Form.Control type="number" min="1" max={item.outstanding} value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} required autoFocus />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label className="small fw-semibold">Payment Method *</Form.Label>
              <Form.Select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
                {METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label className="small fw-semibold">Payment Date</Form.Label>
              <Form.Control type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} />
            </Form.Group>
            {(payForm.method === 'MOMO' || payForm.method === 'BANK') && (
              <Form.Group className="mb-2">
                <Form.Label className="small fw-semibold">Transaction Reference (optional)</Form.Label>
                <Form.Control value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} placeholder={payForm.method === 'MOMO' ? 'MoMo TXN ID' : 'Bank slip no.'} />
              </Form.Group>
            )}
            <Form.Group>
              <Form.Label className="small">Notes</Form.Label>
              <Form.Control as="textarea" rows={2} value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" type="button" onClick={() => setShowPay(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="success" disabled={saving}>
              {saving && <span className="spinner-border spinner-border-sm me-1" />}
              Confirm Payment
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Edit */}
      <Modal show={showEdit} onHide={() => setShowEdit(false)} centered backdrop="static">
        <Form onSubmit={(e) => { e.preventDefault(); doEdit() }}>
          <Modal.Header closeButton={!saving}><Modal.Title className="fs-6 fw-bold"><i className="bi bi-pencil me-2" />Edit Loan Product</Modal.Title></Modal.Header>
          <Modal.Body>
            {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
            <Alert variant="warning" className="py-2 small"><i className="bi bi-info-circle me-1" />Stock will be adjusted automatically when you change the product or quantity.</Alert>
            <Form.Group className="mb-2">
              <Form.Label className="small fw-semibold">Product</Form.Label>
              <ProductSelect products={products} value={editForm.product} onChange={(id) => {
                const p = products.find((x) => x._id === id)
                setEditForm((f) => ({ ...f, product: id, price: p ? p.sellingPrice : f.price }))
              }} />
            </Form.Group>
            <RowCombo editForm={editForm} setEditForm={setEditForm} />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" type="button" onClick={() => setShowEdit(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</> : 'Save Changes'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Return / Remove */}
      <ConfirmDialog
        show={showReturn}
        title="Remove / Return Product"
        confirmLabel="Return Product"
        loading={saving}
        onClose={() => setShowReturn(false)}
        onConfirm={doReturn}
      >
        <p className="small mb-2">
          Return <strong>{item.name}</strong> (×{item.quantity}, {formatMoney(item.total)})?
        </p>
        <p className="small text-muted mb-0">
          Only this product will be removed from the loan. Other products and the payment history are preserved. Stock will be restored automatically.
        </p>
      </ConfirmDialog>
    </>
  )
}

function RowCombo({ editForm, setEditForm }) {
  return (
    <Row>
      <Col md={6}>
        <Form.Group>
          <Form.Label className="small fw-semibold">Quantity *</Form.Label>
          <Form.Control type="number" min="1" value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} />
        </Form.Group>
      </Col>
      <Col md={6}>
        <Form.Group>
          <Form.Label className="small fw-semibold">Unit Price (RWF) *</Form.Label>
          <Form.Control type="number" min="0" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} />
        </Form.Group>
      </Col>
    </Row>
  )
}