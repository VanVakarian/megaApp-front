# V-Input Component Usage Examples

## Component Architecture

The component has the following structure:
```
:host
├── label (outside neumorphic frame)
├── .input-wrapper (neumorphic frame)
│   └── input (input field itself)
└── error-message (outside neumorphic frame)
```

**Key Feature**: The neumorphic frame is applied only to the input field, while the label and error message are positioned outside this visual container.

## Basic Usage

```html
<v-input
  label="Username"
  placeholder="Enter your name"
/>
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

<!-- Email field -->
<v-input
  label="Email"
  type="email"
  placeholder="example@email.com" />

<!-- Password field -->
<v-input
  label="Password"
  type="password"
  placeholder="Enter password" />

<!-- Disabled field -->
<v-input
  label="Disabled field"
  placeholder="This field is disabled"
  [disabled]="true" />

<!-- Field with error -->
<v-input
  label="Field with error"
  placeholder="Enter something"
  errorMessage="This field is required" />

<!-- Read-only field -->
<v-input
  label="Read-only field"
  [readonly]="true"
  placeholder="Cannot edit this" />
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
