import { useEffect, useRef, useState } from 'react'
import { Dropdown, Badge, Button } from 'react-bootstrap'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'

export default function Topbar({ onToggleSidebar }) {
  const { user, logout, hasPermission } = useAuth()
  const { lang, setLang, t } = useLanguage()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotif, setShowNotif] = useState(false)
  const timerRef = useRef(null)

  const isAdminUser = user?.roleName === 'Super Admin' || user?.role === 'SUPER_ADMIN' ||
    hasPermission('users.read') || hasPermission('auditLogs.read') ||
    hasPermission('settings.read')

  const loadNotifications = async () => {
    try {
      const { data } = await api.get('/notifications', { params: { limit: 15 } })
      setNotifications(data.data.notifications)
      setUnreadCount(data.data.unread || data.data.notifications.filter((n) => !n.read).length)
    } catch { /* silent */ }
  }

  useEffect(() => {
    loadNotifications()
    timerRef.current = setInterval(loadNotifications, 30000)
    return () => clearInterval(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const markAllRead = async () => {
    await api.post('/notifications/read-all')
    loadNotifications()
  }

  const markRead = async (id) => {
    try { await api.post('/notifications/read', { ids: [id] }) } catch { /* ignore */ }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="bcml-topbar d-flex align-items-center justify-content-between px-2 px-sm-3 px-lg-4 py-2 bg-white border-bottom position-sticky top-0 z-3">
      <div className="d-flex align-items-center gap-2 overflow-hidden">
        <Button variant="light" size="sm" className="d-lg-none border flex-shrink-0" onClick={onToggleSidebar}>
          <i className="bi bi-list fs-5" />
        </Button>
        <span className="fw-semibold text-secondary small d-none d-md-inline text-truncate">
          {new Date().toLocaleDateString(lang === 'rw' ? 'rw-RW' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
      </div>

      <div className="d-flex align-items-center gap-1 gap-sm-2 flex-shrink-0">
        <Dropdown align="end" onSelect={() => setShowNotif(false)}>
          <Dropdown.Toggle variant="light" className="border position-relative px-2 px-sm-3" size="sm">
            <i className="bi bi-bell fs-6" />
            {unreadCount > 0 && (
              <Badge bg="danger" pill className="position-absolute top-0 start-100 translate-middle" style={{ fontSize: '0.55rem' }}>
                {unreadCount}
              </Badge>
            )}
          </Dropdown.Toggle>
          <Dropdown.Menu className="shadow border-0 mw-100" style={{ width: 'min(340px, 92vw)', maxHeight: '80vh', overflowY: 'auto' }} show={showNotif} onToggle={(v) => { setShowNotif(v); if (v) loadNotifications() }}>
            <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom sticky-top bg-white">
              <strong className="small">{t('notifications')}</strong>
              {unreadCount > 0 && (
                <Button variant="link" size="sm" className="p-0 text-decoration-none small" onClick={markAllRead}>
                  {t('markAllRead')}
                </Button>
              )}
            </div>
            {notifications.length === 0 ? (
              <div className="text-center text-muted py-4 small">{t('noNotifications')}</div>
            ) : (
              notifications.map((n) => {
                const read = n.read
                return (
                  <Dropdown.Item
                    as={Link}
                    to={n.sale ? `/sales/${n.sale}` : n.loan ? `/loans/${n.loan}` : n.product ? `/products/${n.product}` : '#'}
                    key={n._id}
                    className={`py-2 border-bottom text-wrap ${read ? '' : 'bg-light'}`}
                    onClick={async () => { await markRead(n._id) }}
                  >
                    <div className="d-flex gap-2">
                      <i className={`bi ${iconFor(n.type)} mt-1 flex-shrink-0`} style={{ color: colorFor(n.type) }} />
                      <div className="flex-grow-1 overflow-hidden">
                        <div className="text-muted text-break" style={{ fontSize: '0.78rem' }}>{lang === 'rw' && n.messageRw ? n.messageRw : n.message}</div>
                        <div className="text-muted" style={{ fontSize: '0.68rem' }}>{new Date(n.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                  </Dropdown.Item>
                )
              })
            )}
          </Dropdown.Menu>
        </Dropdown>

        {isAdminUser && (
          <Dropdown align="end">
            <Dropdown.Toggle variant="dark" size="sm" className="d-flex align-items-center gap-1 gap-sm-2 px-2 px-sm-3">
              <i className="bi bi-shield-lock" />
              <span className="small fw-semibold d-none d-sm-inline">{t('adminMenu')}</span>
            </Dropdown.Toggle>
            <Dropdown.Menu align="end" className="shadow border-0">
              <Dropdown.Header><small className="text-uppercase text-muted fw-semibold">Administration</small></Dropdown.Header>
              {(user?.roleName === 'Super Admin' || user?.role === 'SUPER_ADMIN' || hasPermission('users.read')) && (
                <Dropdown.Item as={Link} to="/users"><i className="bi bi-person-gear me-2" />{t('users')}</Dropdown.Item>
              )}
              {(user?.roleName === 'Super Admin' || user?.role === 'SUPER_ADMIN' || hasPermission('auditLogs.read')) && (
                <Dropdown.Item as={Link} to="/audit-logs"><i className="bi bi-journal-text me-2" />{t('auditLogs')}</Dropdown.Item>
              )}
              {(user?.roleName === 'Super Admin' || user?.role === 'SUPER_ADMIN' || hasPermission('settings.read')) && (
                <Dropdown.Item as={Link} to="/settings"><i className="bi bi-gear me-2" />{t('settings')}</Dropdown.Item>
              )}
            </Dropdown.Menu>
          </Dropdown>
        )}

        <Dropdown align="end">
          <Dropdown.Toggle variant="light" className="border d-flex align-items-center gap-1 gap-sm-2 px-2 px-sm-3" size="sm">
            <span className="avatar-circle flex-shrink-0" style={{ width: 28, height: 28, borderRadius: '50%', background: '#0d3b66', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
              {initials(user?.name)}
            </span>
            <span className="d-none d-md-inline small fw-semibold text-truncate" style={{ maxWidth: 120 }}>{user?.name}</span>
          </Dropdown.Toggle>
          <Dropdown.Menu align="end" className="shadow border-0">
            <Dropdown.Header>
              <div className="fw-semibold text-truncate">{user?.name}</div>
              <small className="text-muted d-block text-truncate">{user?.roleName || user?.role}</small>
            </Dropdown.Header>
            <Dropdown.Divider />
            <Dropdown.Item as={Link} to="/profile"><i className="bi bi-person me-2" />{t('profile')}</Dropdown.Item>
            <Dropdown.Divider />
            <Dropdown.Item onClick={handleLogout} className="text-danger"><i className="bi bi-box-arrow-right me-2" />{t('logout')}</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>

        <Button
          variant="outline-primary"
          size="sm"
          className="px-2 px-sm-3"
          onClick={() => setLang(lang === 'en' ? 'rw' : 'en')}
          title={t('language')}
        >
          <i className="bi bi-translate me-1 d-none d-sm-inline" />
          {lang === 'en' ? 'RW' : 'EN'}
        </Button>
      </div>
    </div>
  )
}

const initials = (name) =>
  (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

const iconFor = (type) => ({
  LOW_STOCK: 'bi-exclamation-triangle',
  OUT_OF_STOCK: 'bi-x-octagon',
  NEW_SALE: 'bi-cart-check',
  NEW_LOAN: 'bi-cash-coin',
  OVERDUE_LOAN: 'bi-alarm',
  LOAN_REPAYMENT: 'bi-cash-stack',
  STOCK_RECEIVED: 'bi-box-arrow-in-down',
  STOCK_ADJUSTMENT: 'bi-sliders',
  DAMAGED_PRODUCT: 'bi-battery-charging',
  PRODUCT_RETURN: 'bi-arrow-counterclockwise',
  SYSTEM: 'bi-info-circle'
}[type] || 'bi-bell')

const colorFor = (type) => ({
  LOW_STOCK: '#b7791f',
  OUT_OF_STOCK: '#c0392b',
  NEW_SALE: '#1e7e46',
  NEW_LOAN: '#b7791f',
  OVERDUE_LOAN: '#c0392b',
  LOAN_REPAYMENT: '#1e7e46',
  STOCK_RECEIVED: '#0d3b66',
  STOCK_ADJUSTMENT: '#6c757d',
  DAMAGED_PRODUCT: '#c0392b',
  PRODUCT_RETURN: '#1a6fb5'
}[type] || '#51607a')