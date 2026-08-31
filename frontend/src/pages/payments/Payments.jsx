import { useCallback, useEffect, useState } from 'react'
import { Card, Form, Badge } from 'react-bootstrap'
import api from '../../api/client'
import DataTable from '../../components/common/DataTable'
import StatusBadge from '../../components/common/StatusBadge'
import { formatMoney } from '../../context/LanguageContext'

const PAGE_SIZE = 20

export default function Payments() {
  const [payments, setPayments] = useState([])
  const [income, setIncome] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [method, setMethod] = useState('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: PAGE_SIZE }
      if (method !== 'ALL') params.method = method
      if (from) params.from = from
      if (to) params.to = to
      const { data } = await api.get('/payments', { params })
      setPayments(data.data.payments)
      setIncome(data.data.income || 0)
      setTotal(data.data.total)
      setPages(Math.ceil(data.data.total / PAGE_SIZE) || 1)
    } finally {
      setLoading(false)
    }
  }, [page, method, from, to])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}>
          <i className="bi bi-wallet2 me-2" />Payment History <span className="text-muted fs-6">({total})</span>
        </h4>
        <Badge bg="" className="badge-soft-success fs-6 px-3 py-2"><i className="bi bi-cash-stack me-1" />Income (Paid): {formatMoney(income)}</Badge>
      </div>

      <Card body>
        <div className="d-flex flex-wrap gap-2 mb-3">
          <Form.Select size="sm" value={method} onChange={(e) => { setMethod(e.target.value); setPage(1) }} style={{ maxWidth: 140 }}>
            {['ALL', 'CASH', 'MOMO', 'BANK', 'LOAN'].map((m) => <option key={m} value={m}>{m === 'ALL' ? 'All Methods' : m}</option>)}
          </Form.Select>
          <Form.Control size="sm" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} style={{ maxWidth: 155 }} />
          <Form.Control size="sm" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} style={{ maxWidth: 155 }} />
        </div>

        <DataTable
          columns={[
            { key: 'paymentNumber', label: 'Receipt #', render: (p) => <strong>{p.paymentNumber}</strong> },
            { key: 'date', label: 'Date', render: (p) => new Date(p.date || p.createdAt).toLocaleString() },
            { key: 'customer', label: 'Customer', render: (p) => (
              <span className="small">{p.customer?.name || '-'}<br /><small className="text-muted">{p.customer?.phone}</small></span>
            )},
            { key: 'amount', label: 'Amount', render: (p) => <strong className="text-success">{formatMoney(p.amount)}</strong> },
            { key: 'method', label: 'Method', render: (p) => <StatusBadge value={p.method} /> },
            { key: 'status', label: 'Status', render: (p) => <StatusBadge value={p.status} /> },
            { key: 'reference', label: 'Reference', render: (p) => p.reference ? <code className="small">{p.reference}</code> : '-' },
            { key: 'receivedBy', label: 'Received By', render: (p) => <span className="small">{p.receivedBy?.name || '-'}</span> }
          ]}
          data={payments}
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
