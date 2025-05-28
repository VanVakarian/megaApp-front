# V-Input Component Usage Examples

## Component Architecture

The component has the following structure:
```
:host
├── label (outside neumorphic frame)
├── .input-wrapper (neumorphic frame)
│   ├── [v-prefix] (optional prefix content)
│   ├── input (input field itself)
│   └── [v-postfix] (optional postfix content)
└── error-message (outside neumorphic frame)
```

**Key Features**:
- The neumorphic frame is applied to the entire input container including prefix and postfix
- Prefix and postfix replace input padding, taking content space or minimum 8px (var(--unit-2))
- Input field takes all remaining space (flex: 1)
- Label and error message are positioned outside the visual container

## Basic Usage

```html
<!-- Simple input -->
<v-input
  label="Username"
  placeholder="Enter your name"
/>

<!-- Input with postfix -->
<v-input
  label="Search"
  placeholder="Type to search...">
  <button v-postfix type="button">🔍</button>
</v-input>

<!-- Input with prefix -->
<v-input
  label="Price"
  placeholder="0.00">
  <span v-prefix>$</span>
</v-input>

<!-- Input with both prefix and postfix -->
<v-input
  label="Amount"
  placeholder="Enter amount">
  <span v-prefix>$</span>
  <span v-postfix>USD</span>
</v-input>
```

## Usage with Reactive Forms

```typescript
// In component:
import { FormControl, FormGroup, Validators } from '@angular/forms';

export class ExampleComponent {
  userForm = new FormGroup({
    username: new FormControl('', [Validators.required, Validators.minLength(3)]),
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)])
  });

  get username() { return this.userForm.get('username'); }
  get email() { return this.userForm.get('email'); }
  get password() { return this.userForm.get('password'); }
}
```

```html
<!-- In template: -->
<form [formGroup]="userForm">
  <v-input
    label="Username"
    placeholder="Enter your name"
    formControlName="username"
    [errorMessage]="username?.invalid && username?.touched ? 'Username is required (minimum 3 characters)' : ''"
  />

  <v-input
    label="Email"
    type="email"
    placeholder="example@email.com"
    formControlName="email"
    [errorMessage]="email?.invalid && email?.touched ? 'Please enter a valid email' : ''"
  />

  <v-input
    label="Password"
    type="password"
    placeholder="Enter password"
    formControlName="password"
    [errorMessage]="password?.invalid && password?.touched ? 'Password must contain at least 6 characters' : ''"
  />
</form>
```

## Available Properties

### Input Properties (Signal-based API)
- `label`: input<string>('') - Label text above the field
- `placeholder`: input<string>('') - Placeholder text
- `type`: input<string>('text') - Input type (text, email, password, etc.)
- `disabled`: input<boolean>(false) - Disable the field
- `readonly`: input<boolean>(false) - Read-only mode
- `required`: input<boolean>(false) - Required field
- `errorMessage`: input<string>('') - Error message

### Output Events (Signal-based API)
- `onInputChanged`: output<Event>() - Event fired when value changes
- `onFocused`: output<Event>() - Event fired when field gains focus
- `onBlurred`: output<Event>() - Event fired when field loses focus

### Methods
- `focus()`: void - Programmatically set focus on the field
- `writeValue(value: string)`: void - Set value (ControlValueAccessor)

## Different State Examples

```html
<!-- Basic field -->
<v-input
  label="Username"
  placeholder="Enter your name" />

<!-- Email field with icon postfix -->
<v-input
  label="Email"
  type="email"
  placeholder="example@email.com">
  <i v-postfix class="fa fa-envelope"></i>
</v-input>

<!-- Password field with visibility toggle -->
<v-input
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
