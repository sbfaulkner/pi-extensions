# Replace Iteration with Recursion

**Tag:** moving-features · **Source:** refactoring.com catalog (guest entry, Dave Whipp) · **Inverse:** [Replace Recursion with Iteration](replace-recursion-with-iteration.md)

## Motivation

Some loops are hard to read because it isn't obvious what each iteration accomplishes —
the loop invariant lives only in the author's head. A recursive function can be given a
meaningful name that states that invariant (in the classic example, "the gcd of `a` and
`b` is unchanged by each step"), turning an opaque loop into a self-describing definition.

Ruby caveat: MRI does not perform tail-call optimization by default, so deep recursion can
raise `SystemStackError`. Use this refactoring for readability when the depth is bounded;
for unbounded input, prefer the loop or [Replace Loop with Pipeline](replace-loop-with-pipeline.md).

## Mechanics

1. Identify the candidate loop. It should modify one or more locals and produce a result
   from their final values.
2. Extract the loop into a new function whose parameters are those locals
   ([Extract Function](extract-function.md)). Name it for the loop invariant. Run the tests.
3. Replace the loop body with a conditional: the terminating case returns the result; the
   other branches return a recursive call with appropriately advanced arguments.
4. Run the tests.
5. Simplify: stop mutating parameters, tighten the conditional structure.

## Example

Before:

```ruby
def gcd(a, b)
  while a != b
    if a > b
      a -= b
    else
      b -= a
    end
  end
  a
end
```

After:

```ruby
def gcd(a, b)
  if a > b
    gcd(a - b, b)
  elsif b > a
    gcd(a, b - a)
  else
    a
  end
end
```

Each call site now reads as the definition: the gcd of `a` and `b` equals the gcd of the
reduced pair.

## Related

- Inverse: [Replace Recursion with Iteration](replace-recursion-with-iteration.md)
- Often sufficient by itself: [Extract Function](extract-function.md) (naming the loop may be all you need)
- Replace the whole approach instead: [Substitute Algorithm](substitute-algorithm.md)
- Declarative alternative for collection loops: [Replace Loop with Pipeline](replace-loop-with-pipeline.md)
