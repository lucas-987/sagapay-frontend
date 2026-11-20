import AccountCircleOutlined from "@mui/icons-material/AccountCircleOutlined";
import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import SendOutlined from "@mui/icons-material/SendOutlined";
import {
  Avatar,
  Box,
  Button,
  CssBaseline,
  IconButton,
  ThemeProvider,
  Typography,
} from "@mui/material";
import { useMemo } from "react";
import { NavLink, Outlet } from "react-router";
import { makeTheme } from "../shared/theme/theme";
import { useThemePreference } from "../shared/theme/use-theme-preference";

const destinations = [
  { to: "/activity", label: "Activity", icon: <ReceiptLongOutlined /> },
  { to: "/send", label: "Send money", icon: <SendOutlined /> },
];

export function Layout({
  displayName,
  onSignOut,
}: {
  displayName: string;
  onSignOut: () => void;
}) {
  const { mode, toggleMode } = useThemePreference();
  const theme = useMemo(() => makeTheme(mode), [mode]);
  const dark = mode === "dark";

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      <Box sx={{ minHeight: "100vh" }}>
        <Box
          component="header"
          sx={{
            bgcolor: dark
              ? "rgba(46, 52, 64, 0.66)"
              : "rgba(255, 255, 255, 0.52)",
            backdropFilter: "blur(24px) saturate(150%)",
            WebkitBackdropFilter: "blur(24px) saturate(150%)",
            borderBottom: 1,
            borderColor: dark
              ? "rgba(255, 255, 255, 0.12)"
              : "rgba(255, 255, 255, 0.7)",
            boxShadow: "0 4px 24px rgba(46, 52, 64, 0.05)",
          }}
        >
          <Box
            sx={{
              maxWidth: 1250,
              mx: "auto",
              px: { xs: 2, sm: 3, md: 5 },
              display: "flex",
              alignItems: "center",
              minHeight: 72,
              gap: { xs: 1, sm: 3 },
              flexWrap: "wrap",
              "@media (max-width: 370px)": { py: 1 },
            }}
          >
            <Box
              role="img"
              aria-label="SagaPay"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                flexShrink: 0,
                mr: { sm: 2 },
              }}
            >
              <Box
                aria-hidden="true"
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: 2,
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 900,
                  fontSize: 19,
                }}
              >
                S
              </Box>
              <Typography
                aria-hidden="true"
                component="span"
                variant="h6"
                sx={{ display: { xs: "none", sm: "block" } }}
              >
                sagapay<span style={{ color: "#88c0d0" }}>.</span>
              </Typography>
            </Box>
            <Box
              component="nav"
              aria-label="Main navigation"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: { xs: 0.5, sm: 1 },
                flex: 1,
                "@media (max-width: 370px)": { flexBasis: "80%" },
              }}
            >
              {destinations.map(({ to, label, icon }) => (
                <Button
                  key={to}
                  component={NavLink}
                  to={to}
                  end
                  startIcon={icon}
                  sx={{
                    px: { xs: 1, sm: 1.5 },
                    whiteSpace: "nowrap",
                    color: "text.secondary",
                    "&[aria-current='page']": {
                      color: dark ? "primary.light" : "primary.main",
                      bgcolor: dark
                        ? "rgba(255, 255, 255, 0.06)"
                        : "action.selected",
                    },
                    "& .MuiButton-startIcon": { mr: { xs: 0.5, sm: 1 } },
                  }}
                >
                  {label}
                </Button>
              ))}
            </Box>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: { xs: 1, sm: 2 },
                flexShrink: 0,
                "@media (max-width: 370px)": { ml: "auto" },
              }}
            >
              <IconButton
                onClick={toggleMode}
                aria-label={
                  dark ? "Switch to light theme" : "Switch to dark theme"
                }
                sx={{
                  width: 40,
                  height: 40,
                  color: "text.secondary",
                  "& svg": { transition: "transform 350ms ease" },
                  "@media (hover: hover)": {
                    "&:hover svg": { transform: "rotate(18deg) scale(1.08)" },
                  },
                }}
              >
                {dark ? (
                  <LightModeOutlined fontSize="small" />
                ) : (
                  <DarkModeOutlined fontSize="small" />
                )}
              </IconButton>
              <Box
                data-account-summary
                sx={{ display: "flex", alignItems: "center", gap: 1 }}
              >
                <Avatar sx={{ width: 36, height: 36, bgcolor: "#5e81ac" }}>
                  <AccountCircleOutlined fontSize="small" />
                </Avatar>
                <Box sx={{ display: { xs: "none", md: "block" } }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {displayName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Personal account
                  </Typography>
                </Box>
              </Box>
              <IconButton
                onClick={onSignOut}
                aria-label="Sign out"
                sx={{ width: 40, height: 40, color: "text.secondary" }}
              >
                <LogoutOutlined fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        </Box>
        <Box
          component="main"
          sx={{
            maxWidth: 1250,
            mx: "auto",
            px: { xs: 2, sm: 3, md: 5 },
            py: { xs: 3, md: 5 },
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </ThemeProvider>
  );
}
