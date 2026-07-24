# Separate Query from Modifier

**Tag:** refactoring-apis

## Motivation

Functions that return a value **and** have observable side effects are dangerous: callers
can't invoke them freely to just get the value, and can't reason about them easily. Follow
**Command-Query Separation**: any function that returns a value should have no observable
side effects. Split a function that both queries and modifies into a pure query and a
separate modifier.

## Mechanics

1. Copy the function, naming the copy after the query part.
2. Remove any side effects from the new query function.
3. Run static checks.
4. Find each call to the original. Where the return value is used, replace with a call to the
   query; add a call to the original (still-modifying) function right after if the side
   effect is still needed. Run tests after each.
5. Remove the return value from the original (now modifier-only) function.
6. Run the tests.

## Example

Before — `alert_for_miscreant` both finds and alerts:

```ruby
def alert_for_miscreant(people)
  people.each do |p|
    if p == "Don" || p == "John"
      send_alert
      return p
    end
  end
  ""
end
```

After separating:

```ruby
def find_miscreant(people)
  people.find { |p| p == "Don" || p == "John" } || ""
end

def alert_for_miscreant(people)
  send_alert unless find_miscreant(people).empty?
end

# caller
found = find_miscreant(people)
alert_for_miscreant(people)
```

## Related

- Prerequisite for [Consolidate Conditional Expression](consolidate-conditional-expression.md) when a condition has side effects
- Related: [Remove Setting Method](remove-setting-method.md)
