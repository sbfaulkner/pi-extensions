# Move Field

**Tag:** moving-features

## Motivation

Data structure is the backbone of a program. A field belongs with the data it's most
closely related to and the functions that use it. Move a field when you repeatedly pass it
around with another record, when changing one record forces a change in a field elsewhere,
or when updating a field means updating several structures. Good data placement makes the
logic that follows much simpler.

## Mechanics

1. Ensure the source field is encapsulated (apply [Encapsulate Variable](encapsulate-variable.md)
   / [Encapsulate Record](encapsulate-record.md) if not).
2. Create a field (and accessors) in the target.
3. Run static checks.
4. Ensure there's a reference from the source object to the target object.
5. Adjust the source's accessors to use the target's field instead of its own.
6. Run the tests.
7. Remove the source field.
8. Run the tests.

## Example

Before — `Customer` holds its own `discount_rate`, but it really belongs with the contract:

```ruby
class Customer
  attr_accessor :discount_rate

  def initialize(name)
    @name = name
    @contract = CustomerContract.new
  end
end
```

After moving the field to `CustomerContract`:

```ruby
class Customer
  def initialize(name)
    @name = name
    @contract = CustomerContract.new
  end

  def discount_rate
    @contract.discount_rate
  end

  def discount_rate=(arg)
    @contract.discount_rate = arg
  end
end

class CustomerContract
  attr_accessor :discount_rate
end
```

## Related

- Move behavior instead: [Move Function](move-function.md)
- Depends on [Encapsulate Variable](encapsulate-variable.md), [Encapsulate Record](encapsulate-record.md)
- Regroup fields: [Extract Class](extract-class.md), [Inline Class](inline-class.md)
