import { useCallback, useEffect, useState } from 'react'
import { Card, Button, Modal, Form, Row, Col, Alert, Badge } from 'react-bootstrap'
import api, { getError } from '../../api/client'
import DataTable from '../../components/common/DataTable'
import StatusBadge from '../../components/common/StatusBadge'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import PasswordInput from '../../components/common/PasswordInput'

const empty = { name: '', email: '', password: '', role: '' }

export default function Users() {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState({})
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/users')
      setUsers(data.data)
      setTotal(data.data.length)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    api.get('/users/roles').then((r) => setRoles(r.data.data || {})).catch(() => {})
  }, [])

  const roleOptions = Object.entries(roles).map(([code, r]) => ({ code, name: r?.name || code, perms: (r?.permissions || []).length }))

  const openForm = (user) => {
    setError('')
    setEditing(user || null)
    setForm(user ? { name: user.name, email: user.email, password: '', role: user.role || user.roleName } : empty)
    setShowForm(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editing) {
        const payload = { name: form.name, email: form.email, role: form.role }
        if (form.password) payload.password = form.password
        await api.put(`/users/${editing._id}`, payload)
      } else {
        await api.post('/users', form)
      }
      setShowForm(false)
      load()
    } catch (err) {
      setError(getError(err))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (user) => {
    try {
      await api.put(`/users/${user._id}`, { isActive: !user.isActive })
      load()
    } catch (err) {
      alert(getError(err))
    }
  }

  const remove = async () => {
    try {
      await api.delete(`/users/${deleting._id}`)
      setDeleting(null)
      load()
    } catch (err) {
      alert(getError(err))
      setDeleting(null)
    }
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase()
    return !q || (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.roleName || u.role || '').toLowerCase().includes(q)
  })
  const pageSize = 15
  const pages = Math.ceil(filtered.length / pageSize) || 1
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  const roleBadgeColor = (code) => code === 'ADMIN' || code === 'SUPER_ADMIN' ? 'badge-soft-danger' : 'badge-soft-primary'

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}>
          <i className="bi bi-person-gear me-2" />Users <span className="text-muted fs-6">({total})</span>
        </h4>
        <Button onClick={() => openForm(null)}><i className="bi bi-person-plus me-1" />Add User</Button>
      </div>

      <Card body>
        <DataTable
          columns={[
            { key: 'name', label: 'Name', render: (u) => <span><strong>{u.name}</strong><br /><small className="text-muted">{u.email}</small></span> },
            { key: 'role', label: 'Role', render: (u) => <Badge bg="" className={roleBadgeColor(u.role)}>{u.roleName || u.role}</Badge> },
            { key: 'permissions', label: 'Permissions', render: (u) => <span className="small text-muted">{u.permissions?.length || 0}</span> },
            { key: 'isActive', label: 'Status', render: (u) => <StatusBadge value={u.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
            { key: 'createdAt', label: 'Created', render: (u) => <span className="small text-muted">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}</span> },
            { key: 'actions', label: 'Actions', render: (u) => (
              <div className="d-flex gap-1">
                <Button size="sm" variant="light" className="border" onClick={() => openForm(u)} title="Edit"><i className="bi bi-pencil" /></Button>
                <Button size="sm" variant="light" className={`border ${u.isActive ? '' : 'text-success'}`} onClick={() => toggleActive(u)} title={u.isActive ? 'Deactivate' : 'Activate'}>
                  <i className={`bi ${u.isActive ? 'bi-person-slash' : 'bi-person-check'}`} />
                </Button>
                <Button size="sm" variant="light" className="border text-danger" onClick={() => setDeleting(u)} title="Delete"><i className="bi bi-trash" /></Button>
              </div>
            )}
          ]}
          data={paged}
          loading={loading}
          page={page}
          pages={pages}
          total={filtered.length}
          onPageChange={(p) => setPage(p)}
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1) }}
          searchPlaceholder="Search users..."
        />
      </Card>

      {/* Add/Edit */}
      <Modal show={showForm} onHide={() => setShowForm(false)} centered backdrop="static">
        <Form onSubmit={submit}>
          <Modal.Header closeButton><Modal.Title className="fs-6 fw-bold">{editing ? `Edit User — ${editing.name}` : 'Add User'}</Modal.Title></Modal.Header>
          <Modal.Body>
            {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
            <Row className="g-3">
              <Col md={12}><Form.Group><Form.Label>Full Name *</Form.Label><Form.Control value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Form.Group></Col>
              <Col md={12}><Form.Group><Form.Label>Email *</Form.Label><Form.Control type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Form.Group></Col>
              <Col md={12}><Form.Group><Form.Label>{editing ? 'New Password (leave blank to keep)' : 'Password *'}</Form.Label><PasswordInput value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={6} required={!editing} /></Form.Group></Col>
              <Col md={12}>
                <Form.Group><Form.Label>Role *</Form.Label>
                  <Form.Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} required>
                    <option value="">-- Select role --</option>
                    {roleOptions.map((r) => <option key={r.code} value={r.code}>{r.name} ({r.perms} permissions)</option>)}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <ConfirmDialog show={Boolean(deleting)} title="Delete User"
        message={`Delete "${deleting?.name}"? This cannot be undone.`}
        onClose={() => setDeleting(null)} onConfirm={remove} />
    </div>
  )
}
