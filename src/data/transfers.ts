export type TransferStatus = 'Completed' | 'Checking' | 'Verification needed' | 'Failed';
export type Transfer = { id: string; name: string; handle: string; initials: string; date: string; amount: string; direction: 'sent' | 'received'; status: TransferStatus; note: string; color: string };
export const transfers: Transfer[] = [
  { id: 'TR-82941', name: 'Olivia Martin', handle: '@oliviam', initials: 'OM', date: 'Today, 10:42 AM', amount: '120.00', direction: 'sent', status: 'Checking', note: 'Dinner last night', color: '#b48ead' },
  { id: 'TR-82930', name: 'Noah Williams', handle: '@noahw', initials: 'NW', date: 'Today, 9:18 AM', amount: '45.00', direction: 'received', status: 'Completed', note: 'Coffee and pastries', color: '#88c0d0' },
  { id: 'TR-82896', name: 'Emma Laurent', handle: '@emmalaurent', initials: 'EL', date: 'Yesterday, 4:36 PM', amount: '275.00', direction: 'sent', status: 'Verification needed', note: 'Weekend away', color: '#ebcb8b' },
  { id: 'TR-82714', name: 'Lucas Bernard', handle: '@lucasb', initials: 'LB', date: 'Nov 8, 2026', amount: '68.50', direction: 'sent', status: 'Completed', note: 'Shared expenses', color: '#a3be8c' },
  { id: 'TR-82601', name: 'Sophia Chen', handle: '@sophia', initials: 'SC', date: 'Nov 6, 2026', amount: '32.00', direction: 'received', status: 'Completed', note: 'Lunch', color: '#d08770' },
  { id: 'TR-82510', name: 'Alex Morgan', handle: '@alexm', initials: 'AM', date: 'Nov 4, 2026', amount: '180.00', direction: 'sent', status: 'Failed', note: 'Tickets', color: '#81a1c1' },
];
export const contacts = transfers.slice(0, 4);
