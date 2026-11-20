import LockOutlined from "@mui/icons-material/LockOutlined";
import {
  Box,
  Card,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from "@mui/material";

const steps = [
  ["Reserved", "Your funds are set aside."],
  ["Checking", "We review the transfer securely."],
  ["Sent", "The money reaches its destination."],
] as const;

export function HowItWorks() {
  return (
    <Stack spacing={2.5}>
      <Card sx={{ p: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 750 }}>
          How it works
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.5, mb: 3 }}
        >
          We’ll keep you informed along the way.
        </Typography>
        <Stepper activeStep={-1} orientation="vertical">
          {steps.map(([label, detail]) => (
            <Step key={label}>
              <StepLabel
                optional={
                  <Typography variant="caption" color="text.secondary">
                    {detail}
                  </Typography>
                }
              >
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Card>
      <Card sx={{ p: 3, bgcolor: "action.hover" }}>
        <Stack direction="row" spacing={1.5}>
          <LockOutlined color="primary" />
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 750 }}>
              A little extra care
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Some transfers may need a quick verification before they can be
              completed.
            </Typography>
          </Box>
        </Stack>
      </Card>
    </Stack>
  );
}
