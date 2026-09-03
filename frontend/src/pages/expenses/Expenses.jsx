import { useCallback, useEffect, useState } from 'react'
import { Card, Button, Modal, Form, Row, Col, Alert } from 'react-bootstrap'
import api, { getError } from '../../api/client'
import DataTable from '../../components/common/DataTable'
import StatusBadge from '../../components/common/StatusBadge'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { useAuth } from '../../context/AuthContext'
import { formatMoney } from '../../context/LanguageContext'

const EXPENSE_CATEGORIES = [
  'Transport', 'Rent', 'Food', 'Electricity', 'Water', 'Salaries',
  'Maintenance', 'Airtime', 'Internet', 'Shop Expenses', 'Packaging',
  'Delivery', 'Repair Tools', 'Other'
]

const empty = { title: '', category: 'Other', amount: '', paymentMethod: 'CASH', date: new Date().toISOString().slice(0, 10), description: '' }

export default function Expenses() {
  const [expenses, setExpenses] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [category, setCategory] = useState('ALL')
  const [method, setMethod] = useState('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const { hasPermission } = useAuth()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 20 }
      if (category !== 'ALL') params.category = category
      if (method !== 'ALL') params.paymentMethod = method
      if (from) params.from = from
      if (to) params.to = to
      const { data } = await api.get('/expenses', { params })
      setExpenses(data.data.expenses)
      setTotal(data.data.total)
      setPages(data.data.pages)
    } finally {
      setLoading(false)
    }
  }, [page, category, method, from, to])

  const loadSummary = useCallback(async () => {
    try {
      const { data } = await api.get('/expenses/summary')
      setSummary(data.data)
    } catch {}
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadSummary() }, [loadSummary])

  const openForm = (e) => {
    setError('')
    setEditing(e || null)
    if (e) {
      setForm({
        title: e.title,
        category: e.category,
        amount: e.amount,
        paymentMethod: e.paymentMethod || 'CASH',
        date: e.date ? new Date(e.date).toISOString().slice(0, 10) : '',
        description: e.description || ''
      })
    } else {
      setForm(empty)
    }
    setShowForm(true)
  }

  const submit = async (ev) => {
    ev.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = { ...form, amount: Number(form.amount) }
      if (editing) await api.put(`/expenses/${editing._id}`, payload)
      else await api.post('/expenses', payload)
      setShowForm(false)
      load()
      loadSummary()
    } catch (err) {
      setError(getError(err))
    } finally {
      setSaving(false)
    }
  }

  const doDelete = async () => {
    if (!confirmDel) return
    setDeleting(true)
    try {
      await api.delete(`/expenses/${confirmDel._id}`)
      setConfirmDel(null)
      load()
      loadSummary()
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
          <i className="bi bi-wallet2 me-2" />Expenses <span className="text-muted fs-6">({total})</span>
        </h4>
        {hasPermission('expenses.create') && (
          <Button onClick={() => openForm(null)}><i className="bi bi-plus-lg me-1" />Add Expense</Button>
        )}
      </div>

      {summary && (
        <Row className="g-2 g-md-3 mb-3">
          <Col xs={12} sm={4}>
            <Card className="border-0 shadow-sm" style={{ background: 'linear-gradient(135deg,#c0392b 0%,#e74c3c 100%)' }}>
              <Card.Body className="p-3 text-white">
                <div className="d-flex align-items-center gap-2 mb-1">
                  <i className="bi bi-calendar-day fs-5" />
                  <small className="opacity-75">Today</small>
                </div>
                <div className="fs-5 fw-bold">{formatMoney(summary.today)}</div>
              </Card.Body>
            </Card>
          </Col>
          <Col xs={12} sm={4}>
            <Card className="border-0 shadow-sm" style={{ background: 'linear-gradient(135deg,#e67e22 0%,#f39c12 100%)' }}>
              <Card.Body className="p-3 text-white">
                <div className="d-flex align-items-center gap-2 mb-1">
                  <i className="bi bi-calendar-week fs-5" />
                  <small className="opacity-75">This Week</small>
                </div>
                <div className="fs-5 fw-bold">{formatMoney(summary.thisWeek)}</div>
              </Card.Body>
            </Card>
          </Col>
          <Col xs={12} sm={4}>
            <Card className="border-0 shadow-sm" style={{ background: 'linear-gradient(135deg,#8e44ad 0%,#9b59b6 100%)' }}>
              <Card.Body className="p-3 text-white">
                <div className="d-flex align-items-center gap-2 mb-1">
                  <i className="bi bi-calendar-month fs-5" />
                  <small className="opacity-75">This Month</small>
                </div>
                <div className="fs-5 fw-bold">{formatMoney(summary.thisMonth)}</div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      <Card body>
        {error && <Alert variant="danger" dismissible onClose={() => setError('')} className="py-2 small mb-3">{error}</Alert>}

        <div className="d-flex flex-wrap gap-2 mb-3">
          <Form.Select size="sm" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }} style={{ maxWidth: 160 }}>
            <option value="ALL">All Categories</option>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Form.Select>
          <Form.Select size="sm" value={method} onChange={(e) => { setMethod(e.target.value); setPage(1) }} style={{ maxWidth: 140 }}>
            <option value="ALL">All Methods</option>
            <option value="CASH">Cash</option>
            <option value="MOMO">MoMo</option>
            <option value="BANK">Bank</option>
          </Form.Select>
          <Form.Control size="sm" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} style={{ maxWidth: 155 }} />
          <Form.Control size="sm" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} style={{ maxWidth: 155 }} />
        </div>

        <DataTable
          columns={[
            { key: 'title', label: 'Title', render: (e) => <strong>{e.title}</strong> },
            { key: 'category', label: 'Category', render: (e) => <span className="badge badge-soft-primary">{e.category}</span> },
            { key: 'amount', label: 'Amount', render: (e) => <strong className="text-danger">{formatMoney(e.amount)}</strong> },
            { key: 'paymentMethod', label: 'Method', render: (e) => <StatusBadge value={e.paymentMethod} /> },
            { key: 'date', label: 'Date', render: (e) => new Date(e.date).toLocaleDateString() },
            { key: 'createdBy', label: 'Recorded By', render: (e) => <span className="small">{e.createdBy?.name || '-'}</span> },
            { key: 'actions', label: 'Actions', render: (e) => (
              <div className="d-flex gap-1">
                {hasPermission('expenses.update') && (
                  <Button size="sm" variant="light" className="border" onClick={() => openForm(e)}><i className="bi bi-pencil" /></Button>
                )}
                {hasPermission('expenses.delete') && (
                  <Button size="sm" variant="outline-danger" onClick={() => setConfirmDel(e)}><i className="bi bi-trash" /></Button>
                )}
              </div>
            )}
          ]}
          data={expenses}
          loading={loading}
          page={page}
          pages={pages}
          total={total}
          onPageChange={setPage}
        />
      </Card>

      {/* Add/Edit Modal */}
      <Modal show={showForm} onHide={() => !saving && setShowForm(false)} centered backdrop="static">
        <Form onSubmit={submit}>
          <Modal.Header closeButton={!saving}>
            <Modal.Title className="fs-6 fw-bold">{editing ? 'Edit Expense' : 'Add Expense'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
            <Row className="g-3">
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Title *</Form.Label>
                  <Form.Control value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Transport to supplier" />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Category *</Form.Label>
                  <Form.Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
                    {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Amount (RWF) *</Form.Label>
                  <Form.Control type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
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
                  <Form.Label>Date</Form.Label>
                  <Form.Control type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Description</Form.Label>
                  <Form.Control as="textarea" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional notes..." />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setShowForm(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <ConfirmDialog
        show={Boolean(confirmDel)}
        onClose={() => setConfirmDel(null)}
        title="Delete Expense"
        message={`Delete expense "${confirmDel?.title}" (${formatMoney(confirmDel?.amount)})? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={doDelete}
      />
    </div>
  )
}
