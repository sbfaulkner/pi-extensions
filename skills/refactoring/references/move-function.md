# Move Function

**Tag:** moving-features · **Alias:** Move Method

## Motivation

Good software groups things that change together. A function belongs near the data it
operates on and the other functions it calls. Move a function when it references elements
of another context (class/module/file) more than its current home — a symptom of
**Feature Envy**. Moving it reduces coupling and often uncovers a better home for related
functions and fields too.

## Mechanics

1. Examine everything the function references in its current scope (variables, other
   functions, fields). Consider whether they should move too.
   - If a called function should also move, move it first (or move this one first if it's
     simpler — pick whichever makes the smallest safe step).
2. Check whether the function is polymorphic (overridden). If so, account for that.
3. Copy the function into the target context. Adjust it to fit its new home (rename if the
   name doesn't fit, wire up references it now needs).
4. Run static analysis / load the code.
5. Work out how to reference the target function from the source context.
6. Turn the source function into a **delegating** function that calls the moved one.
7. Run the tests.
8. Consider [Inline Function](inline-function.md) on the source function so callers call
   the moved function directly. Migrate callers and remove the delegator.
9. Run the tests.

## Example

Before — `overdraft_charge` lives on `Account` but only uses `AccountType` data:

```ruby
class Account
  def initialize(type, days_overdrawn)
    @type = type
    @days_overdrawn = days_overdrawn
  end

  def bank_charge
    result = 4.5
    result += overdraft_charge if @days_overdrawn.positive?
    result
  end

  def overdraft_charge
    if @type.premium?
      base = 10
      @days_overdrawn <= 7 ? base : base + (@days_overdrawn - 7) * 0.85
    else
      @days_overdrawn * 1.75
    end
  end
end
```

After moving `overdraft_charge` onto `AccountType` (where the `premium?` knowledge lives):

```ruby
class AccountType
  def premium?
    # ...
  end

  def overdraft_charge(days_overdrawn)
    if premium?
      base = 10
      days_overdrawn <= 7 ? base : base + (days_overdrawn - 7) * 0.85
    else
      days_overdrawn * 1.75
    end
  end
end

class Account
  def bank_charge
    result = 4.5
    result += @type.overdraft_charge(@days_overdrawn) if @days_overdrawn.positive?
    result
  end
end
```

## Related

- Move data instead: [Move Field](move-field.md)
- Move parts of a function: [Move Statements into Function](move-statements-into-function.md), [Move Statements to Callers](move-statements-to-callers.md)
- Group related functions and their data: [Extract Class](extract-class.md), [Combine Functions into Class](combine-functions-into-class.md)
- The mechanics rely on [Extract Function](extract-function.md) and [Inline Function](inline-function.md)
