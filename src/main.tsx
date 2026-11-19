import { CssBaseline, ThemeProvider } from '@mui/material';
import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Layout } from './components/Layout';
import { Activity } from './pages/Activity';
import { SendMoney } from './pages/SendMoney';
import { makeTheme } from './theme';

function App() {
  const [dark, setDark] = useState(false);
  const [page, setPage] = useState<'activity' | 'send'>('activity');
  const theme = useMemo(() => makeTheme(dark ? 'dark' : 'light'), [dark]);
  return <ThemeProvider theme={theme}><CssBaseline /><Layout page={page} onPage={setPage} dark={dark} onToggle={() => setDark(!dark)}>{page === 'activity' ? <Activity onSend={() => setPage('send')} /> : <SendMoney onBack={() => setPage('activity')} />}</Layout></ThemeProvider>;
}

createRoot(document.getElementById('root')!).render(<App />);
