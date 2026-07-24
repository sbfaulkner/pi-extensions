# Dynamic Method Definition

**Tag:** basic · **Source:** *Refactoring: Ruby Edition*

## Motivation

When several methods are mechanical variations of one pattern, defining them one by one
buries the pattern in repetition. `define_method` in a loop expresses the pattern once and
makes the full set of generated methods explicit and greppable — unlike `method_missing`,
which hides them entirely. Use it when the duplication is truly mechanical; if the methods
have interesting individual behavior, explicit definitions read better.

**With Sorbet:** dynamically defined methods are invisible to the type checker without RBI
files or a tapioca DSL compiler. In a typed codebase, prefer explicit definitions unless the
method set is large or externally driven — and if you inherit `method_missing` code, moving
it to `define_method` is still a strict improvement (see
[Replace Dynamic Receptor with Dynamic Method Definition](replace-dynamic-receptor-with-dynamic-method-definition.md)).

## Mechanics

1. Identify the methods that share one mechanical pattern.
2. Write a `define_method` loop (or a class annotation) that generates them from data.
3. Delete the handwritten definitions.
4. Run the tests.

## Example

Before — three definitions, one pattern:

```ruby
class Post
  def failure
    self.state = "failure"
  end

  def error
    self.state = "error"
  end

  def success
    self.state = "success"
  end
end
```

After defining them dynamically:

```ruby
class Post
  %w[failure error success].each do |method_name|
    define_method(method_name) do
      self.state = method_name
    end
  end
end
```

## Related

- Fix `method_missing` with this: [Replace Dynamic Receptor with Dynamic Method Definition](replace-dynamic-receptor-with-dynamic-method-definition.md)
- Wrap the pattern declaratively: [Introduce Class Annotation](introduce-class-annotation.md)
- String-eval variant and its cost: [Move Eval from Runtime to Parse Time](move-eval-from-runtime-to-parse-time.md)
