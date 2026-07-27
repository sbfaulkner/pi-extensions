# Replace Conditional with Visitor

**Tag:** simplify-conditional-logic · **Source:** refactoring.com catalog (guest entry, Martin Fowler)

## Motivation

You have a type-switching conditional that repeats across *many operations*: every
function that works with the type family re-implements the same `case`. Ordinary
[Replace Conditional with Polymorphism](replace-conditional-with-polymorphism.md) moves
one operation onto the classes; if you have many operations (and keep adding more), that
bloats the classes with unrelated behavior. The Visitor pattern inverts the axis: each
*operation* becomes a class, and double dispatch (`node.accept(visitor)` calling back
`visitor.visit_<type>(node)`) replaces every conditional.

This is the heavyweight option. Reach for it only when operations multiply faster than
types; if types multiply faster, plain polymorphism is better. **With Sorbet** (editorial
— the catalog predates it): a `sealed!` hierarchy with exhaustive `case` and `T.absurd`
gives you the compiler-checked "did I handle every type?" guarantee that is Visitor's main
selling point, without the double-dispatch machinery — prefer that unless you need the
pattern's pluggability.

## Mechanics

1. Ensure the type family is a real class hierarchy; if the conditional switches on a type
   code, first apply [Replace Type Code with Subclasses](replace-type-code-with-subclasses.md).
2. Add an `accept(visitor)` method to each class in the family, calling the
   visitor method named for that class. Run the tests.
3. Pick one conditional-riddled operation. Create a visitor class with one `visit_<type>`
   method per branch, moving each branch's body into the matching method.
4. Replace the conditional with `subject.accept(visitor)`. Run the tests.
5. Repeat for each remaining operation, one visitor class at a time, running tests after
   each.

## Example

Before — every operation repeats the type switch:

```ruby
def evaluate(node)
  case node
  when Literal then node.value
  when Addition then evaluate(node.left) + evaluate(node.right)
  end
end

def print(node)
  case node
  when Literal then node.value.to_s
  when Addition then "(#{print(node.left)} + #{print(node.right)})"
  end
end
```

After — each operation is a visitor; the nodes dispatch once:

```ruby
class Literal
  def accept(visitor) = visitor.visit_literal(self)
end

class Addition
  def accept(visitor) = visitor.visit_addition(self)
end

class Evaluator
  def visit_literal(node) = node.value
  def visit_addition(node) = node.left.accept(self) + node.right.accept(self)
end

class Printer
  def visit_literal(node) = node.value.to_s
  def visit_addition(node) = "(#{node.left.accept(self)} + #{node.right.accept(self)})"
end
```

Adding a new operation is now a new visitor class; the node classes never change.

## Related

- One operation, or types growing faster than operations: [Replace Conditional with Polymorphism](replace-conditional-with-polymorphism.md)
- Prerequisite when switching on a type code: [Replace Type Code with Subclasses](replace-type-code-with-subclasses.md)
- Move the operation wholesale instead: [Move Function](move-function.md)
