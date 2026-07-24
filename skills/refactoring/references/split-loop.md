# Split Loop

**Tag:** moving-features

## Motivation

A loop that does two different things is doing too much — you can't understand or modify one
behavior without engaging with the other. Splitting it into two loops, each doing one thing,
makes each independently understandable and sets up [Extract Function](extract-function.md)
on each. People worry about the performance of iterating twice, but that's rarely
significant; get the code clear first, and optimize later only if profiling demands it.

## Mechanics

1. Copy the loop.
2. Remove the duplicated logic so each loop does only one thing.
3. Run the tests.
4. Consider [Extract Function](extract-function.md) on each resulting loop.

## Example

Before — one loop computes both total salary and youngest age:

```ruby
def salary_and_youngest(people)
  youngest = people.empty? ? Float::INFINITY : people.first[:age]
  total_salary = 0
  people.each do |p|
    youngest = p[:age] if p[:age] < youngest
    total_salary += p[:salary]
  end
  "youngest: #{youngest}, total salary: #{total_salary}"
end
```

After splitting the loop (and using idiomatic Ruby aggregations):

```ruby
def total_salary(people)
  people.sum { |p| p[:salary] }
end

def youngest_age(people)
  people.map { |p| p[:age] }.min || Float::INFINITY
end

def salary_and_youngest(people)
  "youngest: #{youngest_age(people)}, total salary: #{total_salary(people)}"
end
```

## Related

- Usually followed by [Extract Function](extract-function.md)
- Replace loops with collection pipelines: [Replace Loop with Pipeline](replace-loop-with-pipeline.md)
