# Replace Primitive with Object

**Tag:** encapsulation · **Aliases:** Replace Data Value with Object, Replace Type Code with Class

## Motivation

Data often starts as a simple primitive (a string, number) but grows behavior: formatting,
validation, comparisons, related data. Once you need more than trivial handling, wrap the
primitive in a small class. This addresses **Primitive Obsession**, gives the concept a
name, and provides a home for the logic that keeps getting duplicated around the primitive.

## Mechanics

1. [Encapsulate Variable](encapsulate-variable.md) for the primitive if it isn't already.
2. Create a simple value class for the data. Its constructor takes the primitive; give it a
   getter that returns the primitive.
3. Run static checks.
4. Change the setter to create a new instance of the value class; change the getter to
   return the value from it.
5. Run the tests.
6. Consider renaming the accessors to better reflect the new object, and move behavior onto
   the value class.

## Example

Before — `priority` is a bare string with implicit rules:

```ruby
order.priority == "high"
```

After wrapping it in a value object that knows its ordering:

```ruby
class Priority
  LEGAL_VALUES = %w[low normal high rush].freeze

  def initialize(value)
    raise ArgumentError, "<#{value}> is invalid" unless LEGAL_VALUES.include?(value)

    @value = value
  end

  def to_s
    @value
  end

  def index
    LEGAL_VALUES.index(@value)
  end

  def higher_than?(other)
    index > other.index
  end
end

order.priority.higher_than?(Priority.new("normal"))
```

## Related

- Built on [Encapsulate Variable](encapsulate-variable.md)
- When the type drives behavior: [Replace Type Code with Subclasses](replace-type-code-with-subclasses.md), [Replace Conditional with Polymorphism](replace-conditional-with-polymorphism.md)
- Group several primitives: [Introduce Parameter Object](introduce-parameter-object.md), [Extract Class](extract-class.md)
