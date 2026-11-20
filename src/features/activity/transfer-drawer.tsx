import Close from "@mui/icons-material/Close";
import {
  Alert,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import { StatusChip } from "./transfer-parts";
import type { StatusTone } from "./transfer-logic";

export interface TransferDetailView {
  headline: string;
  party: string;
  statusLabel: string;
  statusTone: StatusTone;
  id: string;
  date: string;
  note: string | undefined;
  failure: string | undefined;
  steps: { title: string; detail: string }[];
}

export type TransferDrawerContent =
  | { status: "pending" }
  | { status: "not-found" }
  | { status: "error"; onRetry: () => void }
  | { status: "loaded"; detail: TransferDetailView };

const titleId = "transfer-details-title";

function Facts({ detail }: { detail: TransferDetailView }) {
  const facts = [
    ["Transfer ID", detail.id],
    ["Date", detail.date],
    ...(detail.note === undefined ? [] : [["Note", detail.note]]),
    ...(detail.failure === undefined ? [] : [["Reason", detail.failure]]),
  ] as const;
  return (
    <Stack spacing={2} sx={{ py: 3 }}>
      {facts.map(([label, value]) => (
        <Stack
          key={label}
          direction="row"
          sx={{ justifyContent: "space-between", gap: 2 }}
        >
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {value}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

function Timeline({ steps }: { steps: TransferDetailView["steps"] }) {
  return (
    <>
      <Divider />
      <Typography
        id="transfer-timeline-title"
        variant="subtitle1"
        sx={{ fontWeight: 750, mt: 3, mb: 2 }}
      >
        Transfer timeline
      </Typography>
      <Box
        component="ol"
        aria-labelledby="transfer-timeline-title"
        sx={{ listStyle: "none", m: 0, p: 0 }}
      >
        {steps.map((step, index) => (
          <Stack
            key={index}
            component="li"
            direction="row"
            spacing={2}
            sx={{ alignItems: "center", mb: 2 }}
          >
            <Box
              aria-hidden
              sx={{
                width: 26,
                height: 26,
                flexShrink: 0,
                borderRadius: "50%",
                bgcolor: "action.selected",
                color: "primary.main",
                display: "grid",
                placeItems: "center",
                fontSize: 12,
              }}
            >
              {index + 1}
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {step.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {step.detail}
              </Typography>
            </Box>
          </Stack>
        ))}
      </Box>
    </>
  );
}

function Body({ content }: { content: TransferDrawerContent }) {
  switch (content.status) {
    case "pending":
      return (
        <Box role="status" aria-label="Loading the transfer" sx={{ py: 4 }}>
          <Typography color="text.secondary">Loading the transfer…</Typography>
        </Box>
      );
    case "not-found":
      return (
        <Alert severity="info" sx={{ my: 4 }}>
          This transfer was not found.
        </Alert>
      );
    case "error":
      return (
        <Alert
          severity="error"
          sx={{ my: 4 }}
          action={<Button onClick={content.onRetry}>Try again</Button>}
        >
          The transfer could not be loaded.
        </Alert>
      );
    case "loaded": {
      const { detail } = content;
      return (
        <>
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography variant="h4">{detail.headline}</Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {detail.party}
            </Typography>
            <Box sx={{ mt: 2 }}>
              <StatusChip label={detail.statusLabel} tone={detail.statusTone} />
            </Box>
          </Box>
          <Divider />
          <Facts detail={detail} />
          {detail.steps.length > 0 && <Timeline steps={detail.steps} />}
        </>
      );
    }
  }
}

export function TransferDrawer({
  content,
  onClose,
}: {
  content: TransferDrawerContent | undefined;
  onClose: () => void;
}) {
  return (
    <Drawer
      anchor="right"
      open={content !== undefined}
      onClose={onClose}
      slotProps={{
        paper: {
          role: "dialog",
          "aria-labelledby": titleId,
          sx: { width: { xs: "100%", sm: 430 }, p: 3 },
        },
      }}
    >
      {content !== undefined && (
        <>
          <Stack
            direction="row"
            sx={{ justifyContent: "space-between", alignItems: "center" }}
          >
            <Typography id={titleId} variant="h6">
              Transfer details
            </Typography>
            <IconButton aria-label="Close details" onClick={onClose}>
              <Close />
            </IconButton>
          </Stack>
          <Body content={content} />
        </>
      )}
    </Drawer>
  );
}
