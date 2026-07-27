# Extract Interface

**Tag:** dealing-with-inheritance · **Source:** *Refactoring* (1st edition)

## Motivation

Several clients use only the same subset of a class's interface, or two classes share part
of their interfaces without sharing implementation. Making that subset an explicit,
named interface documents what clients actually depend on and decouples them from the rest
of the class. In *untyped* Ruby this is mostly a documentation act — duck typing already
lets any object play the role — so its value there is naming the role (a comment, a shared
test, a stub definition). Prefer [Extract Superclass](extract-superclass.md) or
[Extract Module](extract-module.md) when there's shared *implementation* to house.

**With Sorbet:** this refactoring becomes real again — an `interface!` module with
`sig { abstract }` methods. Classes `include` and implement it, sigs accept the interface
type instead of the concrete class, and test fakes implement the same module so the checker
keeps them honest. This is the standard Sorbet seam for dependency inversion.

## Mechanics

1. Create the interface: in Sorbet, a module marked `interface!` with abstract sigs; in
   plain Ruby, a module documenting (and optionally raising for) the required methods.
2. Declare the relevant classes as implementing it (`include`).
3. Change client declarations/sigs to depend on the interface type rather than the class.
4. Run the tests (and the type checker).

## Example

Sorbet form — billing code only needs `charge`:

```ruby
module Billable
  extend T::Sig
  extend T::Helpers
  interface!

  sig { abstract.returns(Integer) }
  def charge; end
end

class Employee
  include Billable

  sig { override.returns(Integer) }
  def charge
    @rate * @hours
  end
end

class BillingRun
  extend T::Sig

  sig { params(items: T::Array[Billable]).returns(Integer) }
  def total(items)
    items.sum(&:charge)
  end
end
```

`BillingRun` no longer knows `Employee` exists; anything `Billable` — including a test fake
— satisfies the checker.

## Related

- Shared implementation instead of shared contract: [Extract Superclass](extract-superclass.md), [Extract Module](extract-module.md)
- Interfaces shaped by your app over external systems: [Introduce Gateway](introduce-gateway.md)
