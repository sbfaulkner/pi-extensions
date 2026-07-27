# Replace Assignment with Initialization

**Tag:** organizing-data · **Source:** refactoring.com catalog (guest entry, Mats Henricson)

## Motivation

Declaring a variable in one place and assigning its value further down is an artifact of
older languages that required up-front declarations. It adds lines that carry no meaning
and risks a path where the variable is read before it holds a real value. Initialize the
variable where it is first needed instead.

Ruby has no declarations, but the pattern survives as `x = nil` placed early in a method
so the variable exists before a branch or block assigns it. Each such pre-assignment is a
candidate: restructure so the variable is initialized with its actual value — often by
making the conditional an expression, which Ruby supports directly.

## Mechanics

1. Move the pre-assignment (`x = nil`) down to just before the code that assigns the real
   value, confirming no earlier read exists. Run the tests.
2. Merge the two into a single initialization with the real value. If the value comes from
   a conditional, assign the conditional's result (`x = if ... end` or a ternary).
3. Run the tests.
4. If the value never changes afterwards, consider signalling that (e.g. `freeze`, or
   promoting it to a constant).

## Example

Before:

```ruby
def shipping_label(order)
  carrier = nil
  weight = order.total_weight
  if weight > 20
    carrier = "freight"
  else
    carrier = "parcel"
  end
  "#{carrier}: #{order.address}"
end
```

After:

```ruby
def shipping_label(order)
  weight = order.total_weight
  carrier = weight > 20 ? "freight" : "parcel"
  "#{carrier}: #{order.address}"
end
```

## Related

- Tighten where the variable lives: [Reduce Scope of Variable](reduce-scope-of-variable.md)
- One variable per purpose: [Split Variable](split-variable.md)
- Prefer idiomatic conditional forms: [Recompose Conditional](recompose-conditional.md)
- Eliminate the temp entirely: [Inline Variable](inline-variable.md), [Replace Temp with Query](replace-temp-with-query.md)
