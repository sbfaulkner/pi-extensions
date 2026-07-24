# Replace Conditional with Polymorphism

**Tag:** simplify-conditional-logic

## Motivation

Complex conditional logic that switches on a **type** (or type code) is a classic candidate
for polymorphism. Instead of one function with a `case` that varies its behavior by type,
create a class per case and let the language's dispatch pick the right variant. This is
especially powerful for the **Repeated Switches** smell — the same switch structure appears
in several places, so adding a type means finding and updating every one. With
polymorphism, a new type is a new subclass in one place.

Use it for two shapes:
- A switch that selects behavior based on a type — move each leg into an overriding method.
- Logic that is mostly a common "base" case with a few variants — put the base in a
  superclass method and let subclasses override just the differences.

Don't reach for it when a simple conditional is clear enough; polymorphism adds structure
that only pays off when there's real variation.

## Mechanics

1. If the classes that will host the polymorphic behavior don't exist, create them, along
   with a factory function that returns the right instance for a given type. (You may need
   [Replace Type Code with Subclasses](replace-type-code-with-subclasses.md) or
   [Replace Primitive with Object](replace-primitive-with-object.md) first.)
2. Make the calling code use the factory to get an instance.
3. Move the conditional function into the superclass (use [Move Function](move-function.md)
   if needed). If the conditional is mixed with other logic, use
   [Extract Function](extract-function.md) first to isolate it.
4. Pick one subclass. Override the method in it with the corresponding leg of the
   conditional. Remove that leg from the superclass version.
5. Run the tests.
6. Repeat for each leg / subclass, one at a time.
7. When every leg has moved into a subclass, leave the superclass method with the default
   case (or make it abstract by raising `NotImplementedError`).
8. Run the tests.

## Example

Before — behavior switches on a bird's type:

```ruby
def plumage(bird)
  case bird[:type]
  when "EuropeanSwallow"
    "average"
  when "AfricanSwallow"
    bird[:number_of_coconuts] > 2 ? "tired" : "average"
  when "NorwegianBlueParrot"
    bird[:voltage] > 100 ? "scorched" : "beautiful"
  else
    "unknown"
  end
end
```

After replacing the conditional with polymorphism:

```ruby
class Bird
  def initialize(data)
    @data = data
  end

  def plumage
    "unknown"
  end
end

class EuropeanSwallow < Bird
  def plumage
    "average"
  end
end

class AfricanSwallow < Bird
  def plumage
    @data[:number_of_coconuts] > 2 ? "tired" : "average"
  end
end

class NorwegianBlueParrot < Bird
  def plumage
    @data[:voltage] > 100 ? "scorched" : "beautiful"
  end
end

def create_bird(data)
  klass = {
    "EuropeanSwallow" => EuropeanSwallow,
    "AfricanSwallow" => AfricanSwallow,
    "NorwegianBlueParrot" => NorwegianBlueParrot,
  }.fetch(data[:type], Bird)
  klass.new(data)
end

# call site:
create_bird(bird).plumage
```

Adding a new bird type is now a new subclass plus one factory entry — no switch to hunt
down.

## Related

- Often needs [Replace Type Code with Subclasses](replace-type-code-with-subclasses.md) or
  [Replace Primitive with Object](replace-primitive-with-object.md) first
- Uses [Move Function](move-function.md), [Extract Function](extract-function.md)
- Simpler alternatives when there's no type variation: [Decompose Conditional](decompose-conditional.md), [Replace Nested Conditional with Guard Clauses](replace-nested-conditional-with-guard-clauses.md)
- For null/special cases: [Introduce Special Case](introduce-special-case.md)
