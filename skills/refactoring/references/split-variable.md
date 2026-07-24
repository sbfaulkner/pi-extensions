# Split Variable

**Tag:** organizing-data · **Aliases:** Remove Assignments to Parameters, Split Temp

## Motivation

A variable should have one responsibility. When a single variable is assigned more than
once — and not because it's a loop counter or a genuine accumulator — it's probably being
used for two different things. Split it into one variable per responsibility, each named for
its purpose and made immutable. This clarifies the code and is a prerequisite for
refactorings like [Replace Temp with Query](replace-temp-with-query.md). The same applies to
reassigned parameters: give the new value its own variable.

## Mechanics

1. Change the name of the variable at its first declaration and first uses, naming it for
   that first role. Make it immutable if the language allows.
2. Run the tests.
3. At the second assignment, declare the variable there as a new (immutable) variable with a
   name for its second role, and update subsequent uses.
4. Run the tests.
5. Repeat for each additional responsibility.

## Example

Before — `temp` means two different things:

```ruby
def distance_travelled(scenario, time)
  temp = 2 * (scenario[:primary_force] / scenario[:mass])
  primary_time = [time, scenario[:delay]].min
  result = 0.5 * temp * primary_time * primary_time

  temp = scenario[:secondary_force] / scenario[:mass]
  secondary_time = [0, time - scenario[:delay]].max
  result += primary_time * temp * secondary_time
  result
end
```

After splitting into two well-named acceleration variables:

```ruby
def distance_travelled(scenario, time)
  primary_acceleration = 2 * (scenario[:primary_force] / scenario[:mass])
  primary_time = [time, scenario[:delay]].min
  result = 0.5 * primary_acceleration * primary_time * primary_time

  secondary_acceleration = scenario[:secondary_force] / scenario[:mass]
  secondary_time = [0, time - scenario[:delay]].max
  result += primary_time * secondary_acceleration * secondary_time
  result
end
```

## Related

- Enables [Replace Temp with Query](replace-temp-with-query.md)
- Rename once split: [Rename Variable](rename-variable.md)
