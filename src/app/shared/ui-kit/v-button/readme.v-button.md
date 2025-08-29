# V-Button Component Usage Examples

## Component Architecture

The component has the following structure:
```
:host (inline-block container with optional directive attributes)
└── button (neumorphic button)
    └── ng-content (projected content)
```

**Key Features**:
- The neumorphic styling is applied to the button element, creating different visual appearances
- Uses directive attributes (`flat`, `raised`, `primary`, `danger`) like Angular Material
- **Requires** one of the directive attributes to function - plain `<v-button>` won't work
- The button responds to interactions with visual state changes (hover, active, disabled)
- Each directive provides distinct styling behavior

## Basic Usage

```html
<!-- Flat button with hover effects -->
<v-button flat>
  Click me
</v-button>

<!-- Raised button with permanent shadows -->
<v-button raised>
  Raised Button
</v-button>

<!-- Primary color button with gradient background -->
<v-button primary>
  Primary Button
</v-button>

<!-- Danger button for destructive actions -->
<v-button danger>
  Delete
</v-button>

<!-- Using buttonStyle input (alternative approach) -->
<v-button [buttonStyle]="ButtonStyle.Primary">
  Primary via Input
</v-button>
```

**Important**: You must use either one of the directive attributes (`flat`, `raised`, `primary`, or `danger`) OR the `buttonStyle` input. The component requires at least one styling approach to function properly.

## Usage with Click Handler

```html
<v-button flat (onClick)="handleClick($event)">
  Submit
</v-button>

<v-button primary (onClick)="handleImportantAction($event)">
  Important Action
</v-button>

<!-- Using buttonStyle input -->
<v-button [buttonStyle]="ButtonStyle.Raised" (onClick)="handleAction($event)">
  Programmatic Style
</v-button>
```

## Directive Attributes (Material-like)

### `flat`
Creates a clean button with no shadows by default, adding subtle shadows on hover:
```html
<v-button flat>Flat Button</v-button>
```

### `raised`
Adds neumorphic raised appearance with permanent shadows:
```html
<v-button raised>Raised Button</v-button>
```

### `primary`
Applies primary color scheme with gradient background and permanent shadows:
```html
<v-button primary>Primary Button</v-button>
```

### `danger`
Applies danger/destructive action styling:
```html
<v-button danger>Delete Item</v-button>
```

**Note**: Directives are mutually exclusive - use only one per button instance.

## Input Properties

### `buttonStyle`
Programmatically set the button style using the ButtonStyle enum:
```typescript
import { ButtonStyle } from './v-button';

// In your component
buttonStyle = ButtonStyle.Primary;
```
```html
<v-button [buttonStyle]="buttonStyle">Dynamic Style</v-button>
<v-button [buttonStyle]="ButtonStyle.Flat">Static Style</v-button>
<v-button [buttonStyle]="ButtonStyle.Danger">Danger Style</v-button>
```

### `width`
Set the button width:
```html
<v-button flat width="200px">Fixed Width</v-button>
<v-button raised width="100%">Full Width</v-button>
```

### `isLabelHidden`
Hide the main button text while keeping prefix/postfix content:
```html
<!-- Icon-only button with hidden label -->
<v-button flat [isLabelHidden]="true">
  <span v-prefix>🔍</span>
  Search <!-- This text will be hidden -->
  <span v-postfix>→</span>
</v-button>

<!-- Toggle label visibility -->
<v-button raised [isLabelHidden]="hideLabel">
  <span v-prefix>💾</span>
  Save Document
</v-button>
```

### `paddingY` and `paddingX`
Configure button internal padding using the unit-value system:
```html
<!-- Compact button -->
<v-button flat [paddingY]="1" [paddingX]="2">Compact</v-button>

<!-- Large button -->
<v-button raised [paddingY]="3" [paddingX]="6">Large</v-button>

<!-- Default: paddingY=2 (8px), paddingX=4 (16px) -->
<v-button primary>Default Padding</v-button>
```

**Available values**: any values from `CssUnitValue` (1-96), corresponding to CSS variables `--unit-{number}` from `vars.css`.

### `noShadow`
Disable all button shadows:
```html
<!-- Button without shadows -->
<v-button raised [noShadow]="true">No Shadows</v-button>

<!-- Dynamic shadow toggle -->
<v-button primary [noShadow]="disableShadows">Toggle Shadows</v-button>

<!-- Flat button without hover shadows -->
<v-button flat [noShadow]="true">Clean Flat</v-button>
```

This parameter completely disables all shadows (including hover and active states) regardless of the selected button style.

### `isDisabled`
Disable the button:
```html
<!-- Disabled button -->
<v-button primary [isDisabled]="true">Disabled</v-button>

<!-- Dynamic disable -->
<v-button raised [isDisabled]="isProcessing">Submit</v-button>
```

Disabled button doesn't respond to clicks and has reduced opacity.

## Usage with Content Projection

```html
<!-- Button with icon and text -->
<v-button raised>
  <span>🚀</span>
  Launch
</v-button>

<!-- Button with complex content -->
<v-button primary>
  <div style="display: flex; align-items: center; gap: 8px;">
    <span>📊</span>
    <span>View Stats</span>
  </div>
</v-button>

<!-- Button with only icon -->
<v-button flat>
  ⚙️
</v-button>

<!-- Button with prefix and postfix content -->
<v-button raised>
  <span v-prefix>🔍</span>
  Search
  <span v-postfix>→</span>
</v-button>

<!-- Complex layout with prefix/postfix -->
<v-button primary>
  <div v-prefix class="icon">💾</div>
  Save Document
  <div v-postfix class="badge">Ctrl+S</div>
</v-button>

<!-- Icon-only button using isLabelHidden -->
<v-button flat [isLabelHidden]="true">
  <span v-prefix>⚙️</span>
  Settings <!-- Hidden label for accessibility -->
</v-button>

<!-- Button with conditional label visibility -->
<v-button raised [isLabelHidden]="isCompactMode">
  <span v-prefix>📊</span>
  Statistics
  <span v-postfix class="count">42</span>
</v-button>
```

## Visual States

The button automatically handles the following visual states:

### Flat:
- **Normal**: Clean flat appearance with no shadows
- **Hover**: Subtle neumorphic shadows appear on hover
- **Active/Pressed**: Inset shadows creating "pressed" effect

### Raised:
- **Normal**: Raised appearance with permanent neumorphic shadows
- **Hover**: Enhanced shadows for increased depth feedback
- **Active/Pressed**: Inset shadows creating "pressed" effect

### Primary:
- **Normal**: Gradient background (indigo shades) with permanent shadows and white text
- **Hover**: Enhanced shadows for depth feedback
- **Active/Pressed**: Inverted gradient creating visual feedback

### Danger:
- **Normal**: Danger color scheme for destructive actions
- **Hover**: Enhanced shadows for depth feedback
- **Active/Pressed**: Visual feedback for destructive action confirmation

## Styling Features

- Inherits font family and respects parent font settings
- Uses neumorphic design consistent with other v-components
- Smooth transitions for all state changes
- Uses CSS custom properties from vars.css for theming
- Responsive to theme changes (light/dark mode support)
- Directive-based styling like Angular Material

## Technical Notes

- Standalone component, no additional imports needed
- **Requires directive attributes OR buttonStyle input** - selector: `'v-button[flat], v-button[raised], v-button[primary], v-button[danger], v-button[buttonStyle]'`
- Emits `onClick` event with native MouseEvent
- Uses semantic HTML button element for accessibility
- Cursor automatically changes to pointer on hover
- Disabled state prevents all pointer events and reduces opacity
- Uses modern Angular signals with `input()` and `output()` for all properties and events
- Supports prefix/postfix content projection with `v-prefix` and `v-postfix` selectors
- Width can be controlled via input property or CSS styling
- Main button text can be hidden using `isLabelHidden` while preserving prefix/postfix content
- Button text is wrapped in `.btn-text` div when visible for better styling control

## API

### Inputs
- **buttonStyle**: `ButtonStyle` - Button style (Flat, Raised, Primary, Danger)
- **width**: `string` - Button width
- **isLabelHidden**: `boolean` - Hides main button text (default: false)
- **paddingY**: `CssUnitValue` - Vertical padding (default: 2 = 8px)
- **paddingX**: `CssUnitValue` - Horizontal padding (default: 4 = 16px)
- **noShadow**: `boolean` - Disables all shadows (default: false)
- **isDisabled**: `boolean` - Disables button (default: false)

### Outputs
- **onClick**: `MouseEvent` - Click event

### Directive Attributes
- **flat**: Flat button with hover effects
- **raised**: Raised button with permanent shadows
- **primary**: Primary button with gradient background
- **danger**: Button for destructive actions

## Event Handling

```typescript
// In your component
handleButtonClick(event: MouseEvent) {
  console.log('Button clicked:', event);
  // Your click logic here
}
```

```html
<!-- In your template -->
<v-button primary (onClick)="handleButtonClick($event)">
  Handle Click
</v-button>

<!-- With dynamic styling -->
<v-button [buttonStyle]="ButtonStyle.Raised"
          [width]="'250px'"
          [noShadow]="disableShadows"
          [isDisabled]="isProcessing"
          (onClick)="handleDynamicClick($event)">
  Dynamic Button
</v-button>
```
