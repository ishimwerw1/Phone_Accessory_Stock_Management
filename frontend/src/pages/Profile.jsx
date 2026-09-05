import { Card, Row, Col, Badge } from 'react-bootstrap'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import AccountSecurity from '../components/account/AccountSecurity'

export default function Profile() {
  const { user } = useAuth()
  const { t } = useLanguage()
  if (!user) return null

  return (
    <div>
      <h4 className="fw-bold mb-3" style={{ color: '#0d3b66' }}>
        <i className="bi bi-person-circle me-2" />{t('profile')}
      </h4>

      <Row className="g-3">
        <Col lg={4}>
          <Card body className="text-center h-100">
            <span style={{ width: 84, height: 84, borderRadius: '50%', background: '#0d3b66', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', fontWeight: 700 }}>
              {(user.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('')}
            </span>
            <h5 className="mt-3 mb-1 fw-bold">{user.name}</h5>
            <Badge bg="" className={user.roleName === 'Super Admin' ? 'badge-soft-danger' : 'badge-soft-primary'}>{user.roleName}</Badge>
            <hr />
            <div className="text-start small text-muted">
              <div><i className="bi bi-envelope me-2" />{user.email}</div>
            </div>
          </Card>
        </Col>

        <Col lg={8}>
          <Card body>
            <h6 className="fw-semibold mb-3">Account Information</h6>
            <div className="d-flex justify-content-between border-bottom py-2">
              <span className="text-muted small">Name</span>
              <span className="small fw-semibold">{user.name}</span>
            </div>
            <div className="d-flex justify-content-between border-bottom py-2">
              <span className="text-muted small">Email</span>
              <span className="small fw-semibold">{user.email}</span>
            </div>
            <div className="d-flex justify-content-between border-bottom py-2">
              <span className="text-muted small">Role</span>
              <span className="small fw-semibold">{user.roleName}</span>
            </div>
            <div className="d-flex justify-content-between border-bottom py-2">
              <span className="text-muted small">Member Since</span>
              <span className="small fw-semibold">{new Date(user.createdAt).toLocaleDateString()}</span>
            </div>
          </Card>

          <hr className="my-4" />
          <AccountSecurity />
        </Col>
      </Row>
    </div>
  )
}
