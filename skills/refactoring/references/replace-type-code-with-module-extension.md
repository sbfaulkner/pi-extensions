# Replace Type Code with Module Extension

**Tag:** dealing-with-inheritance · **Source:** *Refactoring: Ruby Edition*

## Motivation

A type code drives conditional behavior, but subclassing
([Replace Type Code with Subclasses](replace-type-code-with-subclasses.md)) isn't available
— the object's type can *change during its lifetime*, or it's already in a hierarchy. The
Ruby Edition's answer: `extend` a module onto the individual instance when the type code is
set. The instance gains the type-specific behavior directly; no delegate object, no state
class. The sharp edge: **you cannot cleanly un-extend a module** — if the type can change
*back and forth*, prefer [Replace Type Code with State/Strategy](replace-type-code-with-subclasses.md)
(a swappable delegate). Instance-level `extend` is also opaque to documentation and tooling;
use it where the dynamism is worth that cost.

**With Sorbet:** per-instance `extend` is invisible to the checker — the extended methods
won't typecheck on the receiver. In Sorbet codebases, prefer subclasses or a typed strategy
delegate; treat this as a technique for untyped code.

## Mechanics

1. Ensure the type code is set through a writer method
   ([Encapsulate Variable](encapsulate-variable.md)).
2. Create a module per type-code value, holding that type's behavior.
3. In the type-code writer, `extend` the matching module onto `self`.
4. Move each piece of type-conditional behavior into the modules, replacing conditionals
   with plain calls, one at a time, running tests.
5. Remove the type-code checks that remain.

## Example

```ruby
module Manager
  def salary
    base_salary * 1.5
  end
end

module Engineer
  def salary
    base_salary
  end
end

class Employee
  TYPE_MODULES = { "manager" => Manager, "engineer" => Engineer }.freeze

  def type=(value)
    @type = value
    extend(TYPE_MODULES.fetch(value))
  end
end
```

Setting `employee.type = "manager"` gives *that instance* manager behavior — but note it
keeps `Manager#salary` even if later set to `"engineer"` mixes in another module ahead of
it; one-way transitions only.

## Related

- Fixed-for-life types: [Replace Type Code with Subclasses](replace-type-code-with-subclasses.md)
- Reversible type changes: the State/Strategy variant under [Replace Type Code with Subclasses](replace-type-code-with-subclasses.md)
- The conditional-removal payoff: [Replace Conditional with Polymorphism](replace-conditional-with-polymorphism.md)
