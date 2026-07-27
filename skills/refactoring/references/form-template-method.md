# Form Template Method

**Tag:** dealing-with-inheritance · **Source:** *Refactoring* (1st edition)

## Motivation

Two subclass methods perform the same *sequence of steps*, but the steps themselves differ.
Pull the sequence up into the superclass as a **template method** that calls abstract (or
overridable) step methods; each subclass implements just its own steps. The skeleton then
lives in one place, and adding a variant means implementing steps, not copying structure.
In Ruby, first consider [Extract Surrounding Method](extract-surrounding-method.md) — a
block often does the job without demanding an inheritance relationship; use Form Template
Method when the classes already share a meaningful hierarchy.

**With Sorbet:** the pattern gets checkable — mark the superclass `abstract!`, declare the
step methods `sig { abstract }`, and the checker enforces that every subclass implements
every step.

## Mechanics

1. Decompose each variant method so the differing code is isolated into step methods with
   identical signatures across the subclasses ([Extract Function](extract-function.md),
   then [Change Function Declaration](change-function-declaration.md) to align names).
2. Run the tests.
3. Pull the now-identical skeleton method up to the superclass
   ([Pull Up Method](pull-up-method.md)).
4. Declare the step methods on the superclass (abstract, or with default implementations).
5. Run the tests.

## Example

Before — two statements share a shape, not code:

```ruby
class ResidentialSite < Site
  def bill
    base = units * RESIDENTIAL_RATE
    tax = base * TAX_RATE
    base + tax
  end
end

class LifelineSite < Site
  def bill
    base = units * LIFELINE_RATE * 0.5
    tax = base * TAX_RATE * 0.2
    base + tax
  end
end
```

After forming a template method:

```ruby
class Site
  def bill
    base_amount + tax_amount
  end

  def base_amount
    raise NotImplementedError
  end

  def tax_amount
    raise NotImplementedError
  end
end

class ResidentialSite < Site
  def base_amount = units * RESIDENTIAL_RATE
  def tax_amount = base_amount * TAX_RATE
end

class LifelineSite < Site
  def base_amount = units * LIFELINE_RATE * 0.5
  def tax_amount = base_amount * TAX_RATE * 0.2
end
```

## Related

- Block-based alternative without inheritance: [Extract Surrounding Method](extract-surrounding-method.md)
- Built on [Extract Function](extract-function.md), [Pull Up Method](pull-up-method.md)
- Kindred: [Replace Conditional with Polymorphism](replace-conditional-with-polymorphism.md)
