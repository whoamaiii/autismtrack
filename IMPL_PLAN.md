# IMPL_PLAN: UI/UX Consistency & Dark Mode Shader Theme

## Goal Description
Ensure the entire application adheres to the "Dark Mode Liquid Glass" theme with the background shader visible and consistent. Improve readability and spacing across all components.

## User Review Required
> [!IMPORTANT]
> This refactor will standardize the look of all cards and containers to use the `liquid-glass-card` utility. This might slightly alter the visual weight of some existing components but will ensure consistency.

## Proposed Changes

### Global Styles
#### [MODIFY] [index.css](file:///Users/quentinthiessen/Desktop/kreaaaa/neurolog-pro/src/index.css)
- Refine `.liquid-glass-card` for better contrast if needed.
- Ensure text utilities for high contrast on glass backgrounds are available (e.g., `text-shadow` for readability).

### Components
I will review and update the following components to ensure they use `liquid-glass-card` and proper text coloring:

#### [MODIFY] [Home.tsx](file:///Users/quentinthiessen/Desktop/kreaaaa/neurolog-pro/src/components/Home.tsx)
- Ensure main navigation cards use the consistent liquid glass style.

#### [MODIFY] [Reports.tsx](file:///Users/quentinthiessen/Desktop/kreaaaa/neurolog-pro/src/components/Reports.tsx)
- Check that the report containers and charts are legible against the background.

#### [MODIFY] [GoalTracking.tsx](file:///Users/quentinthiessen/Desktop/kreaaaa/neurolog-pro/src/components/GoalTracking.tsx)
- Unify card styles.

#### [MODIFY] [BehaviorInsights.tsx](file:///Users/quentinthiessen/Desktop/kreaaaa/neurolog-pro/src/components/BehaviorInsights.tsx)
#### [MODIFY] [SensoryProfile.tsx](file:///Users/quentinthiessen/Desktop/kreaaaa/neurolog-pro/src/components/SensoryProfile.tsx)
#### [MODIFY] [EnergyRegulation.tsx](file:///Users/quentinthiessen/Desktop/kreaaaa/neurolog-pro/src/components/EnergyRegulation.tsx)
#### [MODIFY] [DysregulationHeatmap.tsx](file:///Users/quentinthiessen/Desktop/kreaaaa/neurolog-pro/src/components/DysregulationHeatmap.tsx)
#### [MODIFY] [TransitionInsights.tsx](file:///Users/quentinthiessen/Desktop/kreaaaa/neurolog-pro/src/components/TransitionInsights.tsx)
- Review these dashboards for consistent container styling.

### Layout
#### [MODIFY] [Layout.tsx](file:///Users/quentinthiessen/Desktop/kreaaaa/neurolog-pro/src/components/Layout.tsx)
- Ensure the main content z-index is correct so it doesn't get obscured by the shader or obscure the shader too much (opacity tweaks).

## Verification Plan

### Manual Verification
1.  **Visual Walkthrough**:
    - Open the app in the browser (`http://localhost:5173`).
    - Navigate to each of the distinct sections: Home, Reports, Goals, Behavior, Sensory, Energy, Heatmap, Transitions.
    - **Checklist per page**:
        - Is the background shader visible?
        - Are the containers using the "liquid glass" effect?
        - Is the text clearly readable (no dark text on dark background)?
2.  **Responsiveness**:
    - Check on refined window sizes (mobile vs desktop shader fallback).
