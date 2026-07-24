# Replace Command with Function

**Tag:** refactoring-apis · **Inverse:** [Replace Function with Command](replace-function-with-command.md)

## Motivation

The mirror of [Replace Function with Command](replace-function-with-command.md). A command
object is powerful but heavyweight. If a command isn't doing much more than invoking a single
function — no shifting state across methods, no undo, no staged construction — the ceremony
isn't worth it. Fold it back into a plain function.

## Mechanics

1. Apply [Inline Function](inline-function.md) to any supporting methods so all logic lives in
   the command's single execute method.
2. Use [Change Function Declaration](change-function-declaration.md) to make the execute
   method take the constructor's parameters directly instead of reading them from fields.
3. For each field, change references in execute to use the corresponding parameter.
4. Adjust callers to call the (now standalone) function directly rather than constructing the
   command and calling execute.
5. Delete the command class.
6. Run the tests.

## Example

Before — a trivial command:

```ruby
class ChargeCalculator
  def initialize(customer, usage)
    @customer = customer
    @usage = usage
  end

  def execute
    @customer.rate * @usage
  end
end

ChargeCalculator.new(customer, usage).execute
```

After replacing it with a function:

```ruby
def charge(customer, usage)
  customer.rate * usage
end

charge(customer, usage)
```

## Related

- Inverse: [Replace Function with Command](replace-function-with-command.md)
- Uses [Inline Function](inline-function.md), [Change Function Declaration](change-function-declaration.md)
