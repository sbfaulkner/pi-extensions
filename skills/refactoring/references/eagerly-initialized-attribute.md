# Eagerly Initialized Attribute

**Tag:** organizing-data · **Source:** *Refactoring: Ruby Edition* · **Inverse:** [Lazily Initialized Attribute](lazily-initialized-attribute.md)

## Motivation

Initialize an attribute in the constructor so the object's complete state is established —
and readable — in one place. This is the mirror of
[Lazily Initialized Attribute](lazily-initialized-attribute.md): it trades the lazy form's
deferred cost and co-located default for predictability. Every instance is fully formed at
construction, plain `attr_reader` suffices, there's no `||=` false/nil trap, and no
first-read mutation to surprise threads or frozen instances.

## Mechanics

1. Move the default from the accessor into the constructor.
2. Replace the initializing accessor with a plain `attr_reader`.
3. Run the tests.

## Example

Before — lazy:

```ruby
class Employee
  def emails
    @emails ||= []
  end
end
```

After — eager:

```ruby
class Employee
  attr_reader :emails

  def initialize
    @emails = []
  end
end
```

## Related

- Inverse: [Lazily Initialized Attribute](lazily-initialized-attribute.md)
- Fits naturally with immutable values: [Change Reference to Value](change-reference-to-value.md), [Remove Setting Method](remove-setting-method.md)
