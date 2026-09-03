import { useCallback, useEffect, useState } from 'react'
import { Card, Button, Form, Badge, Alert } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import api, { getError } from '../../api/client'
import DataTable from '../../components/common/DataTable'
import StatusBadge from '../../components/common/StatusBadge'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import ProductForm from './ProductForm'
import { useAuth } from '../../context/AuthContext'

export default function Products() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [stockStatus, setStockStatus] = useState('')
  const [sort, setSort] = useState('-createdAt')
  const [categories, setCategories] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deactivating, setDeactivating] = useState(null)
  const [toast, setToast] = useState(null)
  const { hasPermission } = useAuth()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 15 }
      if (search) params.search = search
      if (category) params.category = category
      if (stockStatus) params.stockStatus = stockStatus
      const { data } = await api.get('/products', { params })
      setProducts(data.data.products)
      setPages(Math.ceil(data.data.total / 15) || 1)
      setTotal(data.data.total)
    } catch (err) {
      setToast({ type: 'danger', msg: getError(err) })
    } finally {
      setLoading(false)
    }
  }, [page, search, category, stockStatus])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    api.get('/categories').then((r) => setCategories(r.data.data)).catch(() => {})
  }, [])
  useEffect(() => {
    const refresh = () => load()
    window.addEventListener('focus', refresh)
    window.addEventListener('stock-updated', refresh)
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh() })
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('stock-updated', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [load])

  const sorted = useCallback((rows) => {
    if (!sort) return rows
    const [dir, key] = sort.startsWith('-') ? ['desc', sort.slice(1)] : ['asc', sort]
    const mul = dir === 'asc' ? 1 : -1
    return [...(rows || [])].sort((a, b) => {
      const av = a[key] == null ? '' : a[key]
      const bv = b[key] == null ? '' : b[key]
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mul
      return String(av).localeCompare(String(bv)) * mul
    })
  }, [sort])

  const deactivate = async () => {
    try {
      await api.delete(`/products/${deactivating._id}`)
      setDeactivating(null)
      load()
    } catch (err) {
      setToast({ type: 'danger', msg: getError(err) })
      setDeactivating(null)
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}>
          <i className="bi bi-box-seam me-2" />Products <Badge bg="" className="badge-soft-primary">{total}</Badge>
        </h4>
        {hasPermission('products.create') && (
          <Button onClick={() => { setEditing(null); setShowForm(true) }}>
            <i className="bi bi-plus-lg me-1" />Add Product
          </Button>
        )}
      </div>

      {toast && <Alert variant={toast.type} dismissible onClose={() => setToast(null)} className="py-2 small">{toast.msg}</Alert>}

      <Card body>
        <DataTable
          columns={[
            { key: 'image', label: '', render: (p) => p.image ? <img src={p.image} alt="" style={{ width: 42, height: 42, objectFit: 'contain', borderRadius: 6, background: '#f6f8fa' }} /> : <span className="d-inline-flex align-items-center justify-content-center" style={{ width: 42, height: 42, background: '#eef2f7', borderRadius: 6 }}><i className="bi bi-box text-secondary" /></span> },
            { key: 'name', label: 'Product', render: (p) => (
              <Link to={`/products/${p._id}`} className="text-decoration-none fw-semibold" style={{ color: '#0d3b66' }}>{p.name}</Link>
            )},
            { key: 'sku', label: 'SKU', render: (p) => <code className="small">{p.sku}</code> },
            { key: 'category', label: 'Category', render: (p) => <span className="small">{p.category?.parent ? `${p.category.parent.name} → ${p.category.name}` : p.category?.name || '-'}</span> },
            { key: 'buyingPrice', label: 'Buy', render: (p) => `${Number(p.buyingPrice).toLocaleString()} RWF` },
            { key: 'sellingPrice', label: 'Sell', render: (p) => `${Number(p.sellingPrice).toLocaleString()} RWF` },
            { key: 'quantity', label: 'Stock', render: (p) => (
              <span className={`fw-semibold ${p.quantity === 0 ? 'text-danger' : p.quantity <= p.minStock ? 'text-warning' : ''}`}>
                {p.quantity}
              </span>
            )},
            { key: 'state', label: 'Status', render: (p) => <StatusBadge value={p.stockStatus} /> },
            { key: 'actions', label: 'Actions', render: (p) => (
              <div className="d-flex gap-1">
                <Link to={`/products/${p._id}`} className="btn btn-sm btn-light border"><i className="bi bi-eye" /></Link>
                {hasPermission('products.update') && (
                  <Button size="sm" variant="light" className="border" onClick={() => { setEditing(p); setShowForm(true) }}>
                    <i className="bi bi-pencil" />
                  </Button>
                )}
                {hasPermission('products.delete') && p.status === 'ACTIVE' && (
                  <Button size="sm" variant="light" className="border text-danger" onClick={() => setDeactivating(p)}>
                    <i className="bi bi-trash" />
                  </Button>
                )}
              </div>
            )}
          ]}
          data={sorted(products)}
          loading={loading}
          page={page}
          pages={pages}
          total={total}
          onPageChange={setPage}
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1) }}
          searchPlaceholder="Search name, SKU, barcode..."
          toolbar={
            <>
              <Form.Select size="sm" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }} style={{ width: 190 }}>
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>{c.parent ? `— ${c.name}` : c.name}</option>
                ))}
              </Form.Select>
              <Form.Select size="sm" value={stockStatus} onChange={(e) => { setStockStatus(e.target.value); setPage(1) }} style={{ width: 150 }}>
                <option value="">All Stock</option>
                <option value="LOW_STOCK">Low Stock</option>
                <option value="OUT_OF_STOCK">Out of Stock</option>
              </Form.Select>
              <Form.Select size="sm" value={sort} onChange={(e) => setSort(e.target.value)} style={{ width: 160 }}>
                <option value="-createdAt">Newest first</option>
                <option value="name">Name A-Z</option>
                <option value="-quantity">Highest stock</option>
                <option value="quantity">Lowest stock</option>
                <option value="-sellingPrice">Highest price</option>
              </Form.Select>
            </>
          }
        />
      </Card>

      <ProductForm show={showForm} product={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load() }} />

      <ConfirmDialog
        show={Boolean(deactivating)}
        title="Deactivate Product"
        message={`Are you sure you want to deactivate "${deactivating?.name}"? It will no longer be sellable.`}
        confirmLabel="Deactivate"
        loading={false}
        onClose={() => setDeactivating(null)}
        onConfirm={deactivate}
      />
    </div>
  )
}
