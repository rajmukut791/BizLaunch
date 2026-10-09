import { useApp } from '../context/state';
import { api } from '../lib/api';
import { Form, Field, Select } from '../components/UI';
export default function ReportConcern({
  business,
  targetType = 'business',
  targetId,
  label = 'Report a concern',
}) {
  const { user } = useApp();
  if (!user) return null;
  return (
    <details className="report-form">
      <summary>{label}</summary>
      <Form
        submit="Submit report"
        success="Your report was sent to the administrator"
        onSubmit={(values) =>
          api('/reports', {
            method: 'POST',
            body: {
              business,
              targetType,
              targetId,
              reason: values.category + ': ' + values.reason,
            },
          })
        }
      >
        <Select label="Concern category" name="category">
          <option>Fake product</option>
          <option>Misleading information</option>
          <option>Inappropriate content</option>
          <option>Other</option>
        </Select>
        <Field label="What happened?" name="reason" required minLength={10} maxLength={1800} />
      </Form>
    </details>
  );
}
