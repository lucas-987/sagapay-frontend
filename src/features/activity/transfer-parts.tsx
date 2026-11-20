import { Avatar, Box, Chip, Stack, Typography } from "@mui/material";
import type { StatusTone } from "./transfer-logic";

export function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: StatusTone;
}) {
  return (
    <Chip
      size="small"
      label={label}
      color={tone}
      variant="outlined"
      sx={{
        border: 0,
        bgcolor: `${tone}.main`,
        color: (theme) =>
          theme.palette.mode === "light" || tone === "error"
            ? "#fff"
            : "#263238",
        height: 25,
      }}
    />
  );
}

export function Person({
  name,
  initials,
  color,
  subtitle,
}: {
  name: string;
  initials: string;
  color: string;
  subtitle: string;
}) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{ alignItems: "center", minWidth: 0 }}
    >
      <Avatar
        sx={{
          bgcolor: `${color}33`,
          color,
          width: 42,
          height: 42,
          fontWeight: 700,
          fontSize: 13,
        }}
      >
        {initials}
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
          {name}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          noWrap
          sx={{ display: "block" }}
        >
          {subtitle}
        </Typography>
      </Box>
    </Stack>
  );
}
