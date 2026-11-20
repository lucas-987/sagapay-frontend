import ArrowBack from "@mui/icons-material/ArrowBack";
import { Box, Button, Typography } from "@mui/material";
import { Link } from "react-router";
import { HowItWorks } from "./how-it-works";
import { SendForm } from "./send-form";
import { TransferResult } from "./transfer-result";
import { useSendForm } from "./use-send-form";

export function SendMoneyPage() {
  const form = useSendForm();
  return (
    <>
      <Button
        component={Link}
        to="/activity"
        startIcon={<ArrowBack />}
        sx={{ color: "text.secondary", p: 0, mb: 3 }}
      >
        Back to activity
      </Button>
      <Typography component="h1" variant="h4" sx={{ mb: 4 }}>
        Send money
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1.35fr 0.85fr" },
          gap: 3,
          alignItems: "start",
        }}
      >
        {form.submission.accepted === undefined ? (
          <SendForm {...form} />
        ) : (
          <TransferResult accepted={form.submission.accepted} />
        )}
        <HowItWorks />
      </Box>
    </>
  );
}
