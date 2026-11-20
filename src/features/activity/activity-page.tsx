import { Box, Typography } from "@mui/material";
import { useOutletContext } from "react-router";
import { TransferList } from "./transfer-list";
import { useGetWalletQuery } from "./wallet-api";
import { WalletCard } from "./wallet-card";
import { TransferDrawer } from "./transfer-drawer";
import { useActivity } from "./use-activity";

export function ActivityPage() {
  const wallet = useGetWalletQuery(undefined);
  const { customerId } = useOutletContext<{ customerId: string }>();
  const { list, drawer, close } = useActivity(customerId);

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
      <TransferDrawer content={drawer} onClose={close} />
    </>
  );
}
