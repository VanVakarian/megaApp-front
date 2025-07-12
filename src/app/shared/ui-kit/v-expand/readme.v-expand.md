# V-Expand Component Usage Examples

## Component Architecture

The component has the following structure:
```
:host (v-expand container)
└── .header (clickable header)
    └── ng-content [v-header] (projected header content)
└── .body (expandable body)
    └── ng-content [v-body] (projected body content)
```

**Key Features**:
- A container that can be expanded or collapsed to show or hide content.
- The header is always visible and acts as a toggle.
- The body contains the content that is shown or hidden.
- Can be used as a standalone component or as part of an accordion.

## Basic Usage

```html
<v-expand [expanded]="true">
  <div v-header>
    Header
  </div>
  <div v-body>
    Body content
  </div>
</v-expand>
```

## Accordion Usage

To use multiple `v-expand` components as an accordion (where only one can be open at a time), use the `accordion` directive.

```html
<div accordion>
  <v-expand>
    <div v-header>Item 1</div>
    <div v-body>Content 1</div>
  </v-expand>
  <v-expand>
    <div v-header>Item 2</div>
    <div v-body>Content 2</div>
  </v-expand>
</div>
```

### Multiple Accordions

You can have multiple independent accordions by providing a unique name to the `accordion` directive.

```html
<!-- Accordion Group 1 -->
<div accordion="group1">
  ...
</div>

<!-- Accordion Group 2 -->
<div accordion="group2">
  ...
</div>
```

## Available Properties

### Input Properties
- `borderRadius`: `input<CssUnitValue>(2)` - Border radius of the container.
- `padding`: `input<CssUnitValue>(2)` - Padding for the header and body.
- `expanded`: `input<boolean>(false)` - Initial expanded state.

### Methods
- `toggle()`: `void` - Toggles the expanded state.
- `setExpanded(expanded: boolean)`: `void` - Sets the expanded state.

## Content Projection

### Header
Use the `v-header` attribute to project content into the header.

```html
<v-expand>
  <div v-header>
    <h3>Custom Header</h3>
  </div>
  ...
</v-expand>
```

### Body
Use the `v-body` attribute to project content into the body.

```html
<v-expand>
  ...
  <div v-body>
    <p>This is the body content.</p>
  </div>
</v-expand>
```

## Styling

- The component uses CSS custom properties for styling, which can be customized.
- The `borderRadius` and `padding` inputs control the appearance of the component.
- The header has a hover effect that changes its background color.

## Technical Notes

- The `accordion` directive uses the `AccordionService` to manage the state of the accordion.
- The component uses modern Angular signals for its inputs and internal state.
- The `v-expand` component is standalone and can be used without any additional modules, unless you use the `accordion` directive which requires the `AccordionService`.
