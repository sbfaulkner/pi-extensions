# Lazily Initialized Attribute

**Tag:** organizing-data · **Source:** *Refactoring: Ruby Edition* · **Inverse:** [Eagerly Initialized Attribute](eagerly-initialized-attribute.md)

## Motivation

Initialize an attribute in its accessor, on first use, instead of in the constructor. This
keeps the constructor focused on what varies per instance, groups the default with the
reading code, and defers any construction cost until (unless) it's needed. The trade-off is
the mirror of [Eagerly Initialized Attribute](eagerly-initialized-attribute.md): the
object's full state is no longer visible in one place, and accessor-time initialization can
surprise in multi-threaded code. Treat the pair as reversible stylistic siblings — pick per
attribute, not per codebase.

## Mechanics

1. Create (or repurpose) an accessor for the attribute that initializes on first read —
   `@x ||= default`.
2. Remove the initialization from the constructor.
3. Change internal readers of the ivar to go through the accessor.
4. Run the tests.

Watch the `||=` trap: for attributes that can legitimately hold `false` or `nil`, use
`defined?(@x) ? @x : (@x = default)` instead of `||=`.

## Example

Before — eager:

```ruby
class Employee
  attr_reader :emails

  def initialize
    @emails = []
  end
end
```

After — lazy:

```ruby
class Employee
  def emails
    @emails ||= []
  end
end
```

## Related

- Inverse: [Eagerly Initialized Attribute](eagerly-initialized-attribute.md)
- Same instinct at method scale: [Replace Temp with Query](replace-temp-with-query.md)
- Keep the value computed instead of stored: [Replace Derived Variable with Query](replace-derived-variable-with-query.md)
