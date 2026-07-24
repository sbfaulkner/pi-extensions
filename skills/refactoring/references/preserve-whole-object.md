# Preserve Whole Object

**Tag:** refactoring-apis

## Motivation

When you derive several values from a record and then pass those values into a function,
consider passing the whole record instead. It shortens the parameter list, and if the
function later needs another field from the record, you won't have to change its signature.
It also gives the function a chance to have logic moved onto the source object. (Beware
creating a dependency you don't want — if the callee shouldn't know about the whole object,
this isn't appropriate.)

## Mechanics

1. Create a new parameter for the whole object with [Change Function Declaration](change-function-declaration.md).
2. Run the tests.
3. Replace uses of the individual values inside the function with calls on the whole object,
   one at a time, running tests.
4. Remove the now-unused individual parameters.
5. Run the tests.

## Example

Before — pulling low/high out of a range to pass separately:

```ruby
low = a_room[:days_temp_range][:low]
high = a_room[:days_temp_range][:high]
alerts << "room too cold" if heating_plan.within_range?(low, high) == false
```

After preserving the whole range object:

```ruby
alerts << "room too cold" unless heating_plan.within_range?(a_room[:days_temp_range])

class HeatingPlan
  def within_range?(range)
    range[:low] >= @temperature_range[:low] && range[:high] <= @temperature_range[:high]
  end
end
```

## Related

- Alternative: [Introduce Parameter Object](introduce-parameter-object.md)
- Uses [Change Function Declaration](change-function-declaration.md)
- Opposite move: [Replace Parameter with Query](replace-parameter-with-query.md)
