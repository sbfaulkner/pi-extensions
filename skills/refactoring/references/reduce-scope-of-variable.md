# Reduce Scope of Variable

**Tag:** organizing-data · **Source:** refactoring.com catalog (guest entry, Mats Henricson)

## Motivation

A variable declared in a wider scope than it is used clutters the namespace, invites
accidental reuse and shadowing, and obscures where the value actually matters. Move it to
the narrowest scope that contains all its uses.

Fowler's addition applies doubly in Ruby: in short methods there is nowhere narrower to
go, so the real value of this refactoring is while *breaking up a long method* — tightening
a variable's scope shows you what an [Extract Function](extract-function.md) slice would
need. The same move applies to an instance variable used by only one method: make it a
local. In Ruby, initializing a variable before a block just so it survives the block
(`result = nil` before an `each`) is the smell in reverse — restructure so the value is
produced by an expression instead.

## Mechanics

1. Find all uses of the variable and identify the narrowest enclosing scope (branch,
   block, or method) that contains them all.
2. Move the assignment into that scope, ensuring no use is left outside it.
3. Run the tests.
4. For an instance variable used by one method, convert it to a local in that method,
   run the tests, and delete the field.

## Example

Before:

```ruby
def report(orders)
  discount = current_discount   # only used in the branch below
  lines = orders.map(&:to_line)
  if bulk?(orders)
    lines << "Bulk discount: #{discount}"
  end
  lines.join("\n")
end
```

After:

```ruby
def report(orders)
  lines = orders.map(&:to_line)
  if bulk?(orders)
    discount = current_discount
    lines << "Bulk discount: #{discount}"
  end
  lines.join("\n")
end
```

## Related

- One variable per purpose: [Split Variable](split-variable.md)
- Declare-then-assign noise: [Replace Assignment with Initialization](replace-assignment-with-initialization.md)
- The usual next step: [Extract Function](extract-function.md)
- Eliminate the temp entirely: [Replace Temp with Query](replace-temp-with-query.md)
