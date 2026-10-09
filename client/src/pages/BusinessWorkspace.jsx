import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/state';
import { useResource } from '../lib/hooks';
import { api } from '../lib/api';
import { State, PageTitle, Field, Select, Textarea, Badge, Form, Action } from '../components/UI';
function BrandingUpload({ target, label, reload }) {
  return (
    <Form
      submit={'Upload ' + label.toLowerCase()}
      success={label + ' uploaded'}
      onSubmit={async (_, form) => {
        const data = new FormData(form);
        data.set('target', target);
        await api('/seller/business/images', { method: 'POST', body: data });
        reload();
      }}
    >
      <Field
        label={label}
        name="image"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        required
      />
    </Form>
  );
}
export default function BusinessWorkspace() {
  const resource = useResource('/seller/business'),
    { user } = useApp(),
    [step, setStep] = useState(0),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [assets, setAssets] = useState({}),
    [draft, setDraft] = useState({
      name: '',
      slug: '',
      description: '',
      phone: user.phone || '',
      email: user.email,
      address: '',
      type: 'retail',
      category: '',
      theme: 'sage',
      currency: 'BDT',
      deliveryOptions: 'Standard delivery',
      returnPolicy: '',
      website: '',
      facebook: '',
      instagram: '',
    });
  const labels = {
    name: 'Business name',
    description: 'Tell your story',
    phone: 'Business phone',
    email: 'Business email',
    address: 'Business address',
    category: 'Business category',
    type: 'Business type',
    deliveryOptions: 'Delivery options',
    returnPolicy: 'Return policy',
  };
  const steps = ['Your business', 'Brand identity', 'Contact details', 'Store setup'];
  const body = (values) => {
    const { website, facebook, instagram, ...rest } = values;
    return { ...rest, socialLinks: { website, facebook, instagram } };
  };
  const field = (label, name, props = {}) => (
    <Field
      label={label}
      name={name}
      value={draft[name]}
      onChange={(e) => setDraft({ ...draft, [name]: e.target.value })}
      {...props}
    />
  );
  return (
    <>
      <PageTitle
        eyebrow="YOUR BRAND'S HOME"
        title="My business"
        description="A guided launch, and a home for your store’s identity."
      />
      <State resource={resource}>
        {resource.data &&
          (resource.data.business ? (
            <>
              <section className="panel">
                <div className="section-heading">
                  <h2>{resource.data.business.name}</h2>
                  <Badge>{resource.data.business.verification}</Badge>
                </div>
                <p>
                  {resource.data.business.verificationNote || 'Platform-level store verification'}
                </p>
                <Link className="text-link" to={'/stores/' + resource.data.business.slug}>
                  Open storefront ↗
                </Link>
                {resource.data.business.verification === 'rejected' && (
                  <Action
                    onClick={async () => {
                      await api('/seller/business', { method: 'PATCH', body: { resubmit: true } });
                      resource.reload();
                    }}
                  >
                    Resubmit for verification
                  </Action>
                )}
              </section>
              <div className="management-grid">
                <section className="panel">
                  <Form
                    submit="Save business details"
                    success="Business details saved"
                    onSubmit={async (values) => {
                      await api('/seller/business', { method: 'PATCH', body: body(values) });
                      resource.reload();
                    }}
                  >
                    {[
                      'name',
                      'description',
                      'phone',
                      'email',
                      'address',
                      'category',
                      'type',
                      'deliveryOptions',
                      'returnPolicy',
                    ].map((name) =>
                      name === 'description' || name === 'address' || name === 'returnPolicy' ? (
                        <Textarea
                          key={name}
                          label={labels[name]}
                          name={name}
                          defaultValue={resource.data.business[name]}
                          maxLength={name === 'address' ? 300 : 2000}
                          required={name === 'address'}
                        />
                      ) : (
                        <Field
                          key={name}
                          label={labels[name]}
                          name={name}
                          defaultValue={resource.data.business[name]}
                          type={name === 'email' ? 'email' : 'text'}
                          required={['name', 'phone'].includes(name)}
                          maxLength={name === 'deliveryOptions' ? 500 : 80}
                        />
                      ),
                    )}
                    <Select
                      label="Store theme"
                      name="theme"
                      defaultValue={resource.data.business.theme || 'sage'}
                    >
                      {['sage', 'midnight', 'coral'].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </Select>
                    {['website', 'facebook', 'instagram'].map((name) => (
                      <Field
                        key={name}
                        label={name[0].toUpperCase() + name.slice(1) + ' URL'}
                        name={name}
                        type="url"
                        defaultValue={resource.data.business.socialLinks?.[name]}
                        placeholder="https://"
                        maxLength={500}
                      />
                    ))}
                    <p className="muted">
                      Currency BDT. Changes to business name, phone or address require platform
                      verification again.
                    </p>
                  </Form>
                </section>
                <section className="panel">
                  <h2>Brand assets</h2>
                  {resource.data.business.logo && (
                    <img
                      className="brand-preview-logo"
                      src={resource.data.business.logo}
                      alt="Business logo"
                    />
                  )}
                  <BrandingUpload target="logo" label="Logo" reload={resource.reload} />
                  {resource.data.business.coverImage && (
                    <img
                      className="brand-preview-cover"
                      src={resource.data.business.coverImage}
                      alt="Store cover"
                    />
                  )}
                  <BrandingUpload
                    target="coverImage"
                    label="Cover image"
                    reload={resource.reload}
                  />
                  <p className="muted">
                    PNG, JPEG or WebP · maximum 5 MB. Choose a clear logo and a wide cover image.
                  </p>
                </section>
              </div>
            </>
          ) : (
            <section className="panel launch-wizard">
              <div className="wizard-steps">
                {steps.map((label, index) => (
                  <span key={label} className={index === step ? 'current' : ''}>
                    {index + 1}. {label}
                  </span>
                ))}
              </div>
              <h2>{steps[step]}</h2>
              <form
                className="form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (step < 3) {
                    setStep(step + 1);
                    return;
                  }
                  setBusy(true);
                  setError('');
                  try {
                    await api('/seller/business', { method: 'POST', body: body(draft) });
                    try {
                      for (const [target, file] of Object.entries(assets)) {
                        if (!file) continue;
                        const data = new FormData();
                        data.set('target', target);
                        data.set('image', file);
                        await api('/seller/business/images', { method: 'POST', body: data });
                      }
                    } finally {
                      resource.reload();
                    }
                  } catch (err) {
                    setError(err.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <fieldset disabled={busy}>
                  {step === 0 && (
                    <>
                      {field('Business name', 'name', {
                        required: true,
                        minLength: 2,
                        maxLength: 80,
                      })}
                      <div className="form-grid">
                        <Select
                          label="Business type"
                          value={draft.type}
                          onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                        >
                          {['retail', 'service', 'wholesale', 'handmade', 'food'].map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </Select>
                        {field('Business category', 'category', { required: true, maxLength: 80 })}
                      </div>
                      <Textarea
                        label="Tell your story"
                        value={draft.description}
                        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                        maxLength={2000}
                      />
                    </>
                  )}
                  {step === 1 && (
                    <>
                      <Select
                        label="Store theme"
                        value={draft.theme}
                        onChange={(e) => setDraft({ ...draft, theme: e.target.value })}
                      >
                        {['sage', 'midnight', 'coral'].map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </Select>
                      <div className={'store-theme-preview ' + draft.theme}>
                        <strong>{draft.name || 'Your new brand'}</strong>
                        <p>Your story. Your store.</p>
                      </div>
                      {[
                        ['logo', 'Business logo'],
                        ['coverImage', 'Business cover'],
                      ].map(([target, label]) => (
                        <Field
                          key={target}
                          label={label}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(event) =>
                            setAssets({ ...assets, [target]: event.target.files[0] })
                          }
                        />
                      ))}
                      <p className="muted">
                        PNG, JPEG or WebP, maximum 5 MB per image. Optional branding can also be
                        changed after launch.
                      </p>
                    </>
                  )}
                  {step === 2 && (
                    <>
                      {field('Business phone', 'phone', {
                        required: true,
                        minLength: 5,
                        maxLength: 30,
                      })}
                      {field('Business email', 'email', { type: 'email', required: true })}
                      <Textarea
                        label="Business address"
                        value={draft.address}
                        onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                        required
                        minLength={5}
                        maxLength={300}
                      />
                      {['website', 'facebook', 'instagram'].map((name) =>
                        field(name[0].toUpperCase() + name.slice(1) + ' URL', name, {
                          type: 'url',
                          maxLength: 500,
                        }),
                      )}
                    </>
                  )}
                  {step === 3 && (
                    <>
                      {field('Store URL', 'slug', {
                        required: true,
                        pattern: '[a-z0-9-]{3,80}',
                        placeholder: 'my-great-store',
                      })}
                      <Field label="Currency" value="BDT" readOnly />
                      {field('Delivery options', 'deliveryOptions', {
                        required: true,
                        maxLength: 500,
                      })}
                      <Textarea
                        label="Return policy"
                        value={draft.returnPolicy}
                        onChange={(e) => setDraft({ ...draft, returnPolicy: e.target.value })}
                        maxLength={2000}
                      />
                      <p className="muted">
                        Your business will be submitted for platform verification. Add products
                        while the review is pending.
                      </p>
                    </>
                  )}
                </fieldset>
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
                <div className="order-filter-actions">
                  {step > 0 && (
                    <button
                      type="button"
                      className="button secondary"
                      disabled={busy}
                      onClick={() => setStep(step - 1)}
                    >
                      Back
                    </button>
                  )}
                  <button className="button primary" disabled={busy}>
                    {busy ? 'Creating…' : step === 3 ? 'Create business' : 'Continue'}
                  </button>
                </div>
              </form>
            </section>
          ))}
      </State>
    </>
  );
}
