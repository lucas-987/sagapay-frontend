import MoreHoriz from "@mui/icons-material/MoreHoriz";
import { Alert, Box, Button, Card, Stack, Typography } from "@mui/material";
import { Person, StatusChip } from "./transfer-parts";
import type { StatusTone } from "./transfer-logic";

export interface TransferRowView {
  id: string;
  name: string;
  initials: string;
  color: string;
  subtitle: string;
  date: string;
  statusLabel: string;
  statusTone: StatusTone;
  amount: string;
  received: boolean;
}

export type TransferListState =
  | { status: "pending" }
  | { status: "error"; onRetry: () => void }
  | {
      status: "loaded";
      rows: TransferRowView[];
      more:
        | { kind: "none" }
        | { kind: "available"; onLoadMore: () => void }
        | { kind: "loading" }
        | { kind: "failed"; onRetry: () => void };
      onOpen: (id: string) => void;
    };

const columns = { xs: "1fr auto", sm: "2fr 1.4fr 1.4fr 1fr 24px" };

export function TransferList(props: TransferListState) {
  if (props.status === "pending") {
    return (
      <Card role="status" aria-label="Loading your transfers" sx={{ p: 3.5 }}>
        <Typography color="text.secondary">Loading your transfers…</Typography>
      </Card>
    );
  }
  if (props.status === "error") {
    return (
      <Alert
        severity="error"
        action={<Button onClick={props.onRetry}>Try again</Button>}
      >
        Your transfers could not be loaded.
      </Alert>
    );
  }
  const { rows, more, onOpen } = props;
  if (rows.length === 0) {
    return (
      <Card sx={{ p: 3.5 }}>
        <Typography color="text.secondary">
          You have no transfers yet.
        </Typography>
      </Card>
    );
  }
  return (
    <Stack spacing={2}>
      <Card component="section" aria-label="Your transfers">
        <Box
          sx={{
            display: { xs: "none", sm: "grid" },
            gridTemplateColumns: columns.sm,
            px: 3,
            py: 1.5,
            bgcolor: "action.hover",
            color: "text.secondary",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: ".07em",
          }}
        >
          <span>PERSON</span>
          <span>DATE</span>
          <span>STATUS</span>
          <span>AMOUNT</span>
          <span />
        </Box>
        {rows.map((row, index) => (
          <Box
            key={row.id}
            component="button"
            onClick={() => {
              onOpen(row.id);
            }}
            sx={{
              width: "100%",
              display: "grid",
              gridTemplateColumns: columns,
              gap: 1,
              alignItems: "center",
              textAlign: "left",
              p: "17px 24px",
              bgcolor: "transparent",
              border: 0,
              borderTop: index ? 1 : 0,
              borderColor: "divider",
              color: "text.primary",
              cursor: "pointer",
              transition: "background-color 240ms ease, box-shadow 240ms ease",
              "&:hover": {
                bgcolor: "action.hover",
                boxShadow: "inset 3px 0 0 rgba(136, 192, 208, 0.75)",
              },
              "@media (prefers-reduced-motion: reduce)": { transition: "none" },
            }}
          >
            <Person
              name={row.name}
              initials={row.initials}
              color={row.color}
              subtitle={row.subtitle}
            />
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: { xs: "none", sm: "block" } }}
            >
              {row.date}
            </Typography>
            <Box sx={{ display: { xs: "none", sm: "block" } }}>
              <StatusChip label={row.statusLabel} tone={row.statusTone} />
            </Box>
            <Typography
              variant="body2"
              color={row.received ? "success.main" : "text.primary"}
              sx={{ fontWeight: 750 }}
            >
              {row.amount}
            </Typography>
            <MoreHoriz
              sx={{
                color: "text.secondary",
                display: { xs: "none", sm: "block" },
              }}
            />
          </Box>
        ))}
      </Card>
      {more.kind === "failed" && (
        <Alert
          severity="error"
          action={<Button onClick={more.onRetry}>Try again</Button>}
        >
          More transfers could not be loaded.
        </Alert>
      )}
      {more.kind === "available" && (
        <Button variant="outlined" onClick={more.onLoadMore}>
          Load more
        </Button>
      )}
      {more.kind === "loading" && (
        <Button variant="outlined" disabled>
          Loading more…
        </Button>
      )}
    </Stack>
  );
}
