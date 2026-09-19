import { useEffect, useState } from 'react'
import { Card, Row, Col, Table, Button, Form, Modal, Nav, Badge, Dropdown } from 'react-bootstrap'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import api, { getError } from '../../api/client'
import StatusBadge from '../../components/common/StatusBadge'
import Loading from '../../components/common/Loading'
import LoanItemActions from '../../components/loans/LoanItemActions'
import { formatMoney } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'

const TABS = [
  { key: 'overview', label: 'Overview', icon: 'bi-grid' },
  { key: 'products', label: 'All Products', icon: 'bi-box-seam' },
  { key: 'paid', label: 'Paid Products', icon: 'bi-check-circle' },
  { key: 'unpaid', label: 'Unpaid Products', icon: 'bi-exclamation-circle' },
  { key: 'payments', label: 'Payment History', icon: 'bi-clock-history' },
]

export default function CustomerLoanAccount() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { hasPermission } = useAuth()
  const [data, setData] = useState(null)
  const [company, setCompany] = useState(null)
  const [products, setProducts] = useState([])
  const [tab, setTab] = useState(searchParams.get('tab') || 'overview')
  const [showEditCustomer, setShowEditCustomer] = useState(false)
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', email: '', address: '' })
  const [savingCustomer, setSavingCustomer] = useState(false)

  const canRepay = hasPermission('loans.repay') || hasPermission('payments.create') || hasPermission('loans.update')
  const canEdit = hasPermission('loans.update')

  const load = () => {
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
  }
  useEffect(load, [customerId, navigate])

  useEffect(() => {
    api.get('/products', { params: { limit: 200, status: 'ACTIVE' } })
      .then((r) => setProducts(r.data.data.products))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (searchParams.get('print') === '1') {
      setTimeout(() => window.print(), 400)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  if (!data) return <Loading full />
  const { accountName, accountPhone, accountAddress, accountEmail, customer, transactions, products: loanProducts, paidProducts, unpaidProducts, totals, remainingDebt, repayments } = data
  const balance = totals.remainingBalance

  const openTab = (key) => { setTab(key); setSearchParams({ tab: key }, { replace: true }) }

  const openEditCustomer = () => {
    if (!customer) return
    setCustomerForm({ name: customer.name || '', phone: customer.phone || '', email: customer.email || '', address: customer.address || '' })
    setShowEditCustomer(true)
  }

  const saveCustomer = async () => {
    if (!customerForm.name.trim() || !customerForm.phone.trim()) return
    setSavingCustomer(true)
    try {
      await api.put(`/customers/${customer._id}`, customerForm)
      setShowEditCustomer(false)
      load()
    } catch (err) {
      alert(getError(err))
    } finally {
      setSavingCustomer(false)
    }
  }

  const customerMenu = (
    <Dropdown align="end" popperConfig={{ strategy: 'fixed' }}>
      <Dropdown.Toggle variant="light" className="border no-caret btn-icon-action" title="Customer actions">
        <i className="bi bi-three-dots" />
      </Dropdown.Toggle>
      <Dropdown.Menu className="shadow-sm" style={{ minWidth: 250 }}>
        <Dropdown.Item onClick={() => openTab('overview')}><i className="bi bi-cash-coin me-2" />View Loan Details</Dropdown.Item>
        <Dropdown.Item onClick={() => openTab('products')}><i className="bi bi-box-seam me-2" />View All Products</Dropdown.Item>
        <Dropdown.Item onClick={() => openTab('paid')}><i className="bi bi-check-circle me-2" />View Paid Products</Dropdown.Item>
        <Dropdown.Item onClick={() => openTab('unpaid')}><i className="bi bi-exclamation-circle me-2" />View Unpaid Products</Dropdown.Item>
        <Dropdown.Item onClick={() => openTab('payments')}><i className="bi bi-clock-history me-2" />Payment History</Dropdown.Item>
        <Dropdown.Divider />
        {customer && <Dropdown.Item onClick={openEditCustomer}><i className="bi bi-person-gear me-2" />Edit Customer</Dropdown.Item>}
        <Dropdown.Item onClick={() => window.print()}><i className="bi bi-printer me-2" />Print Loan Invoice</Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  )

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2 no-print">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}>
          <i className="bi bi-cash-coin me-2" />Customer Loan Account — {accountName}
        </h4>
        <div className="d-flex gap-2 flex-wrap">
          <Button variant="primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />Print Loan Invoice</Button>
          <Button variant="light" className="border" onClick={() => navigate('/loans')}><i className="bi bi-arrow-left me-1" />Back to Loans</Button>
        </div>
      </div>

      <Row className="g-3 mb-3 no-print">
        <Col md={3}><Card body className="text-center"><div className="text-muted small">Total Loan</div><div className="fs-5 fw-bold">{formatMoney(totals.totalDebt)}</div></Card></Col>
        <Col md={3}><Card body className="text-center"><div className="text-muted small">Total Paid</div><div className="fs-5 fw-bold text-success">{formatMoney(totals.totalPaid)}</div></Card></Col>
        <Col md={3}><Card body className="text-center bg-light"><div className="text-muted small">Remaining Debt</div><div className={`fs-5 fw-bold ${balance > 0 ? 'text-danger' : 'text-success'}`}>{formatMoney(balance)}</div></Card></Col>
        <Col md={3}><Card body className="text-center"><div className="text-muted small">Loan Status</div><div className="fs-6 fw-bold"><StatusBadge value={balance > 0 ? (remainingDebt > 0 ? 'PARTIALLY_PAID' : 'PAID') : 'PAID'} /></div></Card></Col>
      </Row>

      <Card className="mb-3 no-print">
        <Card.Body className="py-3">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div className="d-flex flex-wrap gap-4 small">
              <span><i className="bi bi-person me-1 text-muted" /><strong>{accountName}</strong></span>
              <span><i className="bi bi-telephone me-1 text-muted" /><code>{accountPhone || '-'}</code></span>
              {accountAddress && <span><i className="bi bi-geo-alt me-1 text-muted" />{accountAddress}</span>}
              {accountEmail && <span><i className="bi bi-envelope me-1 text-muted" />{accountEmail}</span>}
              <span><i className="bi bi-receipt me-1 text-muted" />{totals.transactionCount} loan transaction(s)</span>
              <StatusBadge value={balance > 0 ? 'ACTIVE' : 'PAID'} />
            </div>
            {customer && (
              <div className="d-flex gap-2 align-items-center">
                <Button size="sm" variant="outline-primary" onClick={openEditCustomer}><i className="bi bi-person-gear me-1" />Edit Customer</Button>
                {customerMenu}
              </div>
            )}
          </div>
        </Card.Body>
      </Card>

      {/* Tabs */}
      <div className="no-print mb-3">
        <Nav variant="pills" className="flex-nowrap overflow-auto" style={{ gap: '.35rem' }}>
          {TABS.map((t) => (
            <Nav.Item key={t.key}>
              <Nav.Link active={tab === t.key} onClick={() => openTab(t.key)} className={tab === t.key ? 'text-white' : ''} style={{ whiteSpace: 'nowrap' }}>
                <i className={`bi ${t.icon} me-1`} />{t.label}
                {t.key === 'paid' && <Badge bg="" className="badge-soft-success ms-1">{paidProducts.length}</Badge>}
                {t.key === 'unpaid' && <Badge bg="" className="badge-soft-warning ms-1">{unpaidProducts.length}</Badge>}
              </Nav.Link>
            </Nav.Item>
          ))}
        </Nav>
      </div>

      {tab === 'overview' && <OverviewTab data={data} products={products} canRepay={canRepay} canEdit={canEdit} onChanged={load} />}
      {tab === 'products' && <ProductsTab products={loanProducts} payments={data.repayments} productsCatalogue={products} canRepay={canRepay} canEdit={canEdit} onChanged={load} />}
      {tab === 'paid' && <PaidTab products={paidProducts} payments={data.repayments} productsCatalogue={products} canRepay={canRepay} canEdit={canEdit} onChanged={load} />}
      {tab === 'unpaid' && <UnpaidTab products={unpaidProducts} remainingDebt={remainingDebt} payments={data.repayments} productsCatalogue={products} canRepay={canRepay} canEdit={canEdit} onChanged={load} />}
      {tab === 'payments' && <PaymentsTab repayments={repayments} />}

      {/* Printable loan invoice */}
      <Card className="invoice-sheet shadow-sm mt-4">
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
            <h4 className="fw-bold mb-0">LOAN AGREEMENT</h4>
            <div className="small text-muted">Customer Loan Account</div>
            <div className="small text-muted">Statement as of {new Date().toLocaleDateString()}</div>
          </div>
        </div>

        <div className="row mb-4">
          <div className="col-6">
            <strong className="small text-uppercase text-muted d-block mb-1">Borrower</strong>
            <div className="fw-semibold">{accountName}</div>
            {accountPhone && <div className="small text-muted">{accountPhone}</div>}
            {accountAddress && <div className="small text-muted">{accountAddress}</div>}
            {accountEmail && <div className="small text-muted">{accountEmail}</div>}
          </div>
          <div className="col-6 text-end">
            <div className="small"><span className="text-muted">Loan Transactions:</span> <strong>{totals.transactionCount}</strong></div>
            <div className="small"><span className="text-muted">Total Repayments:</span> <strong>{repayments.length}</strong></div>
          </div>
        </div>

        <strong className="small text-uppercase text-muted d-block mb-1">Products (by loan)</strong>
        <table className="table table-sm table-bordered">
          <thead style={{ background: '#f8f9fb' }}>
            <tr>
              <th>#</th><th>Loan</th><th>Product</th><th className="text-center">Qty</th>
              <th className="text-end">Unit Price</th><th className="text-end">Total</th>
              <th className="text-end">Paid</th><th className="text-end">Remaining</th><th className="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {loanProducts.length === 0 && <tr><td colSpan={9} className="text-center text-muted py-3">No loan products</td></tr>}
            {loanProducts.map((it, i) => (
              <tr key={it.itemId || i}>
                <td>{i + 1}</td>
                <td><code className="small">{it.loanNumber}</code></td>
                <td className="small">{it.name}{it.sku && <span className="text-muted"> · {it.sku}</span>}</td>
                <td className="text-center">{it.quantity}</td>
                <td className="text-end">{formatMoney(it.price)}</td>
                <td className="text-end fw-semibold">{formatMoney(it.total)}</td>
                <td className="text-end text-success">{formatMoney(it.amountPaid)}</td>
                <td className="text-end text-danger">{formatMoney(it.outstanding)}</td>
                <td className="text-center"><StatusBadge value={it.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="row justify-content-end mb-4">
          <div className="col-md-5">
            <table className="table table-sm">
              <tbody>
                <tr><td>Total Loan</td><td className="text-end fw-semibold">{formatMoney(totals.totalDebt)}</td></tr>
                <tr><td>Total Paid</td><td className="text-end text-success fw-semibold">{formatMoney(totals.totalPaid)}</td></tr>
                <tr className="table-warning fs-6 fw-bold">
                  <td>Remaining Debt</td>
                  <td className="text-end text-danger">{formatMoney(balance)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <strong className="small text-uppercase text-muted d-block mb-1">Repayment History</strong>
        <table className="table table-sm table-bordered">
          <thead style={{ background: '#f8f9fb' }}>
            <tr><th>Date</th><th>Product</th><th>Loan</th><th>Amount</th><th>Method</th><th>Remaining</th><th>By</th></tr>
          </thead>
          <tbody>
            {repayments.length === 0 && <tr><td colSpan={7} className="text-center text-muted py-3">No repayments yet</td></tr>}
            {repayments.map((p) => (
              <tr key={p._id}>
                <td className="small">{new Date(p.date || p.createdAt).toLocaleString()}</td>
                <td className="small">{p.itemName || '-'}</td>
                <td className="small"><code>{p.loanNumber}</code></td>
                <td className="fw-semibold text-success">{formatMoney(p.amount)}</td>
                <td><StatusBadge value={p.method} /></td>
                <td className="small">{formatMoney(p.remainingAfter ?? p.newOutstanding)}</td>
                <td className="small">{p.receivedBy?.name || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="row mt-5 pt-4 border-top">
          <div className="col-6 text-center"><div className="border-top pt-1 small">Borrower Signature</div></div>
          <div className="col-6 text-center"><div className="border-top pt-1 small">Authorized Signature</div></div>
        </div>

        <div className="border-top mt-4 pt-3 text-center text-muted small">
          {company?.footerNote}
        </div>
      </Card>

      {/* Edit customer */}
      <Modal show={showEditCustomer} onHide={() => !savingCustomer && setShowEditCustomer(false)} centered>
        <Form onSubmit={(e) => { e.preventDefault(); saveCustomer() }}>
          <Modal.Header closeButton={!savingCustomer}><Modal.Title className="fs-6 fw-bold"><i className="bi bi-person-gear me-2" />Edit Customer</Modal.Title></Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-2">
              <Form.Label className="small fw-semibold">Customer Name *</Form.Label>
              <Form.Control value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} required />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label className="small fw-semibold">Phone *</Form.Label>
              <Form.Control value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} required />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label className="small fw-semibold">Email</Form.Label>
              <Form.Control value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} />
            </Form.Group>
            <Form.Group>
              <Form.Label className="small fw-semibold">Address</Form.Label>
              <Form.Control value={customerForm.address} onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" type="button" onClick={() => setShowEditCustomer(false)} disabled={savingCustomer}>Cancel</Button>
            <Button type="submit" disabled={savingCustomer}>
              {savingCustomer ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</> : 'Save Changes'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  )
}

function LoanItemTable({ products, productsCatalogue = [], payments = [], canRepay, canEdit, onChanged, showLoan = true }) {
  return (
    <div className="table-responsive">
      <Table size="sm" hover responsive className="mb-0 align-middle bg-white">
        <thead>
          <tr>
            <th>Product</th>
            {showLoan && <th>Loan</th>}
            <th className="text-center">Qty</th>
            <th className="text-end">Unit Price</th>
            <th className="text-end">Total</th>
            <th className="text-end">Paid</th>
            <th className="text-end">Remaining</th>
            <th className="text-center">Status</th>
            <th className="text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.length === 0 && (
            <tr><td colSpan={9} className="text-center text-muted py-5"><i className="bi bi-inbox" /></td></tr>
          )}
          {products.map((it) => {
            const itemId = it.itemId || it._id
            return (
              <tr key={itemId}>
                <td>
                  <div className="fw-semibold small">{it.name}</div>
                  {it.sku && <small className="text-muted">{it.sku}</small>}
                  {it.returned && <Badge bg="" className="badge-soft-secondary ms-1">Returned</Badge>}
                </td>
                {showLoan && <td><code className="small">{it.loanNumber}</code></td>}
                <td className="text-center">{it.quantity}</td>
                <td className="text-end">{formatMoney(it.price)}</td>
                <td className="text-end fw-semibold">{formatMoney(it.total)}</td>
                <td className="text-end text-success fw-semibold">{formatMoney(it.amountPaid)}</td>
                <td className="text-end fw-semibold text-danger">{formatMoney(it.outstanding)}</td>
                <td className="text-center"><StatusBadge value={it.status} /></td>
                <td className="text-center">
                  <LoanItemActions
                    loan={{ _id: it.loanId, loanNumber: it.loanNumber }}
                    item={it}
                    products={productsCatalogue}
                    payments={payments}
                    canRepay={canRepay}
                    canEdit={canEdit}
                    onChanged={onChanged}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </Table>
    </div>
  )
}

function OverviewTab({ data, products, canRepay, canEdit, onChanged }) {
  const { transactions, repayments } = data
  return (
    <>
      <Row className="g-3 no-print">
        <Col lg={7}>
          <Card>
            <Card.Header className="bg-white fw-semibold small"><i className="bi bi-box-seam me-2 text-primary" />All Loan Products</Card.Header>
            <Card.Body className="p-0">
              <LoanItemTable products={data.products} productsCatalogue={products} payments={data.repayments} canRepay={canRepay} canEdit={canEdit} onChanged={onChanged} />
            </Card.Body>
          </Card>
        </Col>
        <Col lg={5}>
          <Card className="mb-3">
            <Card.Header className="bg-white fw-semibold small"><i className="bi bi-cash-coin me-2 text-danger" />Debt Summary</Card.Header>
            <Card.Body>
              <div className="d-flex justify-content-between border-bottom py-2"><span className="text-muted small">Total Loan</span><strong>{formatMoney(data.totals.totalDebt)}</strong></div>
              <div className="d-flex justify-content-between border-bottom py-2"><span className="text-muted small">Total Paid</span><strong className="text-success">{formatMoney(data.totals.totalPaid)}</strong></div>
              <div className="d-flex justify-content-between border-bottom py-2"><span className="text-muted small">Remaining Debt</span><strong className="text-danger">{formatMoney(data.remainingDebt)}</strong></div>
              <div className="d-flex justify-content-between pt-2"><span className="text-muted small">Fully paid products</span><strong>{data.paidProducts.length}</strong></div>
              <div className="d-flex justify-content-between py-1"><span className="text-muted small">Unpaid / partial products</span><strong>{data.unpaidProducts.length}</strong></div>
            </Card.Body>
          </Card>
          <Card>
            <Card.Header className="bg-white fw-semibold small"><i className="bi bi-receipt me-2 text-muted" />Loan Transactions ({transactions.length})</Card.Header>
            <div className="table-responsive">
              <Table size="sm" className="mb-0 align-middle">
                <thead><tr><th>Loan</th><th className="text-end">Total</th><th className="text-end">Paid</th><th className="text-end">Remaining</th><th>Status</th></tr></thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t._id}>
                      <td><code className="small">{t.loanNumber}</code></td>
                      <td className="text-end">{formatMoney(t.totalAmount)}</td>
                      <td className="text-end text-success">{formatMoney(t.amountPaid)}</td>
                      <td className="text-end text-danger">{formatMoney(t.outstanding)}</td>
                      <td><StatusBadge value={t.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
          {repayments.length > 0 && (
            <Card className="mt-3">
              <Card.Header className="bg-white fw-semibold small"><i className="bi bi-clock-history me-2 text-success" />Recent Payments ({repayments.length})</Card.Header>
              <div className="table-responsive">
                <Table size="sm" className="mb-0 align-middle">
                  <thead><tr><th>Date</th><th className="text-end">Amount</th></tr></thead>
                  <tbody>
                    {repayments.slice(0, 8).map((p) => (
                      <tr key={p._id}>
                        <td className="small">{new Date(p.date || p.createdAt).toLocaleDateString()}</td>
                        <td className="text-end fw-semibold text-success">{formatMoney(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card>
          )}
        </Col>
      </Row>
    </>
  )
}

function ProductsTab({ products, payments = [], productsCatalogue, canRepay, canEdit, onChanged }) {
  return (
    <Card body>
      <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
        <h6 className="fw-bold mb-0"><i className="bi bi-box-seam me-2" />All Loan Products <Badge bg="" className="badge-soft-primary">{products.length}</Badge></h6>
        <span className="small text-muted">Total loan value: <strong>{formatMoney(products.reduce((s, p) => s + p.total, 0))}</strong></span>
      </div>
      <LoanItemTable products={products} payments={payments} productsCatalogue={productsCatalogue} canRepay={canRepay} canEdit={canEdit} onChanged={onChanged} />
    </Card>
  )
}

function PaidTab({ products, payments = [], productsCatalogue, canRepay, canEdit, onChanged }) {
  const total = products.reduce((s, p) => s + (p.amountPaid || 0), 0)
  return (
    <Card body>
      <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
        <h6 className="fw-bold mb-0"><i className="bi bi-check-circle me-2 text-success" />Paid Products <Badge bg="" className="badge-soft-success">{products.length}</Badge></h6>
        <span className="small text-muted">Total Paid: <strong className="text-success">{formatMoney(total)}</strong></span>
      </div>
      <LoanItemTable products={products} payments={payments} productsCatalogue={productsCatalogue} canRepay={canRepay} canEdit={canEdit} onChanged={onChanged} />
    </Card>
  )
}

function UnpaidTab({ products, remainingDebt, payments = [], productsCatalogue, canRepay, canEdit, onChanged }) {
  return (
    <Card body>
      <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
        <h6 className="fw-bold mb-0"><i className="bi bi-exclamation-circle me-2 text-danger" />Unpaid Products <Badge bg="" className="badge-soft-danger">{products.length}</Badge></h6>
        <span className="small text-muted">Remaining Debt: <strong className="text-danger">{formatMoney(remainingDebt)}</strong></span>
      </div>
      <LoanItemTable products={products} payments={payments} productsCatalogue={productsCatalogue} canRepay={canRepay} canEdit={canEdit} onChanged={onChanged} />
    </Card>
  )
}

function PaymentsTab({ repayments }) {
  const total = repayments.reduce((s, p) => s + (p.amount || 0), 0)
  return (
    <Card body>
      <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
        <h6 className="fw-bold mb-0"><i className="bi bi-clock-history me-2 text-success" />Payment History <Badge bg="" className="badge-soft-primary">{repayments.length}</Badge></h6>
        <span className="small text-muted">Total received: <strong className="text-success">{formatMoney(total)}</strong></span>
      </div>
      <div className="table-responsive">
        <Table size="sm" hover responsive className="mb-0 align-middle bg-white">
          <thead>
            <tr>
              <th>Date</th><th>Product</th><th>Loan</th><th className="text-end">Amount</th>
              <th>Method</th><th>Ref</th><th className="text-end">Remaining</th><th>Received By</th>
            </tr>
          </thead>
          <tbody>
            {repayments.length === 0 && <tr><td colSpan={8} className="text-center text-muted py-5"><i className="bi bi-inbox" /></td></tr>}
            {repayments.map((p) => (
              <tr key={p._id}>
                <td className="small">{new Date(p.date || p.createdAt).toLocaleString()}</td>
                <td className="small">{p.itemName || <em className="text-muted">General</em>}</td>
                <td className="small"><code>{p.loanNumber || '-'}</code></td>
                <td className="text-end fw-semibold text-success">{formatMoney(p.amount)}</td>
                <td><StatusBadge value={p.method} /></td>
                <td className="small">{p.reference || '-'}</td>
                <td className="text-end small">{formatMoney(p.remainingAfter ?? p.newOutstanding)}</td>
                <td className="small">{p.receivedBy?.name || '-'}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </Card>
  )
}