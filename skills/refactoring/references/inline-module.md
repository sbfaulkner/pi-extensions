# Inline Module

**Tag:** dealing-with-inheritance · **Source:** *Refactoring: Ruby Edition* · **Inverse:** [Extract Module](extract-module.md)

## Motivation

The mirror of [Extract Module](extract-module.md). A module included in exactly one class
adds a level of indirection the reader must hop through without buying any reuse — a Lazy
Element. Fold it back into its sole includer. (If the module exists to mark a concept or is
part of a public extension point, that's a reason to keep it despite single inclusion.)

## Mechanics

1. Confirm the module has exactly one includer and no other references (checked
   `is_a?`/`ancestors` queries included).
2. Move the module's methods into the including class.
3. Remove the `include`.
4. Run the tests.
5. Delete the module.

## Example

Before — a module with one home:

```ruby
module OrderTotaling
  def total
    line_items.sum(&:price) + shipping_cost
  end
end

class Order
  include OrderTotaling
end
```

After inlining:

```ruby
class Order
  def total
    line_items.sum(&:price) + shipping_cost
  end
end
```

## Related

- Inverse: [Extract Module](extract-module.md)
- Class-level equivalents: [Inline Class](inline-class.md), [Collapse Hierarchy](collapse-hierarchy.md)
