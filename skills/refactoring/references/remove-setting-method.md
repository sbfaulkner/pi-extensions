# Remove Setting Method

**Tag:** refactoring-apis

## Motivation

If a field should be set only when an object is created and never changed afterward, don't
provide a setter for it. Removing the setter makes the intent (immutability) clear and
prevents accidental changes. This is a common step toward
[Change Reference to Value](change-reference-to-value.md).

## Mechanics

1. If the constructor doesn't already take the value, add it as a constructor parameter with
   [Change Function Declaration](change-function-declaration.md), and have the constructor
   call the setter.
2. Change each caller that uses the setter to instead pass the value at construction. Run
   tests after each.
3. Replace the constructor's use of the setter with a direct field assignment.
4. Remove the setter method.
5. Run the tests.

## Example

Before — `id` is settable even though it should be fixed at creation:

```ruby
class Person
  attr_accessor :name, :id

  def initialize(id)
    @id = id
  end
end
```

After removing the id setter:

```ruby
class Person
  attr_accessor :name
  attr_reader :id

  def initialize(id)
    @id = id
  end
end
```

## Related

- Enables [Change Reference to Value](change-reference-to-value.md)
- Uses [Change Function Declaration](change-function-declaration.md)
