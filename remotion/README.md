# Betcha Promotional Video

This folder contains the Remotion composition for your HackMIT promotional video.

## Structure

- `Root.tsx` - Main Remotion composition entry point
- `compositions/BetchaPromo.tsx` - Main video composition (54 seconds)
- `scenes/` - Individual scene components:
  - `Title.tsx` - Opening title screen (15 seconds)
  - `Problem.tsx` - Problem statement (10 seconds)
  - `Solution.tsx` - Feature showcase (15 seconds)
  - `DemoFlow.tsx` - How it works (10 seconds)
  - `CTA.tsx` - Call to action (4 seconds)

## Generate the video

```bash
# Preview in browser
npm run video:preview

# Render to MP4
npm run video
```

The rendered video will be saved to `out/betcha-promo.mp4`.

## Customization

Edit the scenes to:
- Change colors and fonts in `styles.css`
- Update text and messaging in individual scene files
- Adjust timing in `BetchaPromo.tsx`
- Add animations or effects as needed
