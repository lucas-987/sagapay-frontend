import { Alert, Box, Button, Card, Divider, Typography } from "@mui/material";
import { formatAmount } from "../../shared/money/format-amount";
import type { Money, Wallet } from "./wallet-api";

export type WalletCardState =
  | { status: "pending" }
  | { status: "error"; onRetry: () => void }
  | { status: "loaded"; wallet: Wallet };

function amount({ amount, currency }: Money) {
  return formatAmount(amount, currency);
}

export function WalletCard(props: WalletCardState) {
  if (props.status === "pending") {
    return (
      <Card role="status" aria-label="Loading your balance" sx={{ p: 3.5 }}>
        <Typography color="text.secondary">Loading your balance…</Typography>
      </Card>
    );
  }
  if (props.status === "error") {
    return (
      <Alert
        severity="error"
        action={<Button onClick={props.onRetry}>Try again</Button>}
      >
        Your balance could not be loaded.
      </Alert>
    );
  }
  const { balance, available, held } = props.wallet;
  return (
    <Card
      component="section"
      aria-label="Your wallet"
      sx={{ p: 3.5, display: "grid", gap: 2 }}
    >
      <Box>
        <Typography variant="body2" color="text.secondary">
          Available balance
        </Typography>
        <Typography component="p" variant="h4">
          {amount(available)}
        </Typography>
      </Box>
      <Divider />
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Total balance
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {amount(balance)}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Reserved for transfers
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {amount(held)}
        </Typography>
      </Box>
    </Card>
  );
}
