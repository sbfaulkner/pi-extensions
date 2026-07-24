# Replace Abstract Superclass with Module

**Tag:** dealing-with-inheritance · **Source:** *Refactoring: Ruby Edition*

## Motivation

An abstract superclass that exists only to share implementation — never instantiated, no
identity of its own — spends the subclasses' single inheritance slot on code reuse. In Ruby,
a module conveys "shares this behavior" without claiming "is-a": include it, keep the
inheritance slot free for a real is-a relationship, and mix the behavior into otherwise
unrelated classes when needed. Keep a superclass when the abstraction genuinely *is* a
parent type; switch to a module when it's just a bundle of shared methods.

**With Sorbet:** modules can carry the same rigor a superclass did — `abstract!` with
`sig { abstract }` methods, `interface!` for pure interfaces, `requires_ancestor` to
declare what the module expects of its host, and `mixes_in_class_methods` for the
`self.included` hook pattern.

## Mechanics

1. Create a module and move the superclass's methods into it (one at a time for a large
   class, running tests as you go).
2. Replace each subclass's inheritance declaration with `include` of the module.
3. Run the tests.
4. Delete the now-empty abstract superclass.
5. Run the tests.

## Example

Before — an abstract parent used only for reuse:

```ruby
class AbstractReport
  def generate
    header + body + footer
  end

  def header
    "== #{title} =="
  end

  def footer
    "-- end --"
  end
end

class SalesReport < AbstractReport
  def title = "Sales"
  def body = "..."
end
```

After replacing it with a module:

```ruby
module Reportable
  def generate
    header + body + footer
  end

  def header
    "== #{title} =="
  end

  def footer
    "-- end --"
  end
end

class SalesReport
  include Reportable

  def title = "Sales"
  def body = "..."
end
```

`SalesReport` keeps its superclass slot, and any class with `title`/`body` can be reportable.

## Related

- Extract shared behavior *into* a module in the first place: [Extract Module](extract-module.md)
- The superclass-based alternative: [Extract Superclass](extract-superclass.md)
- Composition-based alternative: [Replace Superclass with Delegate](replace-superclass-with-delegate.md)
