import { useEffect, useState } from 'react'
import { Card, Row, Col, Table, Button } from 'react-bootstrap'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../api/client'
import StatusBadge from '../../components/common/StatusBadge'
import Loading from '../../components/common/Loading'
import { formatMoney } from '../../context/LanguageContext'

export default function CustomerLoanAccount() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [company, setCompany] = useState(null)

  useEffect(() => {
    api.get(`/loans/accounts/${customerId}`).then((r) => {
      setData(r.data.data)
      api.get('/settings').then((s) => {
        const c = s.data.data || {}
        setCompany({
          name: c.companyName || 'Nsenga Legacy Electronic',
          slogan: c.slogan || '',
          phone: c.companyPhone || '',
          email: c.companyEmail || '',
          address: c.companyAddress || 'Kigali, Rwanda',
          tin: c.companyTin || '',
          logoUrl: c.logoUrl || '/logo.png',
          footerNote: c.invoiceFooterNote || 'Thank you for your business!'
        })
      }).catch(() => {})
    }).catch(() => navigate('/loans'))
  }, [customerId, navigate])

  if (!data) return <Loading full />
  const { accountName, accountPhone, accountAddress, accountEmail, transactions, totals, repayments } = data
  const balance = totals.remainingBalance

  const statementRows = []
  transactions.forEach((t) => {
    const items = t.items && t.items.length ? t.items : [{ name: '—', quantity: '', price: t.totalAmount }]
    items.forEach((it) => {
      statementRows.push({
        date: t.date,
        reference: t.saleNumber || t.loanNumber,
        loanNumber: t.loanNumber,
        product: it.name,
        quantity: it.quantity,
        unitPrice: it.price,
        amount: t.totalAmount,
        status: t.status
      })
    })
  })

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2 no-print">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}>
          <i className="bi bi-cash-coin me-2" />Customer Loan Account — {accountName}
        </h4>
        <div className="d-flex gap-2 flex-wrap">
          <Button variant="primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />Print Loan Statement</Button>
          <Button variant="light" className="border" onClick={() => navigate('/loans')}><i className="bi bi-arrow-left me-1" />Back to Loans</Button>
        </div>
      </div>

      <Row className="g-3 mb-3">
        <Col md={3}><Card body className="text-center"><div className="text-muted small">Total Borrowed</div><div className="fs-5 fw-bold">{formatMoney(totals.totalDebt)}</div></Card></Col>
        <Col md={3}><Card body className="text-center"><div className="text-muted small">Total Paid</div><div className="fs-5 fw-bold text-success">{formatMoney(totals.totalPaid)}</div></Card></Col>
        <Col md={3}><Card body className="text-center bg-light"><div className="text-muted small">Remaining Balance</div><div className={`fs-5 fw-bold ${balance > 0 ? 'text-danger' : 'text-success'}`}>{formatMoney(balance)}</div></Card></Col>
        <Col md={3}><Card body className="text-center"><div className="text-muted small">Loan Transactions</div><div className="fs-5 fw-bold">{totals.transactionCount}</div></Card></Col>
      </Row>

      <Row className="g-3 mb-3 no-print">
        <Col md={4}>
          <Card>
            <Card.Header className="bg-white fw-semibold small"><i className="bi bi-person me-2 text-primary" />Customer Information</Card.Header>
            <Card.Body className="py-1">
              <div className="d-flex justify-content-between border-bottom py-2"><span className="text-muted small">Name</span><span className="small fw-semibold">{accountName}</span></div>
              <div className="d-flex justify-content-between border-bottom py-2"><span className="text-muted small">Phone</span><span className="small"><code>{accountPhone || '-'}</code></span></div>
              {accountAddress && <div className="d-flex justify-content-between border-bottom py-2"><span className="text-muted small">Address</span><span className="small">{accountAddress}</span></div>}
              {accountEmail && <div className="d-flex justify-content-between border-bottom py-2"><span className="text-muted small">Email</span><span className="small">{accountEmail}</span></div>}
            </Card.Body>
          </Card>
        </Col>
        <Col md={8}>
          <Card>
            <Card.Header className="bg-white fw-semibold small"><i className="bi bi-clock-history me-2 text-success" />Repayment History ({repayments.length})</Card.Header>
            <Table size="sm" hover responsive className="mb-0 align-middle">
              <thead><tr><th>Date</th><th>Reference</th><th className="text-end">Amount</th><th>Method</th><th>Received By</th></tr></thead>
              <tbody>
                {repayments.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-3">No repayments recorded yet</td></tr>}
                {repayments.map((p) => (
                  <tr key={p._id}>
                    <td className="small">{new Date(p.date || p.createdAt).toLocaleString()}</td>
                    <td className="small">{p.loanNumber || '-'}</td>
                    <td className="fw-semibold text-success text-end">{formatMoney(p.amount)}</td>
                    <td><StatusBadge value={p.method} /></td>
                    <td className="small">{p.receivedBy?.name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </Col>
      </Row>

      <div className="invoice-sheet shadow-sm p-4">
        <div className="d-flex justify-content-between align-items-start border-bottom pb-3 mb-3">
          <div className="d-flex gap-3">
            {company && <img src={company.logoUrl} alt="" style={{ width: 64 }} />}
            <div>
              <h5 className="fw-bold mb-0" style={{ color: '#0d3b66' }}>{company?.name}</h5>
              {company?.slogan && <small className="text-muted d-block">{company.slogan}</small>}
              <small className="text-muted d-block"><i className="bi bi-geo-alt me-1" />{company?.address}</small>
              {company?.phone && <small className="text-muted d-block"><i className="bi bi-telephone me-1" />{company.phone}</small>}
              {company?.email && <small className="text-muted d-block"><i className="bi bi-envelope me-1" />{company.email}</small>}
              {company?.tin && <small className="text-muted d-block"><i className="bi bi-file-earmark-text me-1" />TIN: {company.tin}</small>}
            </div>
          </div>
          <div className="text-end">
            <h4 className="fw-bold mb-0">CUSTOMER LOAN ACCOUNT</h4>
            <div className="small text-muted">Statement as of {new Date().toLocaleDateString()}</div>
          </div>
        </div>

        <div className="row mb-4">
          <div className="col-6">
            <strong className="small text-uppercase text-muted d-block mb-1">Customer</strong>
            <div className="fw-semibold">{accountName}</div>
            {accountPhone && <div className="small text-muted">{accountPhone}</div>}
            {accountAddress && <div className="small text-muted">{accountAddress}</div>}
          </div>
          <div className="col-6 text-end">
            <div className="small"><span className="text-muted">Loan Transactions:</span> <strong>{totals.transactionCount}</strong></div>
            <div className="small"><span className="text-muted">Total Repayments:</span> <strong>{repayments.length}</strong></div>
          </div>
        </div>

        <strong className="small text-uppercase text-muted d-block mb-1">Loan Transactions</strong>
        <table className="table table-sm table-bordered">
          <thead style={{ background: '#f8f9fb' }}>
            <tr>
              <th>Date</th><th>Invoice / Reference</th><th>Product</th>
              <th className="text-center">Qty</th><th className="text-end">Unit Price</th>
              <th className="text-end">Amount</th><th className="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {statementRows.length === 0 && <tr><td colSpan={7} className="text-center text-muted py-3">No loan transactions</td></tr>}
            {statementRows.map((r, i) => (
              <tr key={i}>
                <td className="small">{new Date(r.date).toLocaleDateString()}</td>
                <td className="small"><code>{r.reference}</code></td>
                <td className="small">{r.product}</td>
                <td className="text-center small">{r.quantity}</td>
                <td className="text-end small">{formatMoney(r.unitPrice)}</td>
                <td className="text-end fw-semibold small">{formatMoney(r.amount)}</td>
                <td className="text-center"><StatusBadge value={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="row justify-content-end mb-4">
          <div className="col-md-5">
            <table className="table table-sm">
              <tbody>
                <tr><td>Total Borrowed</td><td className="text-end fw-semibold">{formatMoney(totals.totalDebt)}</td></tr>
                <tr><td>Total Paid</td><td className="text-end text-success fw-semibold">{formatMoney(totals.totalPaid)}</td></tr>
                <tr className="table-warning fs-6 fw-bold">
                  <td>Remaining Balance</td>
                  <td className="text-end text-danger">{formatMoney(balance)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="row mt-5 pt-4 border-top">
          <div className="col-6 text-center"><div className="border-top pt-1 small">Customer Signature</div></div>
          <div className="col-6 text-center"><div className="border-top pt-1 small">Authorized Signature</div></div>
        </div>

        <div className="border-top mt-4 pt-3 text-center text-muted small">
          {company?.footerNote}
        </div>
      </div>
    </div>
  )
}
