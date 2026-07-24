# Change Reference to Value

**Tag:** organizing-data · **Inverse:** [Change Value to Reference](change-value-to-reference.md)

## Motivation

An object can be treated as a **reference** (shared, mutated in place, everyone sees the
change) or as a **value** (immutable, replaced wholesale, compared by content). Value
objects are simpler to reason about, especially in distributed and concurrent code, because
they can't be changed under you. Make an inner object a value when you'd rather treat it as
immutable — replace mutations with whole-object replacement and give it value equality.

## Mechanics

1. Check the candidate is (or can be made) immutable — no setters that mutate its fields
   after construction. Apply [Remove Setting Method](remove-setting-method.md) where needed.
2. Make each field a value set only at construction.
3. Provide value-based equality (`==` / `eql?` / `hash`) based on the fields.
4. Run the tests.

## Example

Before — a mutable `TelephoneNumber` shared by reference:

```ruby
class Person
  def initialize
    @telephone_number = TelephoneNumber.new
  end

  def office_area_code=(code)
    @telephone_number.area_code = code
  end
end
```

After treating it as an immutable value replaced wholesale:

```ruby
class TelephoneNumber
  attr_reader :area_code, :number

  def initialize(area_code, number)
    @area_code = area_code
    @number = number
  end

  def ==(other)
    other.is_a?(TelephoneNumber) &&
      area_code == other.area_code && number == other.number
  end
  alias eql? ==

  def hash
    [area_code, number].hash
  end
end

class Person
  def office_area_code=(code)
    @telephone_number = TelephoneNumber.new(code, @telephone_number.number)
  end
end
```

## Related

- Inverse: [Change Value to Reference](change-value-to-reference.md)
- Uses [Remove Setting Method](remove-setting-method.md)
