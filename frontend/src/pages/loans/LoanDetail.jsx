import { useEffect, useState } from 'react'
import { Card, Row, Col, Table, Button, Form, Alert, Modal } from 'react-bootstrap'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api, { getError } from '../../api/client'
import StatusBadge from '../../components/common/StatusBadge'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import Loading from '../../components/common/Loading'
import { formatMoney } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'

export default function LoanDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [data, setData] = useState(null)
  const [company, setCompany] = useState(null)
  const [showRepay, setShowRepay] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [showDueDate, setShowDueDate] = useState(false)
  const [form, setForm] = useState({ amount: '', method: 'CASH', reference: '', notes: '' })
  const [cancelReason, setCancelReason] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => {
    api.get(`/loans/${id}`).then((r) => {
      setData(r.data.data)
      api.get('/settings').then((s) => {
        const c = s.data.data || {}
        setCompany({
          name: c.companyName || 'Nsenga Legacy Electronic',
          slogan: c.slogan || '',
          phone: c.companyPhone || '',
          email: c.companyEmail || '',
          address: c.companyAddress || 'Kigali, Rwanda',
          tin: c.companyTin || '',
          logoUrl: c.logoUrl || '/company-logo.png',
          footerNote: c.invoiceFooterNote || 'Thank you for your business!'
        })
      }).catch(() => {})
    }).catch(() => navigate('/loans'))
  }
  useEffect(load, [id, navigate])

  if (!data) return <Loading full />
  const { loan, repayments, sale } = data
  const canRepay = hasPermission('payments.create') || hasPermission('loans.update')

  const startRepay = () => {
    setForm({ amount: loan.outstanding.toString(), method: 'CASH', reference: '', notes: '' })
    setError('')
    setShowRepay(true)
  }

  const proceedToConfirm = (e) => {
    e.preventDefault()
    const amount = Number(form.amount)
    if (!amount || amount <= 0) return setError('Enter a valid amount.')
    if (amount > loan.outstanding) return setError(`Amount cannot exceed the outstanding balance of ${formatMoney(loan.outstanding)}.`)
    setShowRepay(false)
    setShowConfirm(true)
  }

  const doRepay = async () => {
    setSaving(true)
    try {
      await api.post(`/payments/loans/${loan._id}/repay`, {
        amount: Number(form.amount),
        method: form.method,
        reference: form.reference || undefined,
        note: form.notes || undefined
      })
      setShowConfirm(false)
      load()
    } catch (err) {
      setError(getError(err))
      setShowConfirm(false)
      setShowRepay(true)
    } finally {
      setSaving(false)
    }
  }

  const doCancelLoan = async () => {
    setSaving(true)
    try {
      await api.delete(`/loans/${loan._id}`)
      setShowCancel(false)
      load()
    } catch (err) {
      alert(getError(err))
    } finally {
      setSaving(false)
    }
  }

  const saveDueDate = async () => {
    setSaving(true)
    try {
      await api.put(`/loans/${loan._id}`, { dueDate: newDueDate })
      setShowDueDate(false)
      load()
    } catch (err) {
      alert(getError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}>
          <i className="bi bi-cash-coin me-2" />{loan.loanNumber} <StatusBadge value={loan.status} />
        </h4>
        <div className="d-flex gap-2 no-print">
          <Button variant="primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />Print</Button>
          <Button variant="light" className="border" onClick={() => navigate('/loans')}><i className="bi bi-arrow-left me-1" />Back</Button>
          {canRepay && !['PAID', 'CANCELLED'].includes(loan.status) && (
            <Button variant="success" onClick={startRepay}><i className="bi bi-cash-stack me-1" />Record Repayment</Button>
          )}
          {hasPermission('loans.update') && !['PAID', 'CANCELLED'].includes(loan.status) && (
            <Button variant="outline-primary" onClick={() => { setNewDueDate(loan.dueDate?.slice(0, 10) || ''); setShowDueDate(true) }}>
              <i className="bi bi-calendar-event me-1" />Due Date
            </Button>
          )}
          {hasPermission('loans.cancel') && !['PAID', 'CANCELLED'].includes(loan.status) && (
            <Button variant="outline-danger" onClick={() => setShowCancel(true)}><i className="bi bi-x-circle me-1" />Cancel Loan</Button>
          )}
        </div>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')} className="py-2 small">{error}</Alert>}

      <Row className="g-3 mb-3">
        <Col md={3}><Card body className="text-center"><div className="text-muted small">Total Amount</div><div className="fs-5 fw-bold">{formatMoney(loan.totalAmount)}</div></Card></Col>
        <Col md={3}><Card body className="text-center"><div className="text-muted small">Amount Paid</div><div className="fs-5 fw-bold text-success">{formatMoney(loan.amountPaid)}</div></Card></Col>
        <Col md={3}><Card body className="text-center bg-light"><div className="text-muted small">Outstanding Balance</div><div className={`fs-5 fw-bold ${loan.outstanding > 0 ? 'text-danger' : 'text-success'}`}>{formatMoney(loan.outstanding)}</div></Card></Col>
        <Col md={3}><Card body className="text-center"><div className="text-muted small">Due Date</div><div className={`fs-6 fw-bold ${new Date(loan.dueDate) < new Date() && !['PAID', 'CANCELLED'].includes(loan.status) ? 'text-danger' : ''}`}>{loan.dueDate ? new Date(loan.dueDate).toLocaleDateString() : '-'}</div></Card></Col>
      </Row>

      <Row className="g-3">
        <Col lg={7}>
          <Card className="mb-3">
            <Card.Header className="bg-white fw-semibold small"><i className="bi bi-box-seam me-2 text-primary" />Products Purchased</Card.Header>
            <Table size="sm" responsive className="mb-0 align-middle">
              <thead><tr><th>Product</th><th className="text-center">Qty</th><th className="text-end">Unit Price</th></tr></thead>
              <tbody>
                {(!sale?.items || sale.items.length === 0) && (
                  <tr><td colSpan={3} className="text-center text-muted py-3">No product details available</td></tr>
                )}
                {(sale?.items || []).map((item, i) => (
                  <tr key={i}>
                    <td>{item.name}</td>
                    <td className="text-center">{item.quantity}</td>
                    <td className="text-end">{formatMoney(item.price)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <Card>
            <Card.Header className="bg-white fw-semibold small"><i className="bi bi-clock-history me-2 text-success" />Repayment History ({repayments.length})</Card.Header>
            <Table size="sm" hover responsive className="mb-0 align-middle">
              <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Ref</th><th>Received By</th></tr></thead>
              <tbody>
                {repayments.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-3">No repayments yet</td></tr>}
                {repayments.map((p) => (
                  <tr key={p._id}>
                    <td className="small">{new Date(p.date || p.createdAt).toLocaleString()}</td>
                    <td className="fw-semibold text-success">{formatMoney(p.amount)}</td>
                    <td><StatusBadge value={p.method} /></td>
                    <td className="small">{p.reference || '-'}</td>
                    <td className="small">{p.receivedBy?.name}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </Col>

        <Col lg={5}>
          <Card>
            <Card.Header className="bg-white fw-semibold small">Customer & Sale Information</Card.Header>
            <Card.Body className="py-1">
              <div className="d-flex justify-content-between border-bottom py-2">
                <span className="text-muted small">Customer</span>
                <span className="small fw-semibold">{loan.customerName}</span>
              </div>
              <div className="d-flex justify-content-between border-bottom py-2">
                <span className="text-muted small">Phone</span>
                <span className="small"><code>{loan.customerPhone}</code></span>
              </div>
              <div className="d-flex justify-content-between border-bottom py-2">
                <span className="text-muted small">Linked Sale</span>
                <Link to={`/sales/${sale?._id || ''}`} className="small fw-semibold">{sale?.saleNumber || '-'}</Link>
              </div>
              <div className="d-flex justify-content-between border-bottom py-2">
                <span className="text-muted small">Loan Date</span>
                <span className="small">{new Date(loan.date || loan.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="d-flex justify-content-between border-bottom py-2">
                <span className="text-muted small">Created By</span>
                <span className="small">{loan.createdBy?.name || sale?.cashier?.name || '-'}</span>
              </div>
              {loan.cancelReason && (
                <div className="d-flex justify-content-between py-2">
                  <span className="text-muted small">Cancel Reason</span>
                  <span className="small fst-italic">{loan.cancelReason}</span>
                </div>
              )}
            </Card.Body>
          </Card>

          {sale && (
            <Card body className="mt-3 small text-muted">
              <strong className="text-dark d-block mb-1">Original sale summary</strong>
              Total: {formatMoney(sale.total)} · Paid on sale: {formatMoney(sale.amountPaid)} · Method: {sale.paymentMethod}
            </Card>
          )}
        </Col>
      </Row>

      {/* Repayment entry */}
      <Modal show={showRepay} onHide={() => !saving && setShowRepay(false)} centered backdrop="static">
        <Form onSubmit={proceedToConfirm}>
          <Modal.Header closeButton={!saving}><Modal.Title className="fs-6 fw-bold">Record Repayment — {loan.loanNumber}</Modal.Title></Modal.Header>
          <Modal.Body>
            <Alert variant="info" className="py-2 small">
              Outstanding balance: <strong>{formatMoney(loan.outstanding)}</strong>
            </Alert>
            <Form.Group className="mb-2">
              <Form.Label className="small fw-semibold">Payment Amount (RWF) *</Form.Label>
              <Form.Control type="number" min="1" max={loan.outstanding} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required autoFocus />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label className="small fw-semibold">Method *</Form.Label>
              <Form.Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                <option value="CASH">Cash</option>
                <option value="MOMO">MoMo</option>
                <option value="BANK">Bank</option>
              </Form.Select>
            </Form.Group>
            {(form.method === 'MOMO' || form.method === 'BANK') && (
              <Form.Group className="mb-2">
                <Form.Label className="small fw-semibold">Transaction Reference (optional)</Form.Label>
                <Form.Control value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder={form.method === 'MOMO' ? 'MoMo TXN ID' : 'Bank slip no.'} />
              </Form.Group>
            )}
            <Form.Group>
              <Form.Label className="small">Notes</Form.Label>
              <Form.Control as="textarea" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" type="button" onClick={() => setShowRepay(false)}>Cancel</Button>
            <Button type="submit">Continue</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Repayment confirmation */}
      <ConfirmDialog
        show={showConfirm}
        title="Confirm Loan Repayment"
        confirmLabel="Confirm Payment"
        loading={saving}
        onClose={() => setShowConfirm(false)}
        onConfirm={doRepay}
      >
        <table className="table table-sm small mb-0">
          <tbody>
            <tr><td>Customer</td><td className="text-end fw-semibold">{loan.customerName} ({loan.customerPhone})</td></tr>
            <tr><td>Previous Balance</td><td className="text-end">{formatMoney(loan.outstanding)}</td></tr>
            <tr><td>Payment</td><td className="text-end fw-bold text-success">{formatMoney(Number(form.amount))} ({form.method})</td></tr>
            <tr className="table-warning"><td><strong>Remaining</strong></td><td className="text-end fw-bold text-danger">{formatMoney(Math.max(0, loan.outstanding - Number(form.amount || 0)))}</td></tr>
          </tbody>
        </table>
      </ConfirmDialog>

      {/* Cancel loan */}
      <ConfirmDialog
        show={showCancel}
        title="Cancel Loan"
        message={`Cancel ${loan.loanNumber}? The remaining ${formatMoney(loan.outstanding)} will be written off. Payment history is preserved.`}
        confirmLabel="Cancel Loan"
        loading={saving}
        onClose={() => setShowCancel(false)}
        onConfirm={doCancelLoan}
      >
        <Form.Control as="textarea" rows={2} placeholder="Reason (required)" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
      </ConfirmDialog>

      {/* Due date */}
      <Modal show={showDueDate} onHide={() => setShowDueDate(false)} centered>
        <Modal.Header closeButton><Modal.Title className="fs-6 fw-bold">Update Due Date</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label className="small fw-semibold">New Due Date</Form.Label>
            <Form.Control type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowDueDate(false)}>Cancel</Button>
          <Button onClick={saveDueDate} disabled={saving || !newDueDate}>Save</Button>
        </Modal.Footer>
      </Modal>

      {/* Printable loan document */}
      <Card className="invoice-sheet shadow-sm mt-4">
        <div className="d-flex justify-content-between align-items-start border-bottom pb-3 mb-3">
          <div className="d-flex gap-3">
            {company && <img src={company.logoUrl} alt="" style={{ width: 64 }} />}
            <div>
              <h5 className="fw-bold mb-0" style={{ color: '#0d3b66' }}>{company?.name}</h5>
              {company?.slogan && <small className="text-muted d-block">{company.slogan}</small>}
              <small className="text-muted d-block"><i className="bi bi-geo-alt me-1" />{company?.address}</small>
              {company?.phone && <small className="text-muted d-block"><i className="bi bi-telephone me-1" />{company.phone}</small>}
              {company?.email && <small className="text-muted d-block"><i className="bi bi-envelope me-1" />{company.email}</small>}
              {company?.tin && <small className="text-muted d-block"><i className="bi bi-file-earmark-text me-1" />TIN: {company.tin}</small>}
            </div>
          </div>
          <div className="text-end">
            <h4 className="fw-bold mb-0">LOAN AGREEMENT</h4>
            <div className="small"><strong>{loan.loanNumber}</strong></div>
            <div className="small text-muted">{new Date(loan.date || loan.createdAt).toLocaleDateString()}</div>
            <div className="mt-2"><StatusBadge value={loan.status} /></div>
          </div>
        </div>

        <div className="row mb-4">
          <div className="col-6">
            <strong className="small text-uppercase text-muted d-block mb-1">Borrower</strong>
            <div className="fw-semibold">{loan.customer?.name || loan.customerName}</div>
            {loan.customerPhone && <div className="small text-muted">{loan.customerPhone}</div>}
            {loan.customer?.phone && <div className="small text-muted">{loan.customer.phone}</div>}
            {loan.customer?.address && <div className="small text-muted">{loan.customer.address}</div>}
          </div>
          <div className="col-6 text-end">
            <div className="small"><span className="text-muted">Linked Sale:</span> <strong>{sale?.saleNumber || '-'}</strong></div>
            {sale?.cashier?.name && <div className="small"><span className="text-muted">Cashier:</span> <strong>{sale.cashier.name}</strong></div>}
            {sale?.paymentMethod && <div className="small"><span className="text-muted">Sale Payment:</span> <StatusBadge value={sale.paymentMethod} /></div>}
            {sale?.reference && <div className="small"><span className="text-muted">Ref:</span> {sale.reference}</div>}
          </div>
        </div>

        <strong className="small text-uppercase text-muted d-block mb-1">Products</strong>
        <table className="table table-sm table-bordered">
          <thead style={{ background: '#f8f9fb' }}>
            <tr>
              <th>#</th><th>Product</th>
              <th className="text-center">Qty</th><th className="text-end">Unit Price</th>
              <th className="text-end">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {(!sale?.items || sale.items.length === 0) && (
              <tr><td colSpan={5} className="text-center text-muted py-3">No product details available</td></tr>
            )}
            {(sale?.items || []).map((item, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{item.name}{item.sku && <span className="text-muted small"> · {item.sku}</span>}</td>
                <td className="text-center">{item.quantity}</td>
                <td className="text-end">{formatMoney(item.price)}</td>
                <td className="text-end fw-semibold">{formatMoney(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="row justify-content-end mb-4">
          <div className="col-md-5">
            <table className="table table-sm">
              <tbody>
                <tr><td>Loan Amount</td><td className="text-end">{formatMoney(loan.totalAmount)}</td></tr>
                <tr><td>Amount Paid</td><td className="text-end text-success">{formatMoney(loan.amountPaid)}</td></tr>
                <tr className="table-warning fs-6 fw-bold">
                  <td>Outstanding Balance</td>
                  <td className="text-end text-danger">{formatMoney(loan.outstanding)}</td>
                </tr>
                <tr><td>Due Date</td><td className="text-end">{loan.dueDate ? new Date(loan.dueDate).toLocaleDateString() : '-'}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <strong className="small text-uppercase text-muted d-block mb-1">Repayment History</strong>
        <table className="table table-sm table-bordered">
          <thead style={{ background: '#f8f9fb' }}>
            <tr><th>Date</th><th>Amount</th><th>Method</th><th>Received By</th></tr>
          </thead>
          <tbody>
            {repayments.length === 0 && <tr><td colSpan={4} className="text-center text-muted py-3">No repayments yet</td></tr>}
            {repayments.map((p) => (
              <tr key={p._id}>
                <td className="small">{new Date(p.date || p.createdAt).toLocaleString()}</td>
                <td className="fw-semibold text-success">{formatMoney(p.amount)}</td>
                <td><StatusBadge value={p.method} /></td>
                <td className="small">{p.receivedBy?.name}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="row mt-5 pt-4 border-top">
          <div className="col-6 text-center"><div className="border-top pt-1 small">Borrower Signature</div></div>
          <div className="col-6 text-center"><div className="border-top pt-1 small">Authorized Signature</div></div>
        </div>

        <div className="border-top mt-4 pt-3 text-center text-muted small">
          {company?.footerNote}
        </div>
      </Card>
    </div>
  )
}
