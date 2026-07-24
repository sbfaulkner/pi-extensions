# Extract Class

**Tag:** encapsulation · **Inverse:** [Inline Class](inline-class.md)

## Motivation

Classes grow. A class that has taken on responsibilities that logically belong to a
separate concept (a subset of data and methods that go together) should be split. Signs: a
subset of fields that usually change together, methods that use only a subset of the data,
or a class that's simply too big to understand. Extract the cohesive subset into a new
class.

## Mechanics

1. Decide how to split the responsibilities.
2. Create a new (child) class for the split-off responsibility. If the old class no longer
   matches its name, rename it.
3. Create a link from the old class to the new one (an instance held as a field).
4. Use [Move Field](move-field.md) for each field to move, running tests after each.
5. Use [Move Function](move-function.md) for each method to move (move lower-level methods —
   those called rather than calling — first). Run tests after each.
6. Review and reduce each class's interface; consider whether the new class should be
   exposed to clients directly.

## Example

Before — `Person` also carries telephone details:

```ruby
class Person
  attr_accessor :name, :office_area_code, :office_number

  def telephone_number
    "(#{office_area_code}) #{office_number}"
  end
end
```

After extracting a `TelephoneNumber` class:

```ruby
class TelephoneNumber
  attr_accessor :area_code, :number

  def to_s
    "(#{area_code}) #{number}"
  end
end

class Person
  attr_accessor :name

  def initialize
    @telephone_number = TelephoneNumber.new
  end

  def telephone_number
    @telephone_number.to_s
  end

  def office_area_code
    @telephone_number.area_code
  end

  def office_area_code=(arg)
    @telephone_number.area_code = arg
  end
end
```

## Related

- Inverse: [Inline Class](inline-class.md)
- Uses [Move Field](move-field.md), [Move Function](move-function.md)
- Inheritance-based split: [Extract Superclass](extract-superclass.md)
