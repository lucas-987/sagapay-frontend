# Browser visual reference

The PNGs capture Activity and Send money with synthetic data in the light
and dark themes. Each has a mobile viewport of 390 × 844 CSS pixels and a
desktop viewport of 1280 × 960 CSS pixels. Activity also shows the details
of a transfer awaiting verification. Send money also shows the open
recipient options.

The `header-*.png` images are the comparison inputs for the shared shell.
They use Playwright's Chromium on Linux at device scale 1 with reduced
motion. The comparison uses DejaVu Sans to stabilize font rendering.
It also masks the account summary and gives that area the same dimensions
on desktop so the theme switch can be compared in place.

Each comparison allows at most 1% differing pixels at a per-pixel
threshold of 0.15. Use the screen images as the visual reference when
building the Activity and Send money content.
