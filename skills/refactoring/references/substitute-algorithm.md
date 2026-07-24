# Substitute Algorithm

**Tag:** encapsulation

## Motivation

When you find a clearer way to do the same thing an existing block of code does — a simpler
library call, a cleaner algorithm — replace the whole algorithm rather than tweaking it.
This only works safely when the code is decomposed into a well-defined function you can
reason about; if it isn't, extract it first. Make sure you fully understand the existing
behavior, and that your tests cover it, before swapping.

## Mechanics

1. Arrange the code to be replaced into a single, self-contained function.
2. Prepare tests that thoroughly exercise this function, to capture its behavior.
3. Write the replacement algorithm.
4. Run the old and new against the tests. If results match, you're done; if not, use the
   old algorithm as the reference to debug the new one.

## Example

Before — a manual loop to find a match:

```ruby
def found_person(people)
  people.each do |person|
    return "Don" if person == "Don"
    return "John" if person == "John"
    return "Kent" if person == "Kent"
  end
  ""
end
```

After substituting a clearer algorithm:

```ruby
def found_person(people)
  candidates = %w[Don John Kent]
  people.find { |p| candidates.include?(p) } || ""
end
```

## Related

- May require [Extract Function](extract-function.md) first
- Replace loops with pipelines: [Replace Loop with Pipeline](replace-loop-with-pipeline.md)
