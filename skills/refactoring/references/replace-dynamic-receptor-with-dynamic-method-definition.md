# Replace Dynamic Receptor with Dynamic Method Definition

**Tag:** basic · **Source:** *Refactoring: Ruby Edition*

## Motivation

`method_missing` is the sharpest tool in Ruby's box: it breaks `respond_to?`, produces
`NoMethodError`s far from their true cause, silently swallows typos, and defeats
documentation, grep, and tooling. When the set of dynamic methods is *knowable* — derived
from attributes, a fixed list, or discoverable data — you don't need a dynamic receptor at
all: define the methods up front with `define_method`. The object then genuinely has the
methods, and every tool that inspects it works again.

**With Sorbet:** `method_missing` dispatch is untypeable, full stop. `define_method` is at
least made checkable via RBI/tapioca. This refactoring is the standard first step in typing
legacy metaprogrammed code.

## Mechanics

1. Determine the full set of method names `method_missing` responds to (from the data or
   conditions it inspects).
2. Add a `define_method`-based definition for that set (at class-definition time, or when
   the driving data is loaded).
3. Run the tests.
4. Remove `method_missing` (and `respond_to_missing?`).
5. Run the tests — failures here reveal dynamic calls you hadn't accounted for.

## Example

Before — a dynamic receptor for `title_from_user`-style calls:

```ruby
class Decorator
  def initialize(subject)
    @subject = subject
  end

  def method_missing(sym, *args, &block)
    if sym.to_s =~ /^(.+)_from_user$/
      @subject.send(Regexp.last_match(1), *args)
    else
      super
    end
  end
end
```

After defining the methods up front:

```ruby
class Decorator
  def initialize(subject)
    @subject = subject
    subject.public_methods(false).each do |meth|
      self.class.send(:define_method, "#{meth}_from_user") do |*args|
        subject.send(meth, *args)
      end
    end
  end
end
```

## Related

- When the receptor must stay dynamic: [Isolate Dynamic Receptor](isolate-dynamic-receptor.md)
- The core technique: [Dynamic Method Definition](dynamic-method-definition.md)
