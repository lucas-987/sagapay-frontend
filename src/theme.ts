import { alpha, createTheme } from '@mui/material/styles';
import type { PaletteMode } from '@mui/material';

export function makeTheme(mode: PaletteMode) {
  const dark = mode === 'dark';
  const glass = dark ? 'rgba(59, 68, 83, 0.68)' : 'rgba(245, 250, 252, 0.48)';
  const edge = dark ? 'rgba(216, 222, 233, 0.16)' : 'rgba(91, 124, 142, 0.20)';
  return createTheme({
    palette: { mode, primary: { main: dark ? '#88c0d0' : '#3b7184', contrastText: dark ? '#2e3440' : '#fff' }, secondary: { main: '#b48ead' }, success: { main: dark ? '#a3be8c' : '#66844f' }, warning: { main: dark ? '#ebcb8b' : '#a87926' }, error: { main: dark ? '#bf616a' : '#a94d59' }, background: { default: dark ? '#252e3b' : '#e7eef1', paper: dark ? '#343e4d' : '#f7fafb' }, text: { primary: dark ? '#eceff4' : '#2e3440', secondary: dark ? '#c0cad8' : '#607183' }, divider: dark ? 'rgba(216, 222, 233, 0.15)' : 'rgba(76, 96, 115, 0.16)' },
    typography: { fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', h4: { fontWeight: 750, letterSpacing: '-0.035em' }, h5: { fontWeight: 750, letterSpacing: '-0.025em' }, h6: { fontWeight: 700, letterSpacing: '-0.02em' }, button: { fontWeight: 700, textTransform: 'none' }, body2: { lineHeight: 1.6 } },
    shape: { borderRadius: 18 },
    components: {
      MuiCssBaseline: { styleOverrides: { body: { backgroundImage: dark ? 'radial-gradient(ellipse at 12% 8%, #49677b 0%, transparent 42%), radial-gradient(ellipse at 87% 30%, #584d69 0%, transparent 38%), linear-gradient(145deg, #252e3b, #303a49)' : 'radial-gradient(ellipse 340px 300px at 16% 23%, rgba(136, 192, 208, 0.46), transparent 75%), radial-gradient(ellipse 400px 360px at 85% 27%, rgba(180, 142, 173, 0.34), transparent 75%), radial-gradient(ellipse 380px 340px at 58% 90%, rgba(143, 188, 187, 0.28), transparent 75%), linear-gradient(145deg, #e5eef1, #e4e7ef)', backgroundAttachment: 'fixed' }, '@media (prefers-reduced-motion: reduce)': { '*, *::before, *::after': { animationDuration: '0.01ms !important', animationIterationCount: '1 !important', transitionDuration: '0.01ms !important', scrollBehavior: 'auto !important' } } } },
      MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: 12, padding: '10px 18px', transition: 'background-color 200ms ease, box-shadow 200ms ease, transform 200ms ease', '@media (hover: hover)': { '&:hover': { transform: 'translateY(-1px)' } }, '&:active': { transform: 'translateY(0)' } }, contained: { backgroundImage: `linear-gradient(145deg, ${alpha('#ffffff', dark ? 0.18 : 0.12)}, transparent)`, boxShadow: `inset 0 1px 0 ${alpha('#ffffff', 0.3)}, 0 5px 14px ${alpha('#2e3440', 0.14)}` } } },
      MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 12, backgroundColor: alpha(dark ? '#2e3440' : '#fff', dark ? 0.28 : 0.38), transition: 'background-color 220ms ease, box-shadow 220ms ease', '& .MuiOutlinedInput-notchedOutline': { borderColor: dark ? 'rgba(216, 222, 233, 0.25)' : 'rgba(76, 106, 125, 0.25)' }, '&.Mui-focused': { backgroundColor: alpha(dark ? '#2e3440' : '#fff', dark ? 0.45 : 0.58), boxShadow: `0 0 0 4px ${alpha(dark ? '#88c0d0' : '#3b7184', 0.1)}` } } } },
      MuiChip: { styleOverrides: { root: { fontWeight: 700, fontSize: '0.7rem' } } },
      MuiCard: { styleOverrides: { root: { backgroundColor: glass, backgroundImage: `linear-gradient(145deg, ${alpha('#fff', dark ? 0.08 : 0.3)}, transparent 62%)`, backdropFilter: 'blur(24px) saturate(140%)', WebkitBackdropFilter: 'blur(24px) saturate(140%)', border: `1px solid ${edge}`, boxShadow: `inset 0 1px 0 ${alpha('#fff', dark ? 0.12 : 0.65)}, inset 0 -1px 0 ${alpha(dark ? '#fff' : '#5e81ac', dark ? 0.04 : 0.08)}, 0 8px 24px ${alpha('#2e3440', dark ? 0.16 : 0.08)}` } } },
      MuiDrawer: { styleOverrides: { paper: { backgroundColor: dark ? 'rgba(46, 52, 64, 0.94)' : 'rgba(245, 249, 250, 0.94)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' } } },
    },
  });
}
