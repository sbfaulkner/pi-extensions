# Remove Middle Man

**Tag:** encapsulation · **Inverse:** [Hide Delegate](hide-delegate.md)

## Motivation

The mirror of [Hide Delegate](hide-delegate.md). Every delegating method you add couples the
server to the delegate's interface. When a class does little more than forward call after
call to its delegate (the **Middle Man** smell), it's simpler to let clients talk to the
delegate directly.

## Mechanics

1. Create an accessor on the server for the delegate.
2. For each delegating method the client uses, replace the call with two calls — first get
   the delegate via the accessor, then call the method on it. Run tests after each.
3. Once a delegating method has no callers, remove it.

## Example

Before — `Person` forwards everything to `department`:

```ruby
class Person
  def manager
    @department.manager
  end
end

manager = person.manager
```

After removing the middle man:

```ruby
class Person
  attr_reader :department
end

manager = person.department.manager
```

## Related

- Inverse: [Hide Delegate](hide-delegate.md)
- Replace delegating inheritance: [Replace Superclass with Delegate](replace-superclass-with-delegate.md), [Replace Subclass with Delegate](replace-subclass-with-delegate.md)
