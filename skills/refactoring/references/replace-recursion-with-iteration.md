# Replace Recursion with Iteration

**Tag:** moving-features · **Source:** refactoring.com catalog (guest entry, Ivan Mitrovic) · **Inverse:** [Replace Iteration with Recursion](replace-iteration-with-recursion.md)

## Motivation

Recursion that is hard to follow — or that recurses deeply enough to threaten the stack —
is a smell. Tail recursion (where the recursive call is the last thing the method does) is
mechanically convertible to a loop, which in Ruby also removes the `SystemStackError` risk
since MRI does not optimize tail calls by default. Non-tail recursion can be converted by
managing an explicit stack (a Ruby `Array` with `push`/`pop`), which trades elegance for
control over memory and depth.

## Mechanics

1. Identify the base case — the condition under which the recursion stops. Every recursion
   must have one, and every recursive call must make progress toward it.
2. For tail recursion: wrap the body in a loop that runs until the base case holds, and
   replace the recursive call with reassignment of the loop's variables. Run the tests.
3. For non-tail recursion: introduce an explicit stack holding the state each call would
   have kept on the call stack; loop while the stack is non-empty. Run the tests.
4. If the result is convoluted, consider [Substitute Algorithm](substitute-algorithm.md)
   instead of a mechanical conversion.

## Example

Before (tail recursion):

```ruby
def countdown(n)
  return if n.zero?

  puts "#{n}..."
  countdown(n - 1)
end
```

After:

```ruby
def countdown(n)
  while n.positive?
    puts "#{n}..."
    n -= 1
  end
end
```

Non-tail recursion converted with an explicit stack:

```ruby
def total_size(dir)
  stack = [dir]
  total = 0
  until stack.empty?
    entry = stack.pop
    if entry.directory?
      stack.concat(entry.children)
    else
      total += entry.size
    end
  end
  total
end
```

## Related

- Inverse: [Replace Iteration with Recursion](replace-iteration-with-recursion.md)
- The escape hatch for nasty recursion: [Substitute Algorithm](substitute-algorithm.md)
- Once iterative, consider [Replace Loop with Pipeline](replace-loop-with-pipeline.md)
