# Isolate Dynamic Receptor

**Tag:** basic · **Source:** *Refactoring: Ruby Edition*

## Motivation

Sometimes `method_missing` is genuinely warranted — proxies, query builders, test doubles —
because the method set is unbounded or unknowable. The mistake is putting it on a class
that also has ordinary behavior: now *every* method call on that class has ambiguous
dispatch, and a typo anywhere becomes a confusing runtime surprise. Confine the dynamic
behavior to a small, dedicated class whose *only* job is dynamic reception; the original
class keeps a fully static, predictable interface and hands out the dynamic object
explicitly.

**With Sorbet:** this is the containment strategy for unavoidable `method_missing` — the
host class stays fully typed, and the untypeable surface shrinks to one small class you can
mark `T.untyped` at its boundary.

## Mechanics

1. Create a new class to hold the dynamic behavior (often taking the original object or its
   data in the constructor).
2. Move `method_missing` (and `respond_to_missing?`) to the new class.
3. On the original class, expose the new class through an intention-revealing method.
4. Update callers of the dynamic behavior to go through that method.
5. Run the tests.

## Example

Before — `method_missing` for `find_by_*` lives on the main class:

```ruby
class Recorder
  def method_missing(sym, *args)
    @messages ||= []
    @messages << [sym, args]
    self
  end

  def replay_on(subject)
    @messages.each { |sym, args| subject.send(sym, *args) }
  end
end
```

After isolating the dynamic receptor:

```ruby
class MessageCollector
  attr_reader :messages

  def initialize
    @messages = []
  end

  def method_missing(sym, *args)
    @messages << [sym, args]
    self
  end
end

class Recorder
  def record
    @collector ||= MessageCollector.new
  end

  def replay_on(subject)
    record.messages.each { |sym, args| subject.send(sym, *args) }
  end
end

# usage is now explicit about where the dynamic surface begins:
recorder.record.upcase.reverse
```

## Related

- When the method set is knowable, eliminate the receptor instead: [Replace Dynamic Receptor with Dynamic Method Definition](replace-dynamic-receptor-with-dynamic-method-definition.md)
- Structural cousin: [Extract Class](extract-class.md)
