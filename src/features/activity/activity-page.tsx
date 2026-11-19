import { Box, Typography } from "@mui/material";
import { useGetWalletQuery } from "./wallet-api";
import { WalletCard } from "./wallet-card";

export function ActivityPage() {
  const wallet = useGetWalletQuery(undefined);

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
      <Typography color="text.secondary">
        Transfer activity is coming soon.
      </Typography>
    </>
  );
}
