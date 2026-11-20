import SendOutlined from "@mui/icons-material/SendOutlined";
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Card,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { formatAmount } from "../../shared/money/format-amount";
import { currencyScale, type AmountError } from "./amount";
import type { Recipient } from "./recipient-api";
import { noteMaxLength, type SendForm as SendFormState } from "./use-send-form";

const alertRole = { formHelperText: { role: "alert" } };

function Label({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <Typography
      component="label"
      htmlFor={htmlFor}
      variant="body2"
      sx={{ fontWeight: 700, mb: 1, display: "block" }}
    >
      {children}
    </Typography>
  );
}

function describeAmountError(
  error: AmountError,
  available: { amount: string; currency: string },
): string | undefined {
  switch (error) {
    case "empty":
      return undefined;
    case "format":
      return "Write the amount in digits with a dot, for example 12.50.";
    case "not-positive":
      return "The amount must be greater than zero.";
    case "too-precise":
      return `${available.currency} amounts have at most ${String(currencyScale(available.currency))} decimal places.`;
    case "above-available":
      return `The amount is above your available balance of ${formatAmount(available.amount, available.currency)}.`;
  }
}

function RecipientOption({ recipient }: { recipient: Recipient }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
      <Avatar aria-hidden>{recipient.displayName.charAt(0)}</Avatar>
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {recipient.displayName}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          @{recipient.handle}
        </Typography>
      </Box>
    </Stack>
  );
}

function RecipientField({ recipient }: Pick<SendFormState, "recipient">) {
  const { lookup, selected, typed } = recipient;
  const [open, setOpen] = useState(false);
  const notFound = lookup.status === "not-found";
  const options = lookup.status === "found" ? [lookup.recipient] : [];
  return (
    <Box>
      <Label htmlFor="recipient">Recipient</Label>
      <Autocomplete
        id="recipient"
        options={options}
        value={selected}
        inputValue={
          selected === null
            ? typed
            : `${selected.displayName} (@${selected.handle})`
        }
        open={open && options.length > 0}
        onOpen={() => {
          setOpen(true);
        }}
        onClose={() => {
          setOpen(false);
        }}
        filterOptions={(all) => all}
        getOptionLabel={(option) => `${option.displayName} (@${option.handle})`}
        isOptionEqualToValue={(option, value) =>
          option.accountId === value.accountId
        }
        onChange={(_event, option) => {
          recipient.select(option);
        }}
        onInputChange={(_event, text, reason) => {
          if (reason === "input" || reason === "clear") {
            recipient.type(reason === "clear" ? "" : text);
          }
        }}
        renderOption={(props, option) => {
          const { key, ...rest } = props;
          return (
            <Box component="li" key={key} {...rest}>
              <RecipientOption recipient={option} />
            </Box>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Search by @handle"
            error={notFound}
            helperText={
              notFound
                ? "No recipient found"
                : "Find someone using their SagaPay handle."
            }
            slotProps={{
              ...params.slotProps,
              ...(notFound ? alertRole : {}),
            }}
          />
        )}
      />
      {lookup.status === "failed" && (
        <Alert
          severity="error"
          sx={{ mt: 1 }}
          action={<Button onClick={lookup.retry}>Try again</Button>}
        >
          The recipient could not be looked up.
        </Alert>
      )}
    </Box>
  );
}

function AmountField({
  amount,
  wallet,
}: Pick<SendFormState, "amount" | "wallet">) {
  const { available } = wallet;
  const message =
    available === undefined || amount.check === undefined || amount.check.ok
      ? undefined
      : describeAmountError(amount.check.error, available);
  const hint =
    wallet.status === "loaded" && available !== undefined ? (
      `Available to send: ${formatAmount(available.amount, available.currency)}`
    ) : wallet.status === "error" ? (
      <Alert
        severity="error"
        action={<Button onClick={wallet.retry}>Try again</Button>}
      >
        Your balance could not be loaded.
      </Alert>
    ) : (
      "Loading your balance…"
    );
  return (
    <Box>
      <Label htmlFor="amount">Amount</Label>
      <TextField
        id="amount"
        fullWidth
        placeholder="0.00"
        value={amount.text}
        onChange={(event) => {
          amount.change(event.target.value);
        }}
        error={message !== undefined}
        helperText={message ?? (wallet.status === "error" ? undefined : hint)}
        slotProps={{
          input: {
            endAdornment:
              available === undefined ? undefined : (
                <InputAdornment position="end">
                  {available.currency}
                </InputAdornment>
              ),
          },
          htmlInput: { inputMode: "decimal" },
          ...(message === undefined ? {} : alertRole),
        }}
      />
      {wallet.status === "error" && <Box sx={{ mt: 1 }}>{hint}</Box>}
    </Box>
  );
}

function NoteField({ note }: Pick<SendFormState, "note">) {
  return (
    <Box>
      <Label htmlFor="note">
        Note{" "}
        <Typography component="span" variant="body2" color="text.secondary">
          (optional)
        </Typography>
      </Label>
      <TextField
        id="note"
        fullWidth
        placeholder="What’s this for?"
        value={note.text}
        onChange={(event) => {
          note.change(event.target.value);
        }}
        error={note.tooLong}
        helperText={
          note.tooLong
            ? `The note can have at most ${String(noteMaxLength)} characters.`
            : undefined
        }
        slotProps={note.tooLong ? alertRole : undefined}
      />
    </Box>
  );
}

export function SendForm(form: SendFormState) {
  return (
    <Card sx={{ p: { xs: 2.5, sm: 3.5 } }}>
      <Typography variant="h6">Transfer details</Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mt: 0.5, mb: 3 }}
      >
        Tell us who you’re sending money to.
      </Typography>
      <Stack spacing={3}>
        <RecipientField recipient={form.recipient} />
        <AmountField amount={form.amount} wallet={form.wallet} />
        <NoteField note={form.note} />
        <Button
          variant="contained"
          size="large"
          endIcon={<SendOutlined />}
          disabled={!form.canSend}
        >
          Send money
        </Button>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ textAlign: "center" }}
        >
          Transfers are reviewed before they are sent.
        </Typography>
      </Stack>
    </Card>
  );
}
