import { useResource } from '../lib/hooks';
import { api, date } from '../lib/api';
import { State, PageTitle, Form, Field, Select, Badge } from '../components/UI';
export default function PlatformSettings() {
  const resource = useResource('/admin/settings');
  return (
    <>
      <PageTitle
        eyebrow="SYSTEM SETTINGS"
        title="Platform settings"
        description="Platform contact information, registration controls and integration readiness."
      />
      <State resource={resource}>
        {resource.data && (
          <div className="management-grid">
            <section className="panel">
              <h2>Platform configuration</h2>
              <Form
                key={resource.data.settings.version}
                submit="Save platform settings"
                success="Platform settings saved"
                onSubmit={async (values) => {
                  await api('/admin/settings', {
                    method: 'PATCH',
                    body: {
                      ...values,
                      allowRegistration: values.allowRegistration === 'true',
                      version: resource.data.settings.version,
                    },
                  });
                  resource.reload();
                  window.dispatchEvent(new Event('bizlaunch:config'));
                }}
              >
                <Field
                  label="Platform name"
                  name="platformName"
                  defaultValue={resource.data.settings.platformName}
                  required
                  minLength={2}
                  maxLength={30}
                />
                <Field
                  label="Support email"
                  name="supportEmail"
                  type="email"
                  defaultValue={resource.data.settings.supportEmail}
                  maxLength={254}
                />
                <Field
                  label="Support phone"
                  name="supportPhone"
                  defaultValue={resource.data.settings.supportPhone}
                  maxLength={30}
                />
                <Select
                  label="Public registration"
                  name="allowRegistration"
                  defaultValue={String(resource.data.settings.allowRegistration)}
                >
                  <option value="true">Open registration</option>
                  <option value="false">Pause new registrations</option>
                </Select>
              </Form>
            </section>
            <section className="panel">
              <h2>Integration readiness</h2>
              {Object.entries(resource.data.integrations).map(([name, ready]) => (
                <div className="summary-row" key={name}>
                  <span>{name}</span>
                  <Badge>{ready ? 'Ready' : 'Not configured'}</Badge>
                </div>
              ))}
              <p className="muted">
                Secrets stay in server/.env. Use Gmail App Password for email, and Cloudinary
                credentials for hosted images. Local image upload works without Cloudinary.
              </p>
              <h3>Settings activity</h3>
              {resource.data.settings.history.map((entry, index) => (
                <div className="summary-row" key={index}>
                  <span>
                    {entry.changedBy?.name || 'Admin'}
                    <small>{date(entry.changedAt)}</small>
                  </span>
                  <span>{entry.platformName}</span>
                </div>
              ))}
            </section>
          </div>
        )}
      </State>
    </>
  );
}
