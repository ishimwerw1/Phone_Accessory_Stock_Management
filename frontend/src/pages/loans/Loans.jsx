import { useCallback, useEffect, useState } from 'react'
import { Card, Row, Col, Form, Button, Badge, Dropdown, Modal } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'
import api, { getError } from '../../api/client'
import DataTable from '../../components/common/DataTable'
import StatusBadge from '../../components/common/StatusBadge'
import StatCard from '../../components/common/StatCard'
import { formatMoney } from '../../context/LanguageContext'

export default function Loans() {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [editAccount, setEditAccount] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', phone: '', email: '', address: '' })
  const [savingEdit, setSavingEdit] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 15 }
      if (search) params.search = search
      if (status !== 'ALL') params.status = status
      if (from) params.from = from
      if (to) params.to = to
      const [accRes, statRes] = await Promise.all([
        api.get('/loans/accounts', { params }),
        api.get('/loans/stats')
      ])
      setAccounts(accRes.data.data.accounts)
      setStats(statRes.data.data)
      setPages(Math.ceil(accRes.data.data.total / 15) || 1)
      setTotal(accRes.data.data.total)
    } finally {
      setLoading(false)
    }
  }, [page, search, status, from, to])

  useEffect(() => { load() }, [load])

  const openEdit = (a) => {
    setEditAccount(a)
    setEditForm({ name: a.customerName || '', phone: a.customerPhone || '', email: '', address: '' })
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    if (!editAccount?.customer) return
    if (!editForm.name.trim() || !editForm.phone.trim()) return
    setSavingEdit(true)
    try {
      await api.put(`/customers/${editAccount.customer}`, editForm)
      setEditAccount(null)
      load()
    } catch (err) {
      alert(getError(err))
    } finally {
      setSavingEdit(false)
    }
  }

  const accountUrl = (a) => `/loans/accounts/${a.customer || 'void'}`

  const actionsMenu = (a) => (
    <Dropdown align="end" popperConfig={{ strategy: 'fixed' }}>
      <Dropdown.Toggle variant="light" size="sm" className="py-0 px-1 border no-caret btn-icon-action" title="Actions">
        <i className="bi bi-three-dots" />
      </Dropdown.Toggle>
      <Dropdown.Menu className="shadow-sm">
        <Dropdown.Item onClick={() => navigate(accountUrl(a))}><i className="bi bi-cash-coin me-2" />View Loan Details</Dropdown.Item>
        <Dropdown.Item onClick={() => navigate(`${accountUrl(a)}?tab=products`)}><i className="bi bi-box-seam me-2" />View All Products</Dropdown.Item>
        <Dropdown.Item onClick={() => navigate(`${accountUrl(a)}?tab=paid`)}><i className="bi bi-check-circle me-2" />View Paid Products</Dropdown.Item>
        <Dropdown.Item onClick={() => navigate(`${accountUrl(a)}?tab=unpaid`)}><i className="bi bi-exclamation-circle me-2" />View Unpaid Products</Dropdown.Item>
        <Dropdown.Item onClick={() => navigate(`${accountUrl(a)}?tab=payments`)}><i className="bi bi-clock-history me-2" />Payment History</Dropdown.Item>
        <Dropdown.Divider />
        {a.customer && <Dropdown.Item onClick={() => openEdit(a)}><i className="bi bi-person-gear me-2" />Edit Customer</Dropdown.Item>}
        <Dropdown.Item onClick={() => navigate(`${accountUrl(a)}?print=1`)}><i className="bi bi-printer me-2" />Print Loan Invoice</Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  )

  return (
    <div>
      <h4 className="fw-bold mb-3" style={{ color: '#0d3b66' }}>
        <i className="bi bi-cash-coin me-2" />Loans / Credit Management <span className="text-muted fs-6">({total} {total === 1 ? 'customer' : 'customers'})</span>
      </h4>

      {stats && (
        <Row className="g-3 mb-4">
          <Col xl={3} md={6}><StatCard icon="bi-clipboard-data" label="Total Loans" value={formatMoney(stats.totalCredit)} color="primary" sub={`${stats.totalLoans} loans total`} /></Col>
          <Col xl={3} md={6}><StatCard icon="bi-cash-coin" label="Amount Loaned" value={formatMoney(stats.totalCredit)} color="info" sub={`of which ${stats.active + stats.overdue} still open`} /></Col>
          <Col xl={3} md={6}><StatCard icon="bi-check-circle" label="Amount Paid" value={formatMoney(stats.totalRepaid)} color="success" sub={`${stats.paid} fully paid · ${stats.partial} partial`} /></Col>
          <Col xl={3} md={6}><StatCard icon="bi-exclamation-triangle" label="Remaining Debt" value={formatMoney(stats.totalOutstanding)} color="danger" sub={`${stats.active + stats.overdue} open loans`} /></Col>
        </Row>
      )}

      <Card body>
        <div className="d-flex flex-wrap gap-2 mb-3 filter-toolbar">
          <Form.Control size="sm" placeholder="Search customer name or phone..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} style={{ maxWidth: 280 }} />
          <Form.Select size="sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} style={{ maxWidth: 170 }}>
            {['ALL', 'ACTIVE', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'].map((s) => (
              <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s.replace(/_/g, ' ')}</option>
            ))}
          </Form.Select>
          <Form.Control size="sm" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} style={{ maxWidth: 155 }} />
          <Form.Control size="sm" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} style={{ maxWidth: 155 }} />
          {(search || status !== 'ALL' || from || to) && (
            <Button size="sm" variant="outline-secondary" onClick={() => { setSearch(''); setStatus('ALL'); setFrom(''); setTo(''); setPage(1) }}>
              <i className="bi bi-x-circle me-1" />Clear
            </Button>
          )}
        </div>

        <DataTable
          columns={[
            { key: 'customerName', label: 'Customer', render: (a) => (
              <div className="fw-semibold small" style={{ color: '#0d3b66' }}>{a.customerName || '-'}</div>
            )},
            { key: 'customerPhone', label: 'Phone', render: (a) => <code className="small">{a.customerPhone || '-'}</code> },
            { key: 'transactionCount', label: 'Loan Transactions', render: (a) => (
              <span className="badge rounded-pill text-bg-light border">{a.transactionCount}</span>
            )},
            { key: 'totalDebt', label: 'Total Debt', render: (a) => formatMoney(a.totalDebt) },
            { key: 'totalPaid', label: 'Total Paid', render: (a) => <span className="text-success fw-semibold">{formatMoney(a.totalPaid)}</span> },
            { key: 'remainingBalance', label: 'Remaining Balance', render: (a) => (
              <strong className={a.remainingBalance > 0 ? 'text-danger' : 'text-success'}>{formatMoney(a.remainingBalance)}</strong>
            )},
            { key: 'status', label: 'Status', render: (a) => <StatusBadge value={a.status} /> },
            { key: 'actions', label: '', render: (a) => actionsMenu(a) }
          ]}
          data={accounts}
          loading={loading}
          page={page}
          pages={pages}
          total={total}
          onPageChange={setPage}
        />
      </Card>

      {stats && stats.overdue > 0 && status === 'ALL' && (
        <>
          <h5 className="fw-bold mt-4 mb-2"><Badge bg="" className="badge-soft-danger">OVERDUE</Badge> Customers with overdue loans</h5>
          <Card body>
            <div className="table-responsive">
              <table className="table table-hover table-sm align-middle bg-white mb-0">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th className="text-end">Remaining</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {accounts.filter((a) => a.status === 'OVERDUE').length === 0 && (
                    <tr><td colSpan={4} className="text-center text-muted py-3">No overdue customers</td></tr>
                  )}
                  {accounts.filter((a) => a.status === 'OVERDUE').map((a) => (
                    <tr key={a.customer || a.customerName}>
                      <td className="fw-medium small">{a.customerName}</td>
                      <td><code className="small">{a.customerPhone}</code></td>
                      <td className="text-end fw-bold text-danger">{formatMoney(a.remainingBalance)}</td>
                      <td className="text-end">{actionsMenu(a)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <Modal show={!!editAccount} onHide={() => !savingEdit && setEditAccount(null)} centered>
        <Form onSubmit={saveEdit}>
          <Modal.Header closeButton={!savingEdit}><Modal.Title className="fs-6 fw-bold"><i className="bi bi-person-gear me-2" />Edit Customer</Modal.Title></Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-2">
              <Form.Label className="small fw-semibold">Customer Name *</Form.Label>
              <Form.Control value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label className="small fw-semibold">Phone *</Form.Label>
              <Form.Control value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} required />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label className="small fw-semibold">Email</Form.Label>
              <Form.Control value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </Form.Group>
            <Form.Group>
              <Form.Label className="small fw-semibold">Address</Form.Label>
              <Form.Control value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" type="button" onClick={() => setEditAccount(null)} disabled={savingEdit}>Cancel</Button>
            <Button type="submit" disabled={savingEdit}>
              {savingEdit ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</> : 'Save Changes'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  )
}