# Slide Statements

**Tag:** moving-features · **Related:** Consolidate Duplicate Conditional Fragments

## Motivation

Code is easier to understand when related things are grouped together. Moving a statement so
it sits next to the code it relates to (e.g., a variable declared right before it's used)
improves readability and is often a preparatory step for [Extract Function](extract-function.md).

## Mechanics

1. Identify the target position to move the fragment to. Examine the statements between the
   source and target for **interference** — check that the slide won't change behavior:
   - Does the moved code reference a variable declared between source and target?
   - Does anything between the two modify state the moved code reads or writes?
   - Are there any order-dependent side effects (I/O, exceptions)?
2. If there's no interference, cut the fragment and paste it into the target position.
3. Run the tests.

If you're unsure whether a slide is safe, don't do it — the whole point is to preserve
behavior.

## Example

Before — declaration far from use:

```ruby
pricing_plan = retrieve_pricing_plan
order = retrieve_order
charge = nil
charge_per_unit = pricing_plan[:unit]
```

After sliding the related declarations together:

```ruby
pricing_plan = retrieve_pricing_plan
charge_per_unit = pricing_plan[:unit]
order = retrieve_order
charge = nil
```

## Related

- Common setup for [Extract Function](extract-function.md), [Move Statements into Function](move-statements-into-function.md)
- Consolidating duplicated fragments in conditionals is a special case of sliding shared
  statements out of the branches.
