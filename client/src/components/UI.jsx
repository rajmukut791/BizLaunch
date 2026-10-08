import { useState } from 'react';
import { Package, LoaderCircle, ArrowRight, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/state';
export function Field({ label, name, type = 'text', ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input aria-label={label} name={name} type={type} {...props} />
    </label>
  );
}
export function Select({ label, children, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select aria-label={label} {...props}>
        {children}
      </select>
    </label>
  );
}
export function Textarea({ label, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea aria-label={label} rows={3} {...props} />
    </label>
  );
}
export function Form({ onSubmit, children, submit = 'Save changes', className = '', success }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const { notify } = useApp();
  return (
    <form
      className={'form ' + className}
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError('');
        const element = event.currentTarget;
        try {
          await onSubmit(Object.fromEntries(new FormData(element)), element);
          if (success) notify(success);
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>{children}</fieldset>
      {error && (
        <div className="error" role="alert">
          <AlertCircle size={17} />
          {error}
        </div>
      )}
      <button className="button primary" disabled={busy} type="submit">
        {busy ? (
          <>
            <LoaderCircle className="spin" size={18} /> Saving…
          </>
        ) : (
          <>
            {submit}
            <ArrowRight size={17} />
          </>
        )}
      </button>
    </form>
  );
}
export function Action({ onClick, children, className = 'button secondary', confirm }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <span className="action">
      <button
        type="button"
        className={className}
        disabled={busy}
        onClick={async () => {
          if (confirm && !window.confirm(confirm)) return;
          setBusy(true);
          setError('');
          try {
            await onClick();
          } catch (err) {
            setError(err.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Please wait…' : children}
      </button>
      {error && (
        <span className="error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
export function State({ resource, children }) {
  if (resource.loading)
    return (
      <div className="loading">
        <LoaderCircle className="spin" /> Loading…
      </div>
    );
  if (resource.error)
    return (
      <div className="empty">
        <AlertCircle />
        <h3>Unable to load</h3>
        <p role="alert">{resource.error}</p>
        <button className="button secondary" onClick={resource.reload}>
          Try again
        </button>
      </div>
    );
  return children;
}
export function Empty({ title = 'Nothing here yet', description, to, label }) {
  return (
    <div className="empty">
      <Package size={36} />
      <h3>{title}</h3>
      <p>{description}</p>
      {to && (
        <Link className="button primary" to={to}>
          {label}
        </Link>
      )}
    </div>
  );
}
export function Badge({ children }) {
  return <span className={'badge ' + String(children).toLowerCase()}>{children}</span>;
}
export function PageTitle({ eyebrow, title, description, action }) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function ProductImage({ product, className = '' }) {
  return (
    <div className={'product-image ' + className}>
      {product.images?.[0] ? (
        <img
          src={product.images[0]}
          alt={product.name}
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <Package size={64} strokeWidth={1} />
      )}
    </div>
  );
}
