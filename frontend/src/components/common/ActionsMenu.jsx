import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function ActionsMenu({ items = [], title = 'Actions', buttonClassName = '', menuClassName = '', align = 'end' }) {
  const [open, setOpen] = useState(false)
  const [origin, setOrigin] = useState(null)
  const [placement, setPlacement] = useState(null)
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  const visibleItems = items.filter((it) => it.show !== false)

  const toggle = () => {
    if (open) {
      setOpen(false)
      return
    }
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    setOrigin({ x: align === 'start' ? r.left : r.right, y: r.bottom })
    setPlacement(null)
    setOpen(true)
  }

  useLayoutEffect(() => {
    if (!open || !origin || !menuRef.current) return
    const w = menuRef.current.offsetWidth
    const h = menuRef.current.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    let top = origin.y + 6
    let left = align === 'start' ? origin.x : origin.x - w
    if (left < 8) left = 8
    if (left + w > vw - 8) left = vw - w - 8
    if (top + h > vh - 8) top = origin.y - h - 6
    if (top < 8) top = 8
    setPlacement({ top, left })
  }, [open, origin, align])

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (btnRef.current?.contains(e.target)) return
      if (menuRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    const closeOnScroll = () => setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', closeOnScroll, true)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', closeOnScroll, true)
    }
  }, [open])

  const select = (it) => () => {
    setOpen(false)
    it.onClick?.()
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title={title}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        className={`btn btn-light border no-caret btn-icon-action ${buttonClassName}`}
      >
        <i className={`bi bi-three-dots ${open ? 'menu-open' : ''}`} />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={title}
          className={`actions-menu ${menuClassName} ${placement ? 'is-placed' : ''}`}
          style={placement ? { top: placement.top, left: placement.left } : { top: 0, left: 0 }}
          data-actions-menu
        >
          {visibleItems.map((it, i) =>
            it.divider ? (
              <div key={`item-divider-${i}`} className="actions-menu-sep" />
            ) : (
              <button
                key={it.key || it.label}
                type="button"
                role="menuitem"
                className={`actions-menu-item ${it.danger ? 'is-danger' : ''} ${it.className || ''}`}
                onClick={select(it)}
              >
                <i className={`bi ${it.icon} ${it.iconClass || ''}`} />
                <span className="flex-grow-1">{it.label}</span>
              </button>
            )
          )}
        </div>,
        document.body
      )}
    </>
  )
}