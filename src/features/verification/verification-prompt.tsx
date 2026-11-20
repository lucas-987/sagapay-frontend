import {
  Alert,
  Box,
  Button,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState, type SyntheticEvent } from "react";
import type { ApiError } from "../../api/api-error";
import { confirmOutcomeOf, type ConfirmOutcome } from "./confirm-outcome";
import { Countdown } from "./countdown";
import { useRemainingMs } from "./use-remaining-ms";
import { useConfirmTransferMutation } from "./verification-api";

type Notice = Exclude<ConfirmOutcome, "resolved"> | "empty" | "accepted";

const messages: Record<Exclude<Notice, "empty">, string> = {
  incorrect: "That code is incorrect. Try again.",
  expired: "Verification expired, transfer cancelled.",
  "not-found": "This transfer was not found.",
  failed: "The code could not be checked. Try again.",
  accepted: "Code accepted. Your transfer is being completed.",
};

const timeOver =
  "The confirmation time is over. Waiting for the final state of the transfer.";

const titleId = "verification-title";

export function VerificationPrompt({
  transferId,
  deadline,
}: {
  transferId: string;
  deadline: string;
}) {
  const remaining = useRemainingMs(deadline);
  const [confirm, { isLoading }] = useConfirmTransferMutation();
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<Notice>();
  const [resolved, setResolved] = useState(false);

  if (resolved) return null;

  const finished =
    notice === "expired" || notice === "not-found" || notice === "accepted";
  const closed = finished || remaining === 0;

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    const verificationToken = code.trim();
    if (verificationToken === "") {
      setNotice("empty");
      return;
    }
    try {
      await confirm({ id: transferId, verificationToken }).unwrap();
      setNotice("accepted");
    } catch (error) {
      const outcome = confirmOutcomeOf(error as ApiError);
      if (outcome === "resolved") setResolved(true);
      else setNotice(outcome);
    }
  }

  const alert =
    notice === undefined || notice === "empty" ? undefined : messages[notice];

  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      sx={{ p: 2, borderRadius: 2, bgcolor: "action.hover" }}
    >
      <Typography id={titleId} sx={{ fontWeight: 700 }}>
        Verification required
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
        Enter your verification code before the confirmation window closes.
      </Typography>
      <Countdown remainingMs={remaining} />
      <Stack
        component="form"
        noValidate
        spacing={2}
        sx={{ mt: 2 }}
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <TextField
          label="Verification code"
          value={code}
          disabled={closed}
          slotProps={{ input: { readOnly: isLoading } }}
          error={notice === "empty"}
          helperText={
            notice === "empty" ? "Enter the verification code." : undefined
          }
          autoComplete="off"
          onChange={(event) => {
            setCode(event.target.value);
          }}
        />
        {alert !== undefined && (
          <Alert severity={notice === "accepted" ? "success" : "error"}>
            {alert}
          </Alert>
        )}
        {alert === undefined && remaining === 0 && (
          <Alert severity="warning">{timeOver}</Alert>
        )}
        <Button type="submit" variant="outlined" disabled={closed || isLoading}>
          Confirm transfer
        </Button>
      </Stack>
    </Box>
  );
}
