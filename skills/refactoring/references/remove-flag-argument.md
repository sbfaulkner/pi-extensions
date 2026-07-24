# Remove Flag Argument

**Tag:** refactoring-apis · **Alias:** Replace Parameter with Explicit Methods

## Motivation

A flag argument is a parameter the caller sets to a boolean (or enum) to select which of
several behaviors a function should do. Flags hide the real differences in capability and
make call sites cryptic — `book(customer, true)` tells the reader nothing. Replace the flag
with explicit, well-named functions, one per behavior.

## Mechanics

1. Create an explicit function for each value of the flag parameter.
2. If the main function has a clear dispatch (`if flag ... else ...`), use
   [Decompose Conditional](decompose-conditional.md); otherwise make each explicit function
   call the original with the literal flag value.
3. For each caller, replace the flagged call with the corresponding explicit function. Run
   tests after each.
4. When no caller passes the flag literal, remove the flag handling (and, if possible, the
   original function).

## Example

Before — a boolean flag controls priority booking:

```ruby
def book(customer, is_premium)
  if is_premium
    add_to_priority_plan(customer)
  else
    add_to_normal_plan(customer)
  end
end

book(customer, true)
book(customer, false)
```

After removing the flag argument:

```ruby
def premium_book(customer)
  add_to_priority_plan(customer)
end

def book(customer)
  add_to_normal_plan(customer)
end

premium_book(customer)
book(customer)
```

## Related

- Uses [Decompose Conditional](decompose-conditional.md)
- Inverse in spirit: [Parameterize Function](parameterize-function.md)
- Simplify the resulting signature: [Change Function Declaration](change-function-declaration.md)
