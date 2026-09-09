import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Form, InputGroup, ListGroup } from 'react-bootstrap'
import { formatMoney } from '../../context/LanguageContext'

export default function ProductSelect({ products = [], value, onChange, placeholder = 'Search product by name, model or SKU...', showStock = false, size = 'sm' }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const blurRef = useRef(null)

  useEffect(() => () => clearTimeout(blurRef.current), [])

  const selected = products.find((p) => p._id === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode || '').includes(q) ||
      (p.modelName || '').toLowerCase().includes(q) ||
      (p.partType || '').toLowerCase().includes(q)
    )
  }, [products, query])

  const handlePick = (p) => {
    onChange(p._id)
    setQuery(p.name)
    setOpen(false)
    clearTimeout(blurRef.current)
  }

  const handleClear = () => {
    onChange('')
    setQuery('')
  }

  if (selected) {
    return (
      <div className="d-flex align-items-center gap-2 border rounded px-2 py-1 bg-light small">
        <i className="bi bi-box-seam text-muted" />
        <span className="text-truncate fw-semibold">{selected.name}</span>
        {showStock && <span className="text-muted flex-shrink-0">stock: {selected.quantity}</span>}
        <Button size="sm" variant="link" className="p-0 ms-auto text-danger text-decoration-none" onClick={handleClear} title="Clear selection">
          <i className="bi bi-x-lg" />
        </Button>
      </div>
    )
  }

  return (
    <div className="position-relative">
      <InputGroup size={size}>
        <InputGroup.Text><i className="bi bi-search" /></InputGroup.Text>
        <Form.Control
          placeholder={placeholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => { blurRef.current = setTimeout(() => setOpen(false), 150) }}
        />
      </InputGroup>
      {open && filtered.length > 0 && (
        <ListGroup className="position-absolute w-100 shadow-sm" style={{ zIndex: 30, maxHeight: 260, overflowY: 'auto' }}>
          {filtered.slice(0, 10).map((p) => (
            <ListGroup.Item action key={p._id} className="py-1 px-2 small" onMouseDown={(e) => e.preventDefault()} onClick={() => handlePick(p)}>
              <div className="d-flex justify-content-between gap-2 align-items-center">
                <span className="text-truncate"><i className="bi bi-box-seam me-1 text-muted" style={{ fontSize: '0.7rem' }} />{p.name}</span>
                <span className="text-muted flex-shrink-0" style={{ fontSize: '0.7rem' }}>
                  {formatMoney(p.sellingPrice)}
                  {showStock && <> · {p.quantity} stock</>}
                </span>
              </div>
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
      {open && filtered.length === 0 && (
        <div className="small text-muted border rounded-bottom px-2 py-1 bg-white shadow-sm position-absolute w-100" style={{ zIndex: 30 }}>No products found.</div>
      )}
    </div>
  )
}
