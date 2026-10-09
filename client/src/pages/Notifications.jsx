import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bell, ArrowUpRight } from 'lucide-react';
import { useResource } from '../lib/hooks';
import { api, date } from '../lib/api';
import { State, Empty, PageTitle, Action } from '../components/UI';
export default function Notifications() {
  const [params, setParams] = useSearchParams();
  const resource = useResource('/notifications?' + params);
  const { reload } = resource;
  useEffect(() => {
    window.addEventListener('bizlaunch:notification', reload);
    return () => window.removeEventListener('bizlaunch:notification', reload);
  }, [reload]);
  return (
    <main className="container content narrow">
      <PageTitle
        eyebrow="STAY IN THE LOOP"
        title="Notifications"
        description="Business, order and report updates in one place."
        action={
          <Action
            onClick={async () => {
              await api('/notifications/read', { method: 'PATCH', body: {} });
              resource.reload();
              window.dispatchEvent(new Event('bizlaunch:notification'));
            }}
          >
            Mark all read
          </Action>
        }
      />
      <State resource={resource}>
        {resource.data?.notifications.length ? (
          <div className="notification-list">
            {resource.data.notifications.map((n) => (
              <Link
                className={'panel notification ' + (n.read ? '' : 'unread')}
                key={n._id}
                to={n.link || '/dashboard'}
                onClick={() =>
                  api('/notifications/' + n._id + '/read', { method: 'PATCH', body: {} })
                    .then(() => window.dispatchEvent(new Event('bizlaunch:notification')))
                    .catch(() => {})
                }
              >
                <span className="icon-tile">
                  <Bell size={20} />
                </span>
                <div>
                  <strong>{n.title}</strong>
                  <p>{n.message}</p>
                  <small className="muted">{date(n.createdAt)}</small>
                </div>
                <ArrowUpRight size={18} />
              </Link>
            ))}
          </div>
        ) : (
          <Empty
            title="You're all caught up."
            description="We'll keep your important updates here."
          />
        )}
      </State>
      {resource.data && (
        <div className="order-pagination">
          <span>
            {resource.data.unread} unread · {resource.data.total} notifications
          </span>
          <div>
            <button
              className="button secondary"
              disabled={resource.data.page <= 1}
              onClick={() => setParams({ page: resource.data.page - 1 })}
            >
              Previous
            </button>
            <span>
              Page {resource.data.page} of {resource.data.pages}
            </span>
            <button
              className="button secondary"
              disabled={resource.data.page >= resource.data.pages}
              onClick={() => setParams({ page: resource.data.page + 1 })}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
