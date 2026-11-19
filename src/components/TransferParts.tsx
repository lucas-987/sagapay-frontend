import { Avatar, Box, Chip, Stack, Typography } from '@mui/material';
import type { Transfer, TransferStatus } from '../data/transfers';

export function StatusChip({ status }: { status: TransferStatus }) {
  const color = status === 'Completed' ? 'success' : status === 'Failed' ? 'error' : status === 'Checking' ? 'primary' : 'warning';
  return <Chip size="small" label={status} color={color} variant="outlined" sx={{ border: 0, bgcolor: `${color}.main`, color: (theme) => theme.palette.mode === 'light' ? '#fff' : color === 'error' ? '#fff' : '#263238', height: 25 }} />;
}
export function Person({ transfer, subtitle }: { transfer: Transfer; subtitle?: string }) {
  return <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}><Avatar sx={{ bgcolor: `${transfer.color}33`, color: transfer.color, width: 42, height: 42, fontWeight: 700, fontSize: 13 }}>{transfer.initials}</Avatar><Box sx={{ minWidth: 0 }}><Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>{transfer.name}</Typography><Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{subtitle ?? transfer.handle}</Typography></Box></Stack>;
}
