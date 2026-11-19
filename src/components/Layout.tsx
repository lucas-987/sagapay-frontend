import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlined from '@mui/icons-material/LightModeOutlined';
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined';
import SendOutlined from '@mui/icons-material/SendOutlined';
import { Avatar, Box, Button, IconButton, Typography } from '@mui/material';
import type { ReactNode } from 'react';

type Page = 'activity' | 'send';

export function Layout({ page, onPage, dark, onToggle, children }: { page: Page; onPage: (page: Page) => void; dark: boolean; onToggle: () => void; children: ReactNode }) {
  return <Box sx={{ minHeight: '100vh' }}>
    <Box component="header" sx={{ bgcolor: dark ? 'rgba(46, 52, 64, 0.66)' : 'rgba(255, 255, 255, 0.52)', backdropFilter: 'blur(24px) saturate(150%)', WebkitBackdropFilter: 'blur(24px) saturate(150%)', borderBottom: 1, borderColor: dark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.7)', boxShadow: '0 4px 24px rgba(46, 52, 64, 0.05)' }}>
      <Box sx={{ maxWidth: 1250, mx: 'auto', px: { xs: 2, sm: 3, md: 5 }, display: 'flex', alignItems: 'center', minHeight: 72, gap: { xs: 1, sm: 3 }, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, mr: { sm: 2 } }}>
          <Box sx={{ width: 34, height: 34, borderRadius: 2, bgcolor: 'primary.main', color: 'primary.contrastText', display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 19 }}>S</Box>
          <Typography variant="h6" sx={{ display: { xs: 'none', sm: 'block' } }}>sagapay<span style={{ color: '#88c0d0' }}>.</span></Typography>
        </Box>
        <Box component="nav" aria-label="Main navigation" sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 }, flex: 1, '@media (max-width: 370px)': { order: 3, flexBasis: '100%', pb: 1 } }}>
          {([['activity', 'Activity', <ReceiptLongOutlined />], ['send', 'Send money', <SendOutlined />]] as const).map(([id, label, icon]) => <Button key={id} onClick={() => onPage(id)} aria-current={page === id ? 'page' : undefined} startIcon={icon} sx={{ px: { xs: 1, sm: 1.5 }, whiteSpace: 'nowrap', color: page === id ? 'primary.main' : 'text.secondary', bgcolor: page === id ? 'action.selected' : 'transparent', '& .MuiButton-startIcon': { mr: { xs: 0.5, sm: 1 } } }}>{label}</Button>)}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, flexShrink: 0 }}>
          <IconButton onClick={onToggle} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} sx={{ width: 40, height: 40, color: 'text.secondary', '& svg': { transition: 'transform 350ms ease' }, '@media (hover: hover)': { '&:hover svg': { transform: 'rotate(18deg) scale(1.08)' } } }}>{dark ? <LightModeOutlined fontSize="small" /> : <DarkModeOutlined fontSize="small" />}</IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Avatar sx={{ width: 36, height: 36, bgcolor: '#5e81ac', fontSize: 13 }}>JD</Avatar><Box sx={{ display: { xs: 'none', md: 'block' } }}><Typography variant="body2" sx={{ fontWeight: 700 }}>Jordan Davis</Typography><Typography variant="caption" color="text.secondary">Personal account</Typography></Box></Box>
        </Box>
      </Box>
    </Box>
    <Box component="main" sx={{ maxWidth: 1250, mx: 'auto', px: { xs: 2, sm: 3, md: 5 }, py: { xs: 3, md: 5 } }}>{children}</Box>
  </Box>;
}
