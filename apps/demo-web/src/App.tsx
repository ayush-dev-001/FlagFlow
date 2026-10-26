import { useEffect, useState } from 'react';
import { Acme } from './Acme';
import { useLiveFlags } from './api';
import { DEMO_USERS, FlagFlowPanel } from './FlagFlowPanel';

/** The viewed user lives in the URL (?user=U002), so a view can be shared or reloaded. */
function useUserParam() {
  const read = () => {
    const id = new URLSearchParams(window.location.search).get('user');
    return DEMO_USERS.some((u) => u.id === id) ? id! : 'U001';
  };
  const [userId, setUserId] = useState(read);
  useEffect(() => {
    const onPop = () => setUserId(read());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const set = (id: string) => {
    window.history.pushState(null, '', `?user=${id}`);
    setUserId(id);
  };
  return [userId, set] as const;
}

export function App() {
  const [userId, setUserId] = useUserParam();
  const live = useLiveFlags(userId);
  const name = DEMO_USERS.find((u) => u.id === userId)?.name ?? userId;

  return (
    <div className="flex min-h-dvh flex-col-reverse lg:grid lg:grid-cols-[minmax(0,1fr)_340px]">
      <Acme key={userId} userId={userId} userName={name} flags={live.flags} />
      <FlagFlowPanel userId={userId} onUser={setUserId} {...live} />
    </div>
  );
}
