# Visualization Dashboards Completion Plan

## Goal Description
Finish the implementation of `SensoryProfile.tsx` and `EnergyRegulation.tsx` by upgrading their UI to match the application's "Liquid Glass" aesthetic, replacing Material Symbols with Lucide React icons, and translating all content to Norwegian to match the rest of the application.

## User Review Required
> [!IMPORTANT]
> - Confirm if "Interosepsjon" is the preferred translation for Interoception in this context.
> - Confirm if the current English placeholder texts in `EnergyRegulation` (AI Insights) should be replaced with Norwegian static placeholders or functional logic.

## Proposed Changes

### Components
#### [MODIFY] [SensoryProfile.tsx](file:///Users/quentinthiessen/Desktop/kreaaaa/neurolog-pro/src/components/SensoryProfile.tsx)
- Translate UI text to Norwegian ("Today" -> "I dag", "Sensory Profile" -> "Sensorisk Profil", etc.).
- Replace `material-symbols-outlined` with `lucide-react` icons (`ArrowLeft`, `Activity`, `Info`, etc.).
- Update styling to use `liquid-glass-card` classes for consistency.
- Ensure the Radar Chart legend matches Norwegian terms.

#### [MODIFY] [EnergyRegulation.tsx](file:///Users/quentinthiessen/Desktop/kreaaaa/neurolog-pro/src/components/EnergyRegulation.tsx)
- Translate headers and labels to Norwegian ("Energy & Regulation" -> "Energi & Regulering", "Current Energy" -> "Nåværende Energi").
- Replace `material-symbols-outlined` with `lucide-react` icons.
- Apply "Liquid Glass" styling to cards and containers.
- Standardize the "Spoon Battery" visualization to match importance.

## Verification Plan

### Manual Verification
1.  **Sensory Profile**:
    - Navigate to "/sensory-profile".
    - Verify all text is in Norwegian.
    - Check that icons are consistent (Lucide style).
    - Verify the Radar Chart renders correctly with Norwegian labels.
2.  **Energy Regulation**:
    - Navigate to "/energy-regulation".
    - Verify all text is in Norwegian.
    - Check that icons are consistent.
    - Verify the "Spoon Battery" and Area Chart render correctly.
3.  **Responsiveness**:
    - Resize user window to mobile size to ensure liquid glass cards look good on smaller screens.
