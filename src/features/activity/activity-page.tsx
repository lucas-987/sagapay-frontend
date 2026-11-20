import { Box, Typography } from "@mui/material";
import { useSession } from "../../auth/session-context";
import { TransferList } from "./transfer-list";
import { useGetWalletQuery } from "./wallet-api";
import { WalletCard } from "./wallet-card";
import { useTransferRows } from "./use-transfer-rows";

export function ActivityPage() {
  const wallet = useGetWalletQuery(undefined);
  const { state } = useSession();
  const customerId = state.status === "signed-in" ? state.subject : "";
  const list = useTransferRows(customerId);

  return (
    <>
      <Typography component="h1" variant="h4" gutterBottom>
        Activity
      </Typography>
      <Box sx={{ mb: 3 }}>
        {wallet.isError ? (
          <WalletCard
            status="error"
            onRetry={() => {
              void wallet.refetch();
            }}
          />
        ) : wallet.data === undefined ? (
          <WalletCard status="pending" />
        ) : (
          <WalletCard status="loaded" wallet={wallet.data} />
        )}
      </Box>
      <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
        Recent activity
      </Typography>
      <TransferList {...list} />
    </>
  );
}
