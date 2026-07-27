# Replace Constructor with Factory Function

**Tag:** refactoring-apis · **Alias:** Replace Constructor with Factory Method

## Motivation

Constructors are limited: they often must return an instance of the exact class named, can't
easily be chosen by type at runtime, and their name is fixed by the class. A factory function
has no such limits — it can return a subclass or special-case instance, do work before
construction, and carry a clearer name. Replace direct constructor calls with a factory when
you need any of that flexibility.

## Mechanics

1. Create a factory function that calls the constructor.
2. Replace each call to the constructor with a call to the factory function, one at a time,
   running tests.
3. Limit the constructor's visibility as much as the language allows.
4. Run the tests.

## Example

Before — callers build employees by type code with `new`:

```ruby
employee = Employee.new(name, "E")
```

After introducing a factory:

```ruby
def create_engineer(name)
  Employee.new(name, "E")
end

employee = create_engineer(name)
```

The factory can later return a specialized subclass without touching callers.

## Related

- Often works with [Replace Type Code with Subclasses](replace-type-code-with-subclasses.md)
- Wrap creation in a command: [Replace Function with Command](replace-function-with-command.md)
- The guest entries *Convert Static to Dynamic Construction* and its inverse (Gerard M. Davison, refactoring.com) swap `new` for reflection-driven creation in Java; in Ruby, a factory function (possibly taking the class or a symbol) covers both directions
