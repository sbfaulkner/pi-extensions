# Change Unidirectional Association to Bidirectional

**Tag:** organizing-data · **Source:** *Refactoring* (1st edition) · **Inverse:** [Change Bidirectional Association to Unidirectional](change-bidirectional-association-to-unidirectional.md)

## Motivation

Two classes are linked in one direction, and now the pointed-to class needs to reach back —
an order knows its customer, and a new feature needs a customer's orders. Add the back
pointer *and a discipline for keeping the two sides consistent*: designate one class as
controller of the association, with the other side's mutators used only by it. Accept the
costs knowingly — mutual coupling, sync bugs if the discipline slips, and lifecycle
entanglement. If a lookup (query, repository, parameter) can answer the reverse question,
prefer that and skip the back pointer.

**With Sorbet:** back pointers are typically `T.nilable` and set after construction — a
poor fit for `T::Struct`/immutable designs. One more reason to exhaust the alternatives
first.

## Mechanics

1. Add the back-pointer field (for one-to-many, a collection).
2. Decide which class controls the association — usually the "one" side of a one-to-many
   (here: the order, which holds the single reference).
3. On the non-controlling side, add helper mutators for the controller's private use.
4. Change the controlling modifier to update both sides:
5. Run the tests.

## Example

```ruby
class Order
  attr_reader :customer

  # Order controls the association.
  def customer=(new_customer)
    customer&.friend_orders&.delete(self)
    @customer = new_customer
    customer&.friend_orders&.add(self)
  end
end

class Customer
  def initialize
    @orders = Set.new
  end

  def orders = @orders.dup

  # For Order's use only — not part of Customer's public contract.
  def friend_orders = @orders
end
```

## Related

- Inverse: [Change Bidirectional Association to Unidirectional](change-bidirectional-association-to-unidirectional.md)
- Sharing one instance across holders: [Change Value to Reference](change-value-to-reference.md)
- Guarding the collection side: [Encapsulate Collection](encapsulate-collection.md)
