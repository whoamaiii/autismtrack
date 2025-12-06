# Refine Risk Forecast Design

The goal is to update the `RiskForecast` component to use the "liquid glass" design language consistent with the rest of the application, replacing the current solid gradient background.

## User Review Required
None. This is a design polish task requested by the user.

## Proposed Changes

### Styles
#### [MODIFY] [index.css](file:///Users/quentinthiessen/Desktop/kreaaaa/neurolog-pro/src/index.css)
- Add `liquid-glass-orange` utility class for "Moderate" risk level to match the existing red and blue variants.

### Components
#### [MODIFY] [RiskForecast.tsx](file:///Users/quentinthiessen/Desktop/kreaaaa/neurolog-pro/src/components/RiskForecast.tsx)
- Replace dynamic `bg-gradient-to-br` classes with static `liquid-glass-*` utility classes based on risk level.
- Adjust text colors to ensure readability against the semi-transparent glass background (likely keeping them white or using light/dark variants depending on contrast, but glass usually works well with white text + shadows).
- Remove the solid background opacity pattern if it conflicts with the glass blur.

## Verification Plan
### Manual Verification
- Check the "Dagens Prognose" card on the Dashboard/Home.
- Verify "Low Risk" uses `liquid-glass-blue`.
- Verify "Moderate Risk" uses the new `liquid-glass-orange`.
- Verify "High Risk" uses `liquid-glass-red`.
- Ensure the background shader is visible through the card.
