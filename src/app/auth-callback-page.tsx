import { Box, Typography } from "@mui/material";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSession } from "../auth/session-context";

export function AuthCallbackPage() {
  const { completeSignIn } = useSession();
  const { search } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const callbackUrl = new URL(`/auth/callback${search}`, location.origin);
    void completeSignIn(callbackUrl.href).then((path) =>
      navigate(path, { replace: true }),
    );
  }, [completeSignIn, search, navigate]);

  return (
    <Box role="status" sx={{ p: 5, textAlign: "center" }}>
      <Typography>Signing you in…</Typography>
    </Box>
  );
}
