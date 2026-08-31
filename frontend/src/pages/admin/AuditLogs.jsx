import { useCallback, useEffect, useState } from 'react'
import { Card, Form, Badge } from 'react-bootstrap'
import api from '../../api/client'
import DataTable from '../../components/common/DataTable'

const actionColor = (action) => {
  if (action.includes('DELETE') || action.includes('CANCEL') || action.includes('FAILED')) return 'danger'
  if (action.includes('CREATE') || action.includes('IN') || action.includes('PAYMENT')) return 'success'
  if (action.includes('ADJUSTMENT') || action.includes('UPDATE') || action.includes('RESET')) return 'warning'
  return 'info'
}

const PAGE_SIZE = 30

export default function AuditLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: PAGE_SIZE }
      if (search) params.search = search
      const { data } = await api.get('/audit-logs', { params })
      setLogs(data.data.logs)
      setTotal(data.data.total)
      setPages(Math.ceil(data.data.total / PAGE_SIZE) || 1)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <h4 className="fw-bold mb-1" style={{ color: '#0d3b66' }}>
        <i className="bi bi-journal-text me-2" />Audit Logs
      </h4>
      <p className="text-muted small">Read-only record of every important action in the system.</p>

      <Card body>
        <div className="d-flex flex-wrap gap-2 mb-3">
          <Form.Control size="sm" placeholder="Search user, action or entity..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} style={{ maxWidth: 250 }} />
        </div>

        <DataTable
          columns={[
            { key: 'date', label: 'Date', render: (l) => new Date(l.date || l.createdAt).toLocaleString() },
            { key: 'user', label: 'User', render: (l) => <span className="small fw-semibold">{l.userName || 'System'}</span> },
            { key: 'action', label: 'Action', render: (l) => <Badge bg="" className={`badge-soft-${actionColor(l.action)}`}>{l.action}</Badge> },
            { key: 'entity', label: 'Entity', render: (l) => l.entity || '-' },
            { key: 'details', label: 'Details', render: (l) => {
              if (!l.details) return <span className="small text-muted">-</span>
              try {
                return <code style={{ fontSize: '0.7rem' }}>{JSON.stringify(l.details)}</code>
              } catch {
                return <span className="small">{String(l.details)}</span>
              }
            } }
          ]}
          data={logs}
          loading={loading}
          page={page}
          pages={pages}
          total={total}
          onPageChange={setPage}
        />
      </Card>
    </div>
  )
}
