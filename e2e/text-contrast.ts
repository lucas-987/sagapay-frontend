import type { Page } from "@playwright/test";

export async function findLowContrastText(page: Page) {
  const textRuns = await page.evaluate(() => {
    const runs = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    const range = document.createRange();

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      const text = node.textContent?.trim();
      if (
        !text ||
        !parent?.checkVisibility({
          checkOpacity: true,
          checkVisibilityCSS: true,
        })
      ) {
        continue;
      }

      if (parent.closest('[role="img"][aria-label]')) continue;

      const style = getComputedStyle(parent);
      const fontSize = Number.parseFloat(style.fontSize);
      const isLarge =
        fontSize >= 24 ||
        (fontSize >= 18.67 && Number(style.fontWeight) >= 700);
      range.selectNodeContents(node);

      for (const rect of range.getClientRects()) {
        const left = Math.max(0, Math.floor(rect.left));
        const top = Math.max(0, Math.floor(rect.top));
        const right = Math.min(window.innerWidth, Math.ceil(rect.right));
        const bottom = Math.min(window.innerHeight, Math.ceil(rect.bottom));
        if (left < right && top < bottom) {
          runs.push({
            text,
            color: style.webkitTextFillColor,
            minimum: isLarge ? 3 : 4.5,
            left,
            top,
            width: right - left,
            height: bottom - top,
          });
        }
      }
    }

    return runs;
  });

  const hideText = await page.addStyleTag({
    content: "* { -webkit-text-fill-color: transparent !important; }",
  });

  // The screenshot measures gradients and translucent surfaces as rendered behind the text.
  const background = await page.screenshot({
    animations: "disabled",
    scale: "css",
  });
  await hideText.evaluate((element) =>
    element.parentNode?.removeChild(element),
  );

  return page.evaluate(
    async ({ png, textRuns }) => {
      function luminance(red: number, green: number, blue: number) {
        function linear(channel: number) {
          const srgb = channel / 255;
          return srgb <= 0.04045
            ? srgb / 12.92
            : ((srgb + 0.055) / 1.055) ** 2.4;
        }

        return (
          0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue)
        );
      }

      const image = new Image();
      image.src = `data:image/png;base64,${png}`;
      await image.decode();

      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      const swatch = document.createElement("canvas").getContext("2d");
      if (!context || !swatch) {
        throw new Error("Could not sample the rendered text and background");
      }
      context.drawImage(image, 0, 0);

      const violations = [];
      for (const run of textRuns) {
        const pixelData = context.getImageData(
          run.left,
          run.top,
          run.width,
          run.height,
        );
        const { data: pixels } = pixelData;
        swatch.clearRect(0, 0, 1, 1);
        swatch.fillStyle = run.color;
        swatch.fillRect(0, 0, 1, 1);
        const { data: foreground } = swatch.getImageData(0, 0, 1, 1);

        const [red, green, blue, alpha] = [
          foreground[0] ?? 0,
          foreground[1] ?? 0,
          foreground[2] ?? 0,
          (foreground[3] ?? 0) / 255,
        ];
        let minimum = Infinity;
        let overlapColor = [0, 0, 0];
        for (let offset = 0; offset < pixels.length; offset += 4) {
          const backgroundRed = pixels[offset] ?? 0;
          const backgroundGreen = pixels[offset + 1] ?? 0;
          const backgroundBlue = pixels[offset + 2] ?? 0;
          const background = luminance(
            backgroundRed,
            backgroundGreen,
            backgroundBlue,
          );
          const text = luminance(
            red * alpha + backgroundRed * (1 - alpha),
            green * alpha + backgroundGreen * (1 - alpha),
            blue * alpha + backgroundBlue * (1 - alpha),
          );
          const ratio =
            (Math.max(text, background) + 0.05) /
            (Math.min(text, background) + 0.05);
          if (ratio < minimum) {
            minimum = ratio;
            overlapColor = [backgroundRed, backgroundGreen, backgroundBlue];
          }
        }

        if (minimum < run.minimum) {
          violations.push({
            text: run.text,
            ratio: minimum,
            required: run.minimum,
            foreground: run.color,
            background: overlapColor,
          });
        }
      }

      return { text: textRuns.map((run) => run.text), violations };
    },
    { png: background.toString("base64"), textRuns },
  );
}
