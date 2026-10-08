export async function api(path, options = {}) {
  const form = options.body instanceof FormData;
  const response = await fetch('/api' + path, {
    ...options,
    credentials: 'include',
    headers: { ...(form ? {} : { 'Content-Type': 'application/json' }), ...options.headers },
    body:
      options.body === undefined ? undefined : form ? options.body : JSON.stringify(options.body),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('The server could not be reached. Try again.');
  }
  if (!response.ok) {
    const error = new Error(data.message || 'Request failed');
    error.status = response.status;
    if (data.code === 'MAINTENANCE')
      window.dispatchEvent(new CustomEvent('bizlaunch:maintenance', { detail: data.maintenance }));
    if (response.status === 401 && !path.startsWith('/auth/'))
      window.dispatchEvent(new Event('bizlaunch:unauthorized'));
    throw error;
  }
  return data;
}
export const currency = (value) =>
  new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    maximumFractionDigits: 2,
  }).format(value || 0);
export const date = (value) =>
  new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export const getId = (record) => (typeof record === 'string' ? record : record?._id || record?.id);
export function downloadJson(data, filename) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
