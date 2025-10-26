# V-Button

Neumorphic button with attribute-based style modes and a single typed config for all settings.

## Overview

- Two ways to select style: attribute (`flat`, `raised`, `primary`, `danger`) or `config.buttonStyle`.
- All other settings (size, width, behavior, states) are configured via a single `[config]` object.
- Prefix/postfix content via `v-prefix` / `v-postfix` for icons and badges.
- Built with modern Angular signals.

## Anatomy

```
<v-button ...>
  <button>
    <ng-content select="[v-prefix]" />
    <div class="btn-text"><ng-content /></div>
    <ng-content select="[v-postfix]" />
  </button>
</v-button>
```

## Styling modes

- `flat` — clean flat look with subtle hover effects
- `raised` — elevated with permanent shadows
- `primary` — gradient primary button
- `danger` — destructive/alert action

Choose a mode either by attribute or with `config.buttonStyle` (enum `ButtonStyle`). Use only one approach per button.

## Quick start

```html
<!-- Attribute-based style -->
<v-button primary>Primary</v-button>

<!-- Programmatic style via config -->
<v-button [config]="{ buttonStyle: ButtonStyle.Raised }">Raised</v-button>
```

## Config API

```ts
interface VButtonConfig {
  type?: 'button' | 'submit' | 'reset';
  buttonStyle?: ButtonStyle;           // Primary | Raised | Flat | Danger
  width?: string;                      // '100%', '240px', etc.
  isLabelHidden?: boolean;             // hides main label text
  paddingY?: CssUnitValue;             // vertical padding (unit system)
  paddingX?: CssUnitValue;             // horizontal padding
  isDisabled?: boolean;                // disabled state
  isWithoutShadow?: boolean;           // removes all shadows
  bgOpacity?: '0' | '1' | `0.${number}`; // background opacity
}
```

Defaults: `type='button'`, `paddingY=2`, `paddingX=4`, `isDisabled=false`, `isWithoutShadow=false`, `bgOpacity='1'`.

## Usage patterns (minimal but diverse)

```html
<!-- 1) Icon-only: hide label, no shadows, compact paddings -->
<v-button flat [config]="{ isLabelHidden: true, isWithoutShadow: true, paddingX: 2 }">
  <span v-prefix>⚙️</span>
  Settings
</v-button>

<!-- 2) Destructive action with custom paddings -->
<v-button danger [config]="{ paddingY: 1, paddingX: 6 }">Delete</v-button>

<!-- 3) Full width + programmatic style -->
<v-button [config]="{ buttonStyle: ButtonStyle.Primary, width: '100%' }">Continue</v-button>

<!-- 4) Transparent background (bgOpacity=0), e.g. prefix button near input -->
<v-button flat [config]="{ bgOpacity: '0', paddingX: 0, paddingY: 0 }">
  <span v-prefix>✕</span>
</v-button>

<!-- 5) Disabled state -->
<v-button primary [config]="{ isDisabled: true }">Disabled</v-button>
```

## Content projection

- Prefix: `[v-prefix]` — rendered to the left of the label (icon, indicator)
- Main label: projected content, can be hidden via `isLabelHidden`
- Postfix: `[v-postfix]` — rendered to the right (badge, arrow, hotkey)

Example:

```html
<v-button raised>
  <span v-prefix>🔍</span>
  Search
  <span v-postfix>→</span>
</v-button>
```

## Accessibility

- Semantic `<button>` with `type` and `disabled` support.
- `aria-disabled` is set automatically.
- Provide meaningful text or an `aria-label` when using `isLabelHidden`.

## Theming & CSS vars

- Paddings use unit system: `--unit-N` (see `vars.css`).
- Background opacity is controlled via `--v-button-bg-opacity` by `config.bgOpacity`.
- Colors are driven by theme variables (`--color-*`).

## Sizing & layout

- Width: use `config.width` or plain CSS classes/styles on `v-button`.
- Label text is wrapped in `.btn-text` for predictable layout.

## Behavior & states

- Hover/active visuals depend on the selected style.
- `isWithoutShadow` disables all shadows, including hover/active.
- Disabled blocks pointer events and reduces opacity.

## Events

- `onClick: MouseEvent` — emitted on click (when not disabled).

## Best practices

- Choose either attribute style or `config.buttonStyle`, not both.
- When hiding the label, set an accessible `aria-label` if needed.
- Prefer unit values for paddings to keep consistent spacing.
- Keep buttons concise; use postfix/prefix for icons and badges.
