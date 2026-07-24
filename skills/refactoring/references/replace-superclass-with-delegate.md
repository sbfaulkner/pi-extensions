# Replace Superclass with Delegate

**Tag:** dealing-with-inheritance · **Alias:** Replace Inheritance with Delegation

## Motivation

Inheritance is the wrong tool when the subclass doesn't truly satisfy "is-a" — when it only
inherited from a class to reuse some functionality, or when it uses only part of the
superclass's interface. That couples them tightly and lets the superclass's changes ripple
into the subclass unexpectedly (and risks breaking the Liskov Substitution Principle). Replace
the inheritance with a field that delegates to an instance of the former superclass, exposing
only what's actually needed.

## Mechanics

1. Create a field in the subclass that holds an instance of the (former) superclass, and
   initialize it.
2. For each element of the superclass used by the subclass, add a forwarding method that
   delegates to the field. Run tests after each.
3. Remove the `< Superclass` inheritance declaration.
4. Run the tests.

## Example

Before — `Scroll` inherits from `CategoryItem` just to reuse its data:

```ruby
class Scroll < CategoryItem
  def initialize(id, title, tags, date_last_cleaned)
    super(id, title, tags)
    @last_cleaned = date_last_cleaned
  end
end
```

After delegating to a `CategoryItem`:

```ruby
class Scroll
  def initialize(id, title, tags, date_last_cleaned)
    @category_item = CategoryItem.new(id, title, tags)
    @last_cleaned = date_last_cleaned
  end

  def title
    @category_item.title
  end

  def has_tag?(tag)
    @category_item.has_tag?(tag)
  end
end
```

## Related

- Subclass equivalent: [Replace Subclass with Delegate](replace-subclass-with-delegate.md)
- Reduce over-delegation: [Remove Middle Man](remove-middle-man.md)
- Uses [Move Function](move-function.md)
