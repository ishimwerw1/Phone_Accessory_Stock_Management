import { useState, useEffect } from 'react'
import { Card, Form, Button, Alert, Row, Col, Badge } from 'react-bootstrap'
import { useAuth } from '../../context/AuthContext'

function formatWhen(d) {
  if (!d) return '-'
  const ms = Date.now() - new Date(d).getTime()
  if (ms < 60000) return 'Just now'
  if (ms < 3600000) return `${Math.floor(ms / 60000)} min ago`
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`
  return new Date(d).toLocaleDateString()
}

export default function AccountSecurity() {
  const { user, updateProfile, changePassword, getSessions, revokeSession, revokeOthers, logout } = useAuth()

  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [profSaving, setProfSaving] = useState(false)
  const [profSuccess, setProfSuccess] = useState(false)
  const [profErr, setProfErr] = useState('')

  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwSuccess, setPwSuccess] = useState('')
  const [pwErr, setPwErr] = useState('')

  const [sessions, setSessions] = useState([])
  const [sessErr, setSessErr] = useState('')
  const [revoking, setRevoking] = useState(null)

  useEffect(() => { getSessions().then(setSessions).catch((e) => setSessErr(e.response?.data?.message || 'Failed to load sessions')) }, [getSessions])

  const saveProfile = async (e) => {
    e.preventDefault()
    setProfSaving(true); setProfErr(''); setProfSuccess(false)
    try {
      await updateProfile({ name, email })
      setProfSuccess('Profile updated')
      setTimeout(() => setProfSuccess(false), 3000)
    } catch (err) { setProfErr(err.response?.data?.message || 'Failed to update profile') }
    finally { setProfSaving(false) }
  }

  const savePassword = async (e) => {
    e.preventDefault()
    if (newPw !== confirmPw) { setPwErr('Passwords do not match'); return }
    if (newPw.length < 6) { setPwErr('Password must be at least 6 characters'); return }
    setPwSaving(true); setPwErr(''); setPwSuccess('')
    try {
      await changePassword({ currentPassword: curPw, newPassword: newPw })
      setPwSuccess('Password changed. Other sessions have been signed out.')
      setCurPw(''); setNewPw(''); setConfirmPw('')
      const fresh = await getSessions().catch(() => null)
      if (fresh) setSessions(fresh)
      setTimeout(() => setPwSuccess(''), 5000)
    } catch (err) { setPwErr(err.response?.data?.message || 'Failed to change password') }
    finally { setPwSaving(false) }
  }

  const handleRevoke = async (sess) => {
    setRevoking(sess._id)
    try {
      const res = await revokeSession(sess._id)
      setSessions((s) => s.filter((x) => x._id !== sess._id))
      if (res?.revokedCurrent) setTimeout(() => logout(), 500)
    } catch { /* silent */ }
    finally { setRevoking(null) }
  }

  const handleRevokeAll = async () => {
    setRevoking('all')
    try { await revokeOthers(); setSessions((s) => s.filter((x) => x.isCurrent)) }
    catch { /* silent */ }
    finally { setRevoking(null) }
  }

  const otherCount = sessions.filter((s) => !s.isCurrent).length

  return (
    <>
      <h6 className="fw-semibold text-uppercase text-muted small mb-3">My Account</h6>
      <Row className="g-3 mb-4">
        <Col md={6}>
          <Card body className="h-100">
            <h6 className="fw-semibold mb-3"><i className="bi bi-person me-2" />Profile Information</h6>
            {profErr && <Alert variant="danger" className="py-2 small">{profErr}</Alert>}
            {profSuccess && <Alert variant="success" className="py-2 small">{profSuccess}</Alert>}
            <Form onSubmit={saveProfile}>
              <Form.Group className="mb-3"><Form.Label>Full name</Form.Label><Form.Control value={name} onChange={(e) => setName(e.target.value)} required /></Form.Group>
              <Form.Group className="mb-3"><Form.Label>Email (login)</Form.Label><Form.Control type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Form.Group>
              <Button type="submit" size="sm" disabled={profSaving}>{profSaving ? 'Saving…' : 'Save Profile'}</Button>
            </Form>
          </Card>
        </Col>
        <Col md={6}>
          <Card body className="h-100">
            <h6 className="fw-semibold mb-3"><i className="bi bi-key me-2" />Change Password</h6>
            {pwErr && <Alert variant="danger" className="py-2 small">{pwErr}</Alert>}
            {pwSuccess && <Alert variant="success" className="py-2 small">{pwSuccess}</Alert>}
            <Form onSubmit={savePassword}>
              <Form.Group className="mb-3"><Form.Label>Current password</Form.Label><Form.Control type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} required /></Form.Group>
              <Form.Group className="mb-3"><Form.Label>New password</Form.Label><Form.Control type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={6} /></Form.Group>
              <Form.Group className="mb-3"><Form.Label>Confirm new password</Form.Label><Form.Control type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required minLength={6} /></Form.Group>
              <Button type="submit" size="sm" variant="outline-warning" disabled={pwSaving}>{pwSaving ? 'Saving…' : 'Update Password'}</Button>
            </Form>
          </Card>
        </Col>
      </Row>

      <Card body className="mb-3">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="fw-semibold mb-0"><i className="bi bi-window me-2" />Active Sessions</h6>
          {otherCount > 0 && (
            <Button size="sm" variant="outline-danger" disabled={!!revoking} onClick={handleRevokeAll}>
              {revoking === 'all' ? 'Ending…' : `End ${otherCount} other session${otherCount > 1 ? 's' : ''}`}
            </Button>
          )}
        </div>
        {sessErr && <Alert variant="warning" className="py-2 small">{sessErr}</Alert>}
        {!sessions.length && !sessErr && <p className="text-muted small mb-0">No active sessions.</p>}
        {sessions.map((s) => (
          <div key={s._id} className="d-flex justify-content-between align-items-center border-bottom py-2">
            <div className="small">
              <span className="fw-semibold">{s.device}</span>
              {s.ip && <span className="text-muted ms-2">IP: {s.ip}</span>}
              <span className="text-muted ms-2">· Last active {formatWhen(s.lastActiveAt)}</span>
              {s.isCurrent && <Badge bg="success" className="ms-2 fw-normal" style={{ fontSize: '0.65rem' }}>Current</Badge>}
            </div>
            {!s.isCurrent && (
              <Button size="sm" variant="link" className="text-danger p-0 text-nowrap" disabled={!!revoking} onClick={() => handleRevoke(s)}>
                {revoking === s._id ? 'Revoking…' : 'Revoke'}
              </Button>
            )}
          </div>
        ))}
      </Card>
    </>
  )
}