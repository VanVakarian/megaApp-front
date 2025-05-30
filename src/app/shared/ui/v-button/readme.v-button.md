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
- Uses directive attributes (`flat`, `raised`, `primary`) like Angular Material
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
```

**Important**: You must use one of the directive attributes (`flat`, `raised`, or `primary`). The component requires at least one directive to function properly.

## Usage with Click Handler

```html
<v-button flat (onClick)="handleClick($event)">
  Submit
</v-button>

<v-button primary (onClick)="handleImportantAction($event)">
  Important Action
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

**Note**: Directives are mutually exclusive - use only one per button instance.

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

## Styling Features

- Inherits font family and respects parent font settings
- Uses neumorphic design consistent with other v-components
- Smooth transitions for all state changes
- Uses CSS custom properties from vars.css for theming
- Responsive to theme changes (light/dark mode support)
- Directive-based styling like Angular Material

## Technical Notes

- Standalone component, no additional imports needed
- **Requires directive attributes** - selector: `'v-button[flat], v-button[raised], v-button[primary]'`
- Emits `onClick` event with native MouseEvent
- Uses semantic HTML button element for accessibility
- Cursor automatically changes to pointer on hover
- Disabled state prevents all pointer events and reduces opacity
- Uses modern Angular signals with `output()` for event emission

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
```
