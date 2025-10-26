# V-Modal Component

Simple and flexible modal window component with customizable width, border radius, padding, and close button support.

## Usage

### Basic usage

```html
<v-modal [isOpen]="isModalOpen"
         (onClose)="closeModal()">
  <div>Modal window content</div>
</v-modal>
```

### With header and footer

```html
<v-modal [isOpen]="isModalOpen"
         (onClose)="closeModal()">
  <h2 v-header>Modal window header</h2>
  <div>Main content</div>
  <div v-footer>Footer content</div>
</v-modal>
```

### With close button, custom width and padding

```html
<v-modal [isOpen]="isModalOpen"
         [isCloseButtonVisible]="true"
         width="600px"
         [borderRadius]="3"
         [paddingY]="3"
         [paddingX]="4"
         (onClose)="closeModal()">
  <div>Modal window content</div>
</v-modal>
```

## API

### Inputs

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `isOpen` | `boolean` | `false` | Whether to show the modal window |
| `isCloseButtonVisible` | `boolean` | `false` | Whether to show the close button |
| `width` | `string` | `'400px'` | Modal window width |
| `borderRadius` | `CssUnitValue` | `2` | Corner border radius |
| `paddingY` | `CssUnitValue` | `2` | Vertical padding inside modal content |
| `paddingX` | `CssUnitValue` | `2` | Horizontal padding inside modal content |

### Outputs

| Event | Type | Description |
|-------|------|-------------|
| `onClose` | `void` | Called when modal window is closed |

## Features

- **Auto-sizing**: Modal height adapts to content size
- **Responsive**: Constrains to viewport size with max-width/max-height
- **Closing**: Can be closed by clicking backdrop or optional close button
- **Backdrop**: Uses `VBackdropDirective` to create backdrop overlay
- **Content slots**: Supports `v-header` and `v-footer` slots with automatic styling
- **Z-index management**: Uses `ZLayerService` for proper layering
- **Scroll**: Content body scrolls when overflowing
- **Customizable spacing**: Configurable padding around modal content

## Examples

### Modal window with form and footer

```html
<v-modal [isOpen]="showForm"
         [isCloseButtonVisible]="true"
         width="500px"
         [paddingY]="3"
         [paddingX]="3"
         (onClose)="hideForm()">
  <h3 v-header>Create new entry</h3>

  <form [formGroup]="myForm">
    <v-input label="Title"
             formControlName="title"></v-input>

    <v-input label="Description"
             formControlName="description"></v-input>
  </form>

  <div v-footer class="form-actions">
    <v-button primary (onClick)="saveForm()">Save</v-button>
    <v-button flat (onClick)="hideForm()">Cancel</v-button>
  </div>
</v-modal>
```

### Confirmation dialog

```html
<v-modal [isOpen]="showConfirmation"
         width="350px"
         [borderRadius]="3"
         [paddingY]="2"
         [paddingX]="3"
         (onClose)="cancelAction()">
  <h4 v-header>Confirm action</h4>

  <p>Are you sure you want to delete this item?</p>

  <div v-footer>
    <v-button danger (onClick)="confirmDelete()">Delete</v-button>
    <v-button flat (onClick)="cancelAction()">Cancel</v-button>
  </div>
</v-modal>
```

### Compact modal with no padding

```html
<v-modal [isOpen]="showInfo"
         width="300px"
         [paddingY]="0"
         [paddingX]="0"
         (onClose)="closeInfo()">
  <div v-header>Quick Info</div>
  <p>This is a compact modal with minimal spacing.</p>
  <div v-footer>
    <v-button flat (onClick)="closeInfo()">OK</v-button>
  </div>
</v-modal>
```
