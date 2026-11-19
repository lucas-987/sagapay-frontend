import { Typography } from "@mui/material";

export function PageNotFound() {
  return (
    <>
      <Typography component="h1" variant="h4" gutterBottom>
        Page not found
      </Typography>
      <Typography color="text.secondary">
        Choose Activity or Send money from the navigation.
      </Typography>
    </>
  );
}

export function RouteFailure() {
  return (
    <>
      <Typography component="h1" variant="h4" gutterBottom>
        This page could not be displayed
      </Typography>
      <Typography color="text.secondary">
        Choose another page from the navigation.
      </Typography>
    </>
  );
}

export function ApplicationFailure() {
  return (
    <main>
      <h1>SagaPay could not start</h1>
      <p>Reload the page to try again.</p>
    </main>
  );
}
