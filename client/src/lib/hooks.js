import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
export function useResource(url) {
  const [state, setState] = useState({ key: '', data: null, error: '' });
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const key = String(url) + ':' + revision;
  useEffect(() => {
    let active = true;
    if (url)
      api(url)
        .then((data) => {
          if (active) setState({ key, data, error: '' });
        })
        .catch((error) => {
          if (active) setState({ key, data: null, error: error.message });
        });
    return () => {
      active = false;
    };
  }, [url, key]);
  return {
    data: state.key === key ? state.data : null,
    error: state.key === key ? state.error : '',
    loading: !!url && state.key !== key,
    reload,
  };
}
