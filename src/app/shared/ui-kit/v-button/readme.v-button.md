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

<!-- Using buttonStyle input (alternative approach) -->
<v-button [buttonStyle]="ButtonStyle.Primary">
  Primary via Input
</v-button>
```

**Important**: You must use either one of the directive attributes (`flat`, `raised`, or `primary`) OR the `buttonStyle` input. The component requires at least one styling approach to function properly.

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

### `paddingY` и `paddingX`
Настройка внутренних отступов кнопки с использованием системы unit-значений:
```html
<!-- Компактная кнопка -->
<v-button flat [paddingY]="1" [paddingX]="2">Compact</v-button>

<!-- Увеличенная кнопка -->
<v-button raised [paddingY]="3" [paddingX]="6">Large</v-button>

<!-- По умолчанию: paddingY=2 (8px), paddingX=4 (16px) -->
<v-button primary>Default Padding</v-button>
```

**Доступные значения**: любые значения из `CssUnitValue` (1-96), соответствующие CSS переменным `--unit-{число}` из `vars.css`.

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

## Styling Features

- Inherits font family and respects parent font settings
- Uses neumorphic design consistent with other v-components
- Smooth transitions for all state changes
- Uses CSS custom properties from vars.css for theming
- Responsive to theme changes (light/dark mode support)
- Directive-based styling like Angular Material

## Technical Notes

- Standalone component, no additional imports needed
- **Requires directive attributes OR buttonStyle input** - selector: `'v-button[flat], v-button[raised], v-button[primary], v-button[buttonStyle]'`
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
- **buttonStyle**: `ButtonStyle` - Стиль кнопки (Flat, Raised, Primary)
- **width**: `string` - Ширина кнопки
- **isLabelHidden**: `boolean` - Скрывает основной текст кнопки (по умолчанию: false)
- **paddingY**: `CssUnitValue` - Вертикальный padding (по умолчанию: 2 = 8px)
- **paddingX**: `CssUnitValue` - Горизонтальный padding (по умолчанию: 4 = 16px)

### Outputs
- **onClick**: `MouseEvent` - Событие клика

### Directive Attributes
- **flat**: Плоская кнопка с hover-эффектами
- **raised**: Приподнятая кнопка с постоянными тенями
- **primary**: Основная кнопка с градиентным фоном

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
          (onClick)="handleDynamicClick($event)">
  Dynamic Button
</v-button>
```
