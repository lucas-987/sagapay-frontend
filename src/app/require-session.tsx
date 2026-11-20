import { Box, Typography } from "@mui/material";
import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router";
import { useSession } from "../auth/session-context";

export function RequireSession({
  children,
}: {
  children: (customer: { displayName: string }) => ReactNode;
}) {
  const { state, signIn } = useSession();
  const { pathname, search, hash } = useLocation();
  const signedOut = state.status === "signed-out";

  useEffect(() => {
    if (signedOut) {
      void signIn(`${pathname}${search}${hash}`);
    }
  }, [signedOut, signIn, pathname, search, hash]);

  if (state.status === "signed-in") return children(state);
  return (
    <Box role="status" sx={{ p: 5, textAlign: "center" }}>
      <Typography>
        {state.status === "signing-out"
          ? "Signing you out…"
          : "Signing you in…"}
      </Typography>
    </Box>
  );
}
