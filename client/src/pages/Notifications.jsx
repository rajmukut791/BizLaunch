import { Link } from 'react-router-dom';
import { Bell, ArrowUpRight } from 'lucide-react';
import { useResource } from '../lib/hooks';
import { api, date } from '../lib/api';
import { State, Empty, PageTitle, Action } from '../components/UI';
export default function Notifications() {
  const resource = useResource('/notifications');
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
    </main>
  );
}
