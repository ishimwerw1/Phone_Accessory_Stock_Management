import { Card, Row, Col } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'

const REPORTS = [
  { to: '/reports/sales', icon: 'bi-graph-up-arrow', labelKey: 'salesReports', desc: 'Revenue, payment methods, top products, cashier & customer performance.' },
  { to: '/reports/stock', icon: 'bi-boxes', labelKey: 'stockReports', desc: 'Current stock levels, low stock and out-of-stock alerts.' },
  { to: '/reports/financial', icon: 'bi-bank', labelKey: 'financialReports', desc: 'Income statement summary, gross profit and credit outstanding.' },
  { to: '/reports/customers', icon: 'bi-person-lines-fill', labelKey: 'customerReports', desc: 'Top customers by spend and outstanding debt.' },
  { to: '/reports/loans', icon: 'bi-credit-card-2-front', labelKey: 'loanReports', desc: 'Loan totals, repayment rate and overdue summaries.' },
  { to: '/reports/expenses', icon: 'bi-wallet2', labelKey: 'expenseReports', desc: 'Total expenses by category, user and date.' },
  { to: '/reports/purchases', icon: 'bi-bag', labelKey: 'purchaseReports', desc: 'Purchases, supplier debts, overdue purchases and payments.' },
]

export default function ReportsIndex() {
  const { t } = useLanguage()

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}><i className="bi bi-graph-up-arrow me-2" />{t('reports')}</h4>
      </div>
      <p className="text-muted mb-4" style={{ maxWidth: 560 }}>
        Select a report to view its detailed breakdown.
      </p>

      <Row className="g-3">
        {REPORTS.map((r) => (
          <Col key={r.to} xs={12} sm={6} lg={4}>
            <Link to={r.to} style={{ textDecoration: 'none' }}>
              <Card className="h-100 report-card" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12, transition: 'transform .12s ease, box-shadow .12s ease' }}>
                <Card.Body className="py-4 px-3">
                  <div className="d-flex align-items-start gap-3">
                    <div className="d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(13,59,102,.08)', color: '#0d3b66' }}>
                      <i className={`bi ${r.icon}`} style={{ fontSize: '1.25rem' }} />
                    </div>
                    <div>
                      <div className="fw-bold mb-1" style={{ color: '#0d3b66' }}>{t(r.labelKey)}</div>
                      <div className="text-muted small" style={{ fontSize: '0.8rem' }}>{r.desc}</div>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </Link>
          </Col>
        ))}
      </Row>

      <style>{`
        .report-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,.12) !important; }
      `}</style>
    </div>
  )
}
