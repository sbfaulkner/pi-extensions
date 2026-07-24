# Replace Derived Variable with Query

**Tag:** organizing-data

## Motivation

Mutable data is a major source of bugs, especially when one variable's value is derived from
others and must be kept in sync. Any value that can be calculated from other data is a prime
candidate to become a query (a computed method) instead of a stored, mutated field — this
eliminates the risk that the derived value drifts out of date. (Exception: an expensive
calculation over immutable source data may justify caching.)

## Mechanics

1. Identify all places that update the derived variable. Consider [Split Variable](split-variable.md)
   if it serves more than one purpose.
2. Create a function that computes the value of the derived variable from its sources.
3. Introduce an assertion or test that the function and the variable agree.
4. Replace reads of the variable with calls to the function, one at a time, running tests.
5. Remove the variable and the code that assigned to it.
6. Run the tests.

## Example

Before — `production` is a field kept in sync manually:

```ruby
class ProductionPlan
  def initialize
    @production = 0
    @adjustments = []
  end

  def apply_adjustment(adjustment)
    @adjustments << adjustment
    @production += adjustment[:amount]
  end

  attr_reader :production
end
```

After deriving `production` on demand:

```ruby
class ProductionPlan
  def initialize
    @adjustments = []
  end

  def apply_adjustment(adjustment)
    @adjustments << adjustment
  end

  def production
    @adjustments.sum { |a| a[:amount] }
  end
end
```

## Related

- Split multi-purpose variables first: [Split Variable](split-variable.md)
- Related: [Replace Temp with Query](replace-temp-with-query.md)
- Enabled by [Encapsulate Variable](encapsulate-variable.md)
