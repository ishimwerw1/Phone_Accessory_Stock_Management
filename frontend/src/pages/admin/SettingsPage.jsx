import { useEffect, useState } from 'react'
import { Card, Row, Col, Form, Button, Alert, Badge } from 'react-bootstrap'
import api, { getError } from '../../api/client'
import { fmtDate } from '../../utils/currency'
import AccountSecurity from '../../components/account/AccountSecurity'

const defaults = {
  companyName: '', companyPhone: '', companyEmail: '', companyAddress: '',
  companyTin: '', logoUrl: '/logo.png',
  currency: 'RWF', loanDays: 30,
  aedToUsd: '', aedToRwf: '', usdToRwf: '',
  exchangeRateProvider: 'erApi', exchangeRateRefreshHours: 6,
}

const fallbackProviders = [
  { name: 'erApi', label: 'open.er-api.com (automatic)' },
  { name: 'manual', label: 'Manual (admin-entered rates)' },
]

export default function SettingsPage() {
  const [form, setForm] = useState(null)
  const [ratesView, setRatesView] = useState(null)
  const [ratesError, setRatesError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/settings').then((r) => setForm({ ...defaults, ...(r.data.data || {}) })).catch(() => setForm(defaults))
    api.get('/exchange-rates')
      .then((r) => setRatesView(r.data.data))
      .catch(() => setRatesError('Could not load the current exchange rates.'))
  }, [])

  if (!form) return null

  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm({ ...form, [field]: value })
  }

  const provider = form.exchangeRateProvider || 'erApi'
  const providers = ratesView?.availableProviders?.length ? ratesView.availableProviders : fallbackProviders
  const manual = provider === 'manual'

  const refreshNow = async () => {
    setRefreshing(true)
    setError('')
    setSuccess(false)
    try {
      const { data } = await api.post('/exchange-rates/refresh')
      setRatesView(data.data)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setRatesError(getError(err))
    } finally {
      setRefreshing(false)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess(false)
    try {
      const res = await api.put('/settings', {
        companyName: form.companyName,
        companyPhone: form.companyPhone,
        companyEmail: form.companyEmail,
        companyAddress: form.companyAddress,
        companyTin: form.companyTin,
        logoUrl: form.logoUrl,
        currency: form.currency,
        loanDays: Number(form.loanDays) || 30,
        exchangeRateProvider: form.exchangeRateProvider,
        exchangeRateRefreshHours: Number(form.exchangeRateRefreshHours) || 6,
        aedToUsd: Number(form.aedToUsd || ratesView?.aedToUsd) || 0,
        aedToRwf: Number(form.aedToRwf || ratesView?.aedToRwf) || 0,
        usdToRwf: Number(form.usdToRwf || ratesView?.usdToRwf) || 0,
      })
      setForm((f) => ({ ...f, ...res.data.data }))
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
                <Col md={6}><Form.Group><Form.Label>TIN Number</Form.Label><Form.Control value={form.companyTin} onChange={set('companyTin')} placeholder="e.g. 104205001" /></Form.Group></Col>
                <Col md={6}><Form.Group><Form.Label>Logo URL</Form.Label><Form.Control value={form.logoUrl} onChange={set('logoUrl')} placeholder="/logo.png" /></Form.Group></Col>
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

              <h6 className="fw-semibold text-uppercase text-muted small mb-3">Currency / Exchange Rate Settings</h6>

              {ratesView?.warning && (
                <Alert variant="warning" className="py-2 small"><i className="bi bi-exclamation-triangle me-1" />{ratesView.warning}</Alert>
              )}
              {ratesError && (
                <Alert variant="warning" className="py-2 small"><i className="bi bi-exclamation-triangle me-1" />{ratesError}</Alert>
              )}

              <Row className="g-3 mb-3">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Rate Provider</Form.Label>
                    <Form.Select value={provider} onChange={set('exchangeRateProvider')}>
                      {providers.map((p) => <option key={p.name} value={p.name}>{p.label}</option>)}
                    </Form.Select>
                    {!manual && (
                      <Form.Text muted>Rates are fetched automatically from the provider and refreshed on demand.</Form.Text>
                    )}
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Refresh Rate</Form.Label>
                    <Form.Control
                      type="number"
                      min="1"
                      value={form.exchangeRateRefreshHours}
                      onChange={set('exchangeRateRefreshHours')}
                      placeholder="Hours"
                    />
                    <Form.Text muted>Minimum age (hours) of cached rates before the system fetches new ones.</Form.Text>
                  </Form.Group>
                </Col>
                <Col md={4} className="d-flex align-items-end">
                  <Button variant="outline-primary" onClick={refreshNow} disabled={refreshing} style={{ width: '100%' }}>
                    {refreshing ? <><span className="spinner-border spinner-border-sm me-1" />Refreshing...</> : <><i className="bi bi-arrow-repeat me-1" />Refresh Now</>}
                  </Button>
                </Col>
              </Row>

              {manual ? (
                <Row className="g-3 mb-2">
                  <Col md={4}>
                    <Form.Group><Form.Label>AED → USD</Form.Label>
                      <Form.Control type="number" min="0" step="0.0001" value={form.aedToUsd} onChange={set('aedToUsd')} placeholder="e.g. 0.2723" required />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group><Form.Label>AED → RWF</Form.Label>
                      <Form.Control type="number" min="0" step="0.01" value={form.aedToRwf} onChange={set('aedToRwf')} placeholder="e.g. 401.42" required />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group><Form.Label>USD → RWF (derived)</Form.Label>
                      <Form.Control type="number" readOnly value={form.aedToUsd > 0 && form.aedToRwf > 0 ? Number(form.aedToRwf) / Number(form.aedToUsd) : ''} tabIndex={-1} />
                    </Form.Group>
                  </Col>
                </Row>
              ) : (
                <Row className="g-3 mb-2">
                  <Col md={4}>
                    <div className="small"><span className="text-muted d-block">AED → USD</span>
                      <strong>{(ratesView?.aedToUsd || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })}</strong>
                    </div>
                  </Col>
                  <Col md={4}>
                    <div className="small"><span className="text-muted d-block">AED → RWF</span>
                      <strong>{(ratesView?.aedToRwf || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })}</strong>
                    </div>
                  </Col>
                  <Col md={4}>
                    <div className="small"><span className="text-muted d-block">USD → RWF</span>
                      <strong>{(ratesView?.usdToRwf || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })}</strong>
                    </div>
                  </Col>
                  <Col md={4}>
                    <div className="small"><span className="text-muted d-block">Rate Provider</span>
                      <strong>{ratesView?.source || ratesView?.provider || '—'}</strong>
                    </div>
                  </Col>
                  <Col md={4}>
                    <div className="small"><span className="text-muted d-block">Last Updated</span>
                      <strong>{fmtDate(ratesView?.updatedAt)}</strong>
                    </div>
                  </Col>
                  <Col md={4}>
                    <div className="small"><span className="text-muted d-block">Status</span>
                      {ratesView?.stale
                        ? <Badge bg="" className="badge-soft-warning">Stale — refresh needed</Badge>
                        : <Badge bg="" className="badge-soft-success">{ratesView?.fromCache ? 'Cached (fresh)' : 'Current'}</Badge>}
                    </div>
                  </Col>
                </Row>
              )}

              <p className="small text-muted mb-4">
                The supplier price is entered in AED. It is converted to USD and RWF. Products store a snapshot of
                the rate used at the time they were saved, so changing these rates only affects new entries.
              </p>

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

      <hr className="my-4" />
      <AccountSecurity />
    </div>
  )
}