# Introduce Parameter Object

**Tag:** basic

## Motivation

When the same group of data items travels together through many function signatures (a
**Data Clump**), replace that group with a single object. This shrinks parameter lists,
makes relationships between the data explicit, and — most importantly — gives you a home
to move behavior onto. Once the parameter object exists, functions that operate on the
clump can [Move Function](move-function.md) onto it, often revealing a rich domain concept
that clarifies the whole codebase.

## Mechanics

1. If a suitable structure/class doesn't already exist, create one. Prefer an immutable
   value object (a class or a `Struct`/`Data`).
2. Run the tests.
3. Use [Change Function Declaration](change-function-declaration.md) to add a parameter for
   the new object.
4. Run the tests.
5. Adjust each caller to pass the correct instance. Run tests after each.
6. For each element of the clump, replace references to the individual parameter with
   references to the field on the new object. Remove the old parameter.
7. Run the tests.
8. Now look for behavior that belongs on the new object and use [Extract Function](extract-function.md) + [Move Function](move-function.md) to relocate it.

## Example

Before — a min/max temperature range passed as two parameters everywhere:

```ruby
def readings_outside_range(station, min, max)
  station[:readings].select { |r| r[:temp] < min || r[:temp] > max }
end

alerts = readings_outside_range(
  station,
  operating_plan[:temperature_floor],
  operating_plan[:temperature_ceiling],
)
```

After introducing a `NumberRange` parameter object:

```ruby
class NumberRange
  attr_reader :min, :max

  def initialize(min, max)
    @min = min
    @max = max
  end

  def contains?(value)
    value >= min && value <= max
  end
end

def readings_outside_range(station, range)
  station[:readings].reject { |r| range.contains?(r[:temp]) }
end

range = NumberRange.new(
  operating_plan[:temperature_floor],
  operating_plan[:temperature_ceiling],
)
alerts = readings_outside_range(station, range)
```

The `contains?` behavior migrated onto the new object, and the call site is far clearer.

## Related

- Often precedes [Combine Functions into Class](combine-functions-into-class.md)
- Alternative for shrinking parameter lists: [Preserve Whole Object](preserve-whole-object.md)
- Move behavior onto the new object: [Move Function](move-function.md)
- Related smell fix: [Extract Class](extract-class.md)
