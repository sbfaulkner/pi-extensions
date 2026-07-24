# Replace Function with Command

**Tag:** refactoring-apis · **Alias:** Replace Method with Method Object · **Inverse:** [Replace Command with Function](replace-command-with-function.md)

## Motivation

A **command object** encapsulates a request as an object — it wraps a single function with
methods and fields. That extra structure buys you a lot: you can parameterize and stage the
call, break a complex function into methods that share state via fields (great for a big
function riddled with local variables), support undo, and so on. When a function is large and
complex — especially with many interrelated locals that make [Extract Function](extract-function.md)
awkward — turn it into a command so those locals become fields.

## Mechanics

1. Create an empty class for the function, named after it. Add a method (e.g., `execute` or
   `call`) to run it.
2. Move the function body into the command's execute method (use [Move Function](move-function.md)),
   keeping the original function delegating to the command for now.
3. Move each argument of the function into the command's constructor as a field.
4. Run the tests after each move.
5. Now you can freely [Extract Function](extract-function.md) within the command, since shared
   locals are fields.

## Example

Before — a gnarly scoring function with many locals:

```ruby
def score(candidate, medical_exam, scoring_guide)
  result = 0
  health_level = 0
  # ... many interdependent local variables and steps ...
  result
end
```

After converting to a command object:

```ruby
class Scorer
  def initialize(candidate, medical_exam, scoring_guide)
    @candidate = candidate
    @medical_exam = medical_exam
    @scoring_guide = scoring_guide
  end

  def execute
    @result = 0
    @health_level = 0
    score_smoking
    # ... extracted steps share state via instance variables ...
    @result
  end

  private

  def score_smoking
    # ...
  end
end

def score(candidate, medical_exam, scoring_guide)
  Scorer.new(candidate, medical_exam, scoring_guide).execute
end
```

## Related

- Inverse: [Replace Command with Function](replace-command-with-function.md)
- Uses [Move Function](move-function.md), [Extract Function](extract-function.md)
