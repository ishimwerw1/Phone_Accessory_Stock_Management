import { useEffect, useState } from 'react'
import { Card, Row, Col, Form, Button, Alert } from 'react-bootstrap'
import api, { getError } from '../../api/client'

const defaults = {
  companyName: '', companyPhone: '', companyEmail: '', companyAddress: '',
  currency: 'RWF', loanDays: 30
}

export default function SettingsPage() {
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/settings').then((r) => setForm({ ...defaults, ...(r.data.data || {}) }))
  }, [])

  if (!form) return null

  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm({ ...form, [field]: value })
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess(false)
    try {
      await api.put('/settings', {
        companyName: form.companyName,
        companyPhone: form.companyPhone,
        companyEmail: form.companyEmail,
        companyAddress: form.companyAddress,
        currency: form.currency,
        loanDays: Number(form.loanDays) || 30,
      })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(getError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h4 className="fw-bold mb-3" style={{ color: '#0d3b66' }}>
        <i className="bi bi-gear me-2" />System Settings
      </h4>

      <Row className="g-3">
        <Col lg={8}>
          <Card body>
            {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
            {success && <Alert variant="success" className="py-2 small">Settings saved successfully.</Alert>}
            <Form onSubmit={submit}>
              <h6 className="fw-semibold text-uppercase text-muted small mb-3">Company Information</h6>
              <Row className="g-3 mb-4">
                <Col md={12}><Form.Group><Form.Label>Company Name</Form.Label><Form.Control value={form.companyName} onChange={set('companyName')} /></Form.Group></Col>
                <Col md={4}><Form.Group><Form.Label>Phone</Form.Label><Form.Control value={form.companyPhone} onChange={set('companyPhone')} /></Form.Group></Col>
                <Col md={4}><Form.Group><Form.Label>Email</Form.Label><Form.Control type="email" value={form.companyEmail} onChange={set('companyEmail')} /></Form.Group></Col>
                <Col md={4}><Form.Group><Form.Label>Address</Form.Label><Form.Control value={form.companyAddress} onChange={set('companyAddress')} /></Form.Group></Col>
              </Row>

              <h6 className="fw-semibold text-uppercase text-muted small mb-3">Business Rules</h6>
              <Row className="g-3 mb-4">
                <Col md={4}>
                  <Form.Group><Form.Label>Currency</Form.Label>
                    <Form.Select value={form.currency} onChange={set('currency')}>
                      {['RWF', 'USD', 'EUR', 'KES', 'UGX', 'TZS'].map((c) => <option key={c}>{c}</option>)}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group><Form.Label>Default Loan Due Days</Form.Label>
                    <Form.Control type="number" min="1" value={form.loanDays} onChange={set('loanDays')} />
                  </Form.Group>
                </Col>
              </Row>

              <Button type="submit" disabled={saving}>
                {saving ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</> : <><i className="bi bi-check-lg me-1" />Save Settings</>}
              </Button>
            </Form>
          </Card>
        </Col>

        <Col lg={4}>
          <Card body className="bg-light h-100 border-0">
            <h6 className="fw-semibold"><i className="bi bi-shield-check me-2 text-success" />Security Notes</h6>
            <ul className="small text-muted ps-3 mb-0">
              <li className="mb-2">Database credentials and JWT secrets live only in the backend <code>.env</code>.</li>
              <li className="mb-2">Passwords are hashed with bcrypt; sessions use signed JWTs.</li>
              <li className="mb-2">Sensitive endpoints require permissions at both API and UI level.</li>
              <li>Login attempts are rate-limited to prevent brute force attacks.</li>
            </ul>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
