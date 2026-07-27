# Replace Delegation with Inheritance

**Tag:** dealing-with-inheritance · **Source:** *Refactoring* (1st edition) · **Inverse:** [Replace Superclass with Delegate](replace-superclass-with-delegate.md)

## Motivation

The mirror of [Replace Superclass with Delegate](replace-superclass-with-delegate.md)
(1st-edition name: Replace Inheritance with Delegation). When a class delegates so much
that you're writing simple forwarding methods for the delegate's *entire* interface, the
delegation is ceremony — inherit instead and get the interface for free. Only do this when
the relationship truly is *is-a*: if you use only part of the delegate's interface, or the
delegate is shared or swapped at runtime, keep delegating (a pile of forwarders may still
be the honest design).

The *Ruby Edition* variant (**Replace Delegation with Hierarchy**, p. 389) reaches the same
end with Ruby's tools: make the delegate's behavior a **module** and `include`/`extend` it,
sharing the interface without spending the superclass slot.

**With Sorbet:** forwarding via `method_missing` is untypeable, so heavy delegation means
hand-written, hand-signed forwarders — inheritance (or a mixin) eliminates that boilerplate
and types the whole interface at once.

## Mechanics

1. Make the delegating class a subclass of (or, Ruby-style, include a module extracted
   from) the delegate class.
2. Set the delegate reference to `self` (temporarily satisfying old internal calls).
3. Run the tests.
4. Remove the forwarding methods one at a time, running tests after each.
5. Replace remaining references to the delegate field with direct calls on `self`, and
   delete the field.
6. Run the tests.

## Example

Before — an employee forwarding its whole surface to `Person`:

```ruby
class Employee
  def initialize(name)
    @person = Person.new(name)
  end

  def name = @person.name
  def to_s = "Emp: #{@person.last_name}"
  def last_name = @person.last_name
end
```

After inheriting:

```ruby
class Employee < Person
  def to_s
    "Emp: #{last_name}"
  end
end
```

## Related

- Inverse: [Replace Superclass with Delegate](replace-superclass-with-delegate.md)
- Module-based sharing (the Ruby Edition's preferred hierarchy): [Extract Module](extract-module.md), [Replace Abstract Superclass with Module](replace-abstract-superclass-with-module.md)
- If only the forwarding count is the problem: [Remove Middle Man](remove-middle-man.md)
