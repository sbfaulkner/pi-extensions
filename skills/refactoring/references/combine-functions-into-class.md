# Combine Functions into Class

**Tag:** basic

## Motivation

When a group of functions operates closely on the same piece of data, forming them into a
class makes that shared data explicit, shortens argument lists, and gives derived values a
natural home. It also provides a place to move related logic to, revealing a domain concept
that was previously implicit.

## Mechanics

1. Apply [Encapsulate Record](encapsulate-record.md) to the common data the functions share
   (or wrap the data in a new class).
2. Take each function that uses the common data and move it into the new class with
   [Move Function](move-function.md). Arguments that are members of the common record can be
   dropped from the parameter list.
3. Extract any logic that manipulates the data into methods on the class with
   [Extract Function](extract-function.md).
4. Run the tests after each move.

## Example

Before — free functions all taking the same `reading`:

```ruby
def base_charge(reading)
  base_rate(reading[:month], reading[:year]) * reading[:quantity]
end

def taxable_charge(reading)
  [0, base_charge(reading) - tax_threshold(reading[:year])].max
end
```

After combining into a class:

```ruby
class Reading
  def initialize(data)
    @data = data
  end

  def base_charge
    base_rate(@data[:month], @data[:year]) * @data[:quantity]
  end

  def taxable_charge
    [0, base_charge - tax_threshold(@data[:year])].max
  end
end
```

## Related

- Alternative transform-based grouping: [Combine Functions into Transform](combine-functions-into-transform.md)
- Uses [Move Function](move-function.md), [Extract Function](extract-function.md), [Encapsulate Record](encapsulate-record.md)
- Split a big class apart: [Extract Class](extract-class.md)
