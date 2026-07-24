# Replace Parameter with Query

**Tag:** refactoring-apis · **Alias:** Replace Parameter with Method · **Inverse:** [Replace Query with Parameter](replace-query-with-parameter.md)

## Motivation

A parameter list should summarize the ways a function varies. Redundant parameters — ones
the function could easily determine itself (e.g., derivable from another parameter) — add
noise and put the burden of getting them right on the caller. Remove such a parameter and
let the function compute the value. Don't do this if it would add an unwanted dependency, or
if computing the value has side effects.

## Mechanics

1. If necessary, use [Extract Function](extract-function.md) to isolate the computation of
   the parameter's value.
2. Replace references to the parameter inside the body with the computation/query.
3. Run the tests.
4. Use [Change Function Declaration](change-function-declaration.md) to remove the parameter.

## Example

Before — caller passes `base_price` that's derivable from the order:

```ruby
def discounted_price(order, base_price)
  base_price > 100 ? base_price * 0.9 : base_price
end

discounted_price(order, order.base_price)
```

After replacing the parameter with a query:

```ruby
def discounted_price(order)
  order.base_price > 100 ? order.base_price * 0.9 : order.base_price
end

discounted_price(order)
```

## Related

- Inverse: [Replace Query with Parameter](replace-query-with-parameter.md)
- Uses [Extract Function](extract-function.md), [Change Function Declaration](change-function-declaration.md)
- Related: [Preserve Whole Object](preserve-whole-object.md)
