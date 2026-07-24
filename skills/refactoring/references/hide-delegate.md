# Hide Delegate

**Tag:** encapsulation · **Inverse:** [Remove Middle Man](remove-middle-man.md)

## Motivation

Encapsulation means an object should know as little as possible about the structure of
others. When a client calls `person.department.manager`, it's coupled to the fact that a
person has a department and that a department has a manager (a **Message Chain**). Add a
delegating method on the server (`person.manager`) so the client no longer needs to know
about the intermediate object; you can then change the delegate's structure without
touching clients.

## Mechanics

1. For each method on the delegate that the client calls, create a delegating method on the
   server object.
2. Change the client to call the server's method instead of reaching through to the
   delegate. Run tests after each.
3. If no client still accesses the delegate directly, remove the server's accessor for the
   delegate.
4. Run the tests.

## Example

Before — client reaches through `department`:

```ruby
manager = person.department.manager
```

After hiding the delegate:

```ruby
class Person
  def manager
    @department.manager
  end
end

manager = person.manager
```

## Related

- Inverse: [Remove Middle Man](remove-middle-man.md)
- Related smell fixes: [Move Function](move-function.md), [Extract Function](extract-function.md)
