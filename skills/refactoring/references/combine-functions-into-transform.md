# Combine Functions into Transform

**Tag:** basic

## Motivation

When several functions derive values from the same source data, it's easy to duplicate the
derivation logic. A **transform** function takes the source data and returns a new object
enriched with all the derived values in one place, so every derivation is computed and
maintained together. Prefer this over [Combine Functions into Class](combine-functions-into-class.md)
when the source data is updated in various places (a class better handles mutation).

## Mechanics

1. Create a transform function that takes the record to transform and returns a **copy** of
   it (don't mutate the input).
2. Pick one piece of derived logic. Move its body into the transform, adding the result as
   a field on the output record. Change the original caller to read the new field.
3. Run the tests.
4. Repeat for the other derivations.

## Example

Before — two functions independently derive charges:

```ruby
def base_charge(reading)
  base_rate(reading[:month], reading[:year]) * reading[:quantity]
end

def taxable_charge(reading)
  [0, base_charge(reading) - tax_threshold(reading[:year])].max
end
```

After combining into an enriching transform:

```ruby
def enrich_reading(original)
  result = original.dup
  result[:base_charge] = base_rate(result[:month], result[:year]) * result[:quantity]
  result[:taxable_charge] = [0, result[:base_charge] - tax_threshold(result[:year])].max
  result
end

# callers read enriched fields
reading = enrich_reading(raw_reading)
reading[:taxable_charge]
```

## Related

- Class-based alternative: [Combine Functions into Class](combine-functions-into-class.md)
- Related structural move: [Split Phase](split-phase.md)
