# Replace Loop with Pipeline

**Tag:** moving-features

## Motivation

Collection pipelines (`map`, `select`, `reject`, `sum`, etc.) let you describe processing as
a sequence of operations, each transforming the collection and feeding the next. Reading a
pipeline top to bottom tells you exactly how elements flow through, which is far clearer
than a loop that mixes iteration with accumulation. Ruby's `Enumerable` is ideal for this.

## Mechanics

1. Create a variable for the loop's collection (a copy is fine, so you don't disturb the
   original).
2. Starting at the top of the loop, take each bit of behavior and replace it with a pipeline
   operation on that variable, moving the operation out of the loop. Run tests after each.
3. When the loop is empty, remove it and assign the pipeline's result where the loop's
   result was used.
4. Run the tests.

## Example

Before — a loop filtering and collecting office names:

```ruby
def acquire_data(input)
  result = []
  input.each_line.with_index do |line, i|
    next if i.zero? # skip header
    next if line.strip.empty?

    fields = line.split(",")
    result << fields[1].strip if fields[0].strip == "India"
  end
  result
end
```

After converting to a pipeline:

```ruby
def acquire_data(input)
  input.each_line.drop(1)
       .reject { |line| line.strip.empty? }
       .map { |line| line.split(",") }
       .select { |fields| fields[0].strip == "India" }
       .map { |fields| fields[1].strip }
end
```

## Related

- First split multi-purpose loops with [Split Loop](split-loop.md)
- Swap the algorithm wholesale: [Substitute Algorithm](substitute-algorithm.md)
