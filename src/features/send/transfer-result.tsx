import { Alert, Button, Card, Stack, Typography } from "@mui/material";
import { Link } from "react-router";
import {
  describeFailure,
  useGetTransferQuery,
  type Transfer,
} from "../activity";
import { progressOf } from "./transfer-progress";

export function TransferResult({ accepted }: { accepted: Transfer }) {
  const detail = useGetTransferQuery(accepted.id);
  const transfer = detail.data ?? accepted;
  const steps = progressOf(transfer.status);
  const failure = transfer.failureReason;
  return (
    <Card sx={{ p: { xs: 2.5, sm: 3.5 } }}>
      <Typography variant="h6">Your transfer</Typography>
      <Stack spacing={3} sx={{ mt: 2 }}>
        {failure !== undefined && failure !== null && (
          <Alert severity="error">
            The transfer failed: {describeFailure(failure)}
          </Alert>
        )}
        {steps.length > 0 && (
          <Stack
            component="ol"
            aria-label="Transfer progress"
            sx={{ m: 0, p: 0, listStyle: "none" }}
            spacing={1}
          >
            {steps.map(({ label, reached }) => (
              <Typography component="li" key={label} variant="body2">
                {label} {reached ? "Confirmed" : "Waiting"}
              </Typography>
            ))}
          </Stack>
        )}
        <Button component={Link} to={`/activity?transfer=${transfer.id}`}>
          View transfer details
        </Button>
      </Stack>
    </Card>
  );
}
