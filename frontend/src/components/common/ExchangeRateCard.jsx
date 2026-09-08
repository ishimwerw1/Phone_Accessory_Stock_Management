import { Alert } from 'react-bootstrap'
import { convertAED, fmtUSD, fmtRWF, fmtDate } from '../../utils/currency'

export default function ExchangeRateCard({ aed, rates, quantity, showTotal, note }) {
  const amount = Number(aed || 0)
  const converted = amount > 0 ? convertAED(amount, rates || {}) : null
  const show = converted && converted.rwf > 0

  if (!show) {
    return amount > 0 ? (
      <div className="small text-muted mt-2" style={{ background: '#f4f7fb', border: '1px solid #e2e8f0', borderRadius: 6, padding: '0.5rem 0.75rem' }}>
        <i className="bi bi-arrow-repeat me-1" />Fetching latest exchange rate…
      </div>
    ) : null
  }

  const total = showTotal && Number(quantity) > 0 ? converted.rwf * Number(quantity) : null

  return (
    <div>
      {rates?.warning && (
        <Alert variant="warning" className="py-1 px-2 small mt-2 mb-2"><i className="bi bi-exclamation-triangle me-1" />{rates.warning}</Alert>
      )}
      <div className="mt-2 rounded small" style={{ background: '#f4f7fb', border: '1px solid #e2e8f0' }}>
        <div className="d-flex justify-content-between px-3 py-1">
          <span className="text-muted">Original Purchase Price</span>
          <span className="fw-semibold">{amount.toLocaleString()} AED</span>
        </div>
        <div className="d-flex justify-content-between px-3 py-1 border-top">
          <span className="text-muted">Equivalent USD</span>
          <span className="fw-semibold">{fmtUSD(converted.usd)}</span>
        </div>
        <div className="d-flex justify-content-between px-3 py-1 border-top">
          <span className="text-muted">Equivalent RWF</span>
          <span className="fw-semibold">{fmtRWF(converted.rwf)}</span>
        </div>
        <div className="d-flex justify-content-between px-3 py-1 border-top text-muted">
          <span>Exchange Rate Used</span>
          <span>1 AED = {converted.aedToRwf.toLocaleString(undefined, { maximumFractionDigits: 2 })} RWF</span>
        </div>
        <div className="d-flex justify-content-between px-3 py-1 border-top text-muted">
          <span>Last Updated</span>
          <span>{fmtDate(rates?.updatedAt)}{rates?.provider ? ` · ${rates.provider}` : ''}</span>
        </div>
        {total != null && (
          <div className="d-flex justify-content-between px-3 py-1 border-top">
            <span className="text-muted">Total Buying Cost ({Number(quantity)} × {converted.rwf.toLocaleString(undefined, { maximumFractionDigits: 2 })} RWF)</span>
            <span className="fw-semibold">{fmtRWF(total)}</span>
          </div>
        )}
        <div className="d-flex justify-content-between px-3 py-1 border-top" style={{ background: '#eef6ef' }}>
          <span className="text-muted fw-semibold">FINAL BUYING PRICE{showTotal ? ' (per unit)' : ''}</span>
          <span className="fw-bold text-success">{fmtRWF(converted.rwf)}</span>
        </div>
      </div>
      {note && <div className="small text-muted mt-1">{note}</div>}
    </div>
  )
}