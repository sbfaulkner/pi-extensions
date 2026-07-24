# Inline Class

**Tag:** encapsulation · **Inverse:** [Extract Class](extract-class.md)

## Motivation

The mirror of [Extract Class](extract-class.md). Inline a class when it no longer carries
its weight — often the result of refactoring that moved its responsibilities elsewhere, so
it's now a **Lazy Element**. Fold it back into its client. Inlining is also a useful setup
move: collapse two classes into one, then re-[Extract Class](extract-class.md) along a
better boundary.

## Mechanics

1. In the absorbing class, create functions for each public method of the class being
   inlined; have them delegate to the source class for now.
2. Change all callers of the source class's methods to call the absorbing class's methods
   instead. Run tests after each.
3. Move the fields and methods from the source class into the absorbing class, one at a
   time, running tests, until the source class is empty.
4. Delete the source class.

## Example

Before — a trivial `ShippingRules` used only by `Order`:

```ruby
class ShippingRules
  attr_reader :charge

  def initialize(charge)
    @charge = charge
  end
end

class Order
  def initialize(shipping_rules)
    @shipping_rules = shipping_rules
  end

  def shipping_charge
    @shipping_rules.charge
  end
end
```

After inlining:

```ruby
class Order
  def initialize(charge)
    @charge = charge
  end

  def shipping_charge
    @charge
  end
end
```

## Related

- Inverse: [Extract Class](extract-class.md)
- Inline a function instead: [Inline Function](inline-function.md)
- Collapse an inheritance layer: [Collapse Hierarchy](collapse-hierarchy.md)
