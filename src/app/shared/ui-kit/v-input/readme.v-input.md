# V-Input

Neumorphic input component with form integration and content projection.

## Basic Usage

```html
<v-input
  label="Username"
  placeholder="Enter your name"
  formControlName="username"
/>
```

## Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `label` | `string` | `''` | Label text |
| `placeholder` | `string` | `''` | Placeholder text |
| `type` | `string` | `'text'` | Input type |
| `isDisabled` | `boolean` | `false` | Disable component |
| `isReadonly` | `boolean` | `false` | Read-only mode |
| `errorMessage` | `string` | `''` | Error message |
| `name` | `string` | `''` | Input name attribute |

## Events

| Event | Type | Description |
|-------|------|-------------|
| `onInputChanged` | `Event` | Value changed |
| `onFocused` | `Event` | Input focused |
| `onBlurred` | `Event` | Input blurred |

## Content Projection

### Prefix & Postfix
```html
<v-input label="Price">
  <span v-prefix>$</span>
  <button v-postfix type="button">🔍</button>
</v-input>
```

## Examples

### With Forms
```typescript
// Component
form = new FormGroup({
  username: new FormControl('', Validators.required),
  email: new FormControl('', [Validators.required, Validators.email]),
  password: new FormControl('', Validators.required)
});
```

```html
<!-- Template -->
<form [formGroup]="form">
  <v-input
    label="Username"
    placeholder="Enter name"
    formControlName="username"
  />

  <v-input
    label="Email"
    type="email"
    placeholder="user@example.com"
    formControlName="email"
  />

  <v-input
    label="Password"
    type="password"
    placeholder="Enter password"
    formControlName="password"
  />
</form>
```

### Input Types
```html
<!-- Text input -->
<v-input type="text" label="Name" />

<!-- Email input -->
<v-input type="email" label="Email" />

<!-- Password input -->
<v-input type="password" label="Password" />

<!-- Number input -->
<v-input type="number" label="Age" />
```

### With Prefix/Postfix
```html
<!-- Currency input -->
<v-input label="Price">
  <span v-prefix>$</span>
  <span v-postfix>USD</span>
</v-input>

<!-- Search input -->
<v-input label="Search" placeholder="Type to search...">
  <button v-postfix type="button">🔍</button>
</v-input>

<!-- Phone input -->
<v-input label="Phone">
  <span v-prefix>+1</span>
</v-input>
```

### States
```html
<!-- Disabled -->
<v-input
  label="Loading"
  placeholder="Please wait..."
  [isDisabled]="true"
/>

<!-- Read-only -->
<v-input
  label="ID"
  value="USER_12345"
  [isReadonly]="true"
/>

<!-- With error -->
<v-input
  label="Required Field"
  formControlName="field"
  errorMessage="This field is required"
/>
```
  label="Password"
  type="password"
  placeholder="Enter password">
  <button v-postfix type="button">👁️</button>
</v-input>

<!-- Currency input with prefix and postfix -->
<v-input
  label="Price"
  type="number"
  placeholder="0.00">
  <span v-prefix>$</span>
  <span v-postfix>USD</span>
</v-input>

<!-- Search input with icon postfix -->
<v-input
  label="Search"
  placeholder="Search products...">
  <button v-postfix type="button" class="search-btn">
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
    </svg>
  </button>
</v-input>

<!-- Disabled field with prefix -->
<v-input
  label="Account Balance"
  placeholder="Loading..."
  [disabled]="true">
  <span v-prefix>$</span>
</v-input>

<!-- Field with error and postfix -->
<v-input
  label="Phone Number"
  placeholder="Enter phone"
  errorMessage="Invalid phone number format">
  <span v-prefix>+1</span>
  <button v-postfix type="button">📱</button>
</v-input>

<!-- Read-only field with prefix -->
<v-input
  label="ID"
  [readonly]="true"
  value="USER_12345">
  <span v-prefix>#</span>
</v-input>
```

## Styling

The component uses neumorphic style with automatic states:

### CSS Variables (from vars.css):
- **Spacing units**: `--unit-1` to `--unit-96` (from 4px to 384px)
- **Text colors**:
  - `--color-text-default` (#374151) - main text
  - `--color-text-muted` (#6b7280) - muted text
  - `--color-text-error` (#ef4444) - error text
- **Background**: `--color-bg-default` (#ebf3fa)
- **Shadows**:
  - `--shadow-dark-light`, `--shadow-dark-medium` - dark shadows
  - `--shadow-light-strong`, `--shadow-light-full` - light shadows

### States:
- **Normal state**: inset effect with soft shadows
- **Focus state**: deeper inset effect
- **Disabled state**: 0.6 opacity and disabled pointer events
- **Error state**: red error text

## Angular Forms Integration

The component is fully compatible with Angular Reactive Forms and Template-driven Forms thanks to the ControlValueAccessor interface implementation.

### Implementation Features:
- Uses modern Angular Signal-based API
- Automatic browser autofill handling
- Support for all standard input attributes
- Built-in validation state support

## Content Projection API

### Prefix Slot
Add content before the input field:
```html
<v-input label="Price">
  <span v-prefix>$</span>
</v-input>
```

### Postfix Slot
Add content after the input field:
```html
<v-input label="Search">
  <button v-postfix type="button">🔍</button>
</v-input>
```

### Combined Usage
Use both prefix and postfix:
```html
<v-input label="Amount">
  <span v-prefix>$</span>
  <select v-postfix>
    <option>USD</option>
    <option>EUR</option>
  </select>
</v-input>
```

### Interactive Elements
Prefix and postfix can contain interactive elements:
```html
<v-input label="Password" type="password">
  <button v-postfix
          type="button"
          (click)="togglePasswordVisibility()">
    {{ showPassword ? '🙈' : '👁️' }}
  </button>
</v-input>
```

### Styling Guidelines
- Prefix and postfix elements should be styled individually as needed
- They are vertically centered within the input wrapper via align-items: center
- They replace input padding, ensuring minimum 8px spacing (var(--unit-2)) even when empty
- Input field takes all remaining space (flex: 1)
- Both are included within the neumorphic frame
