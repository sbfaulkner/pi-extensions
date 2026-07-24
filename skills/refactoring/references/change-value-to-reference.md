# Change Value to Reference

**Tag:** organizing-data · **Inverse:** [Change Reference to Value](change-reference-to-value.md)

## Motivation

When many records logically refer to the *same* real-world entity (say, many orders for one
customer), copying the data as a value means an update has to be applied everywhere. Sharing
a single reference object means updates happen in one place and are seen by all. Introduce a
repository/registry that returns the shared instance for a given identity.

## Mechanics

1. Create a repository (or use an existing one) for instances of the entity, keyed by
   identity.
2. Ensure the constructor / creating code can look up the right object by its identity.
3. Change the field so it obtains its object from the repository instead of constructing a
   fresh copy.
4. Run tests after each caller is switched.

## Example

Before — each order builds its own `Customer` copy:

```ruby
class Order
  def initialize(data)
    @customer = Customer.new(data[:customer_id])
  end
end
```

After sharing a single instance via a repository:

```ruby
module CustomerRepository
  @customers = {}

  def self.find_or_create(id)
    @customers[id] ||= Customer.new(id)
  end
end

class Order
  def initialize(data)
    @customer = CustomerRepository.find_or_create(data[:customer_id])
  end
end
```

## Related

- Inverse: [Change Reference to Value](change-reference-to-value.md)
