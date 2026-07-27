# Extract Surrounding Method

**Tag:** basic · **Source:** *Refactoring: Ruby Edition*

## Motivation

Two methods sometimes share identical code at the *start and end* but differ in the middle
— a shape plain [Extract Function](extract-function.md) can't capture, and the classic
inheritance answer (Form Template Method) forces a class hierarchy just to share the
wrapper. Ruby blocks dissolve the problem: extract the surrounding duplication into one
method that `yield`s to a block for the unique middle part. Common examples: setup/teardown
around an operation, connection open/close, transaction wrapping.

## Mechanics

1. Identify the duplicated surrounding code and the varying middle in each method.
2. Create a new method containing the surrounding code, with `yield` where the middle goes.
   If the middle needs values computed by the surround, pass them as block arguments.
3. Change one of the original methods to call the new method, passing its unique code as a
   block.
4. Run the tests.
5. Repeat for each remaining method, running tests after each.

## Example

Before — identical tree-walking, different matching:

```ruby
class Person
  def number_of_living_descendants
    children.inject(0) do |count, child|
      count += 1 if child.alive?
      count + child.number_of_living_descendants
    end
  end

  def number_of_descendants_named(name)
    children.inject(0) do |count, child|
      count += 1 if child.name == name
      count + child.number_of_descendants_named(name)
    end
  end
end
```

After extracting the surrounding walk:

```ruby
class Person
  def number_of_living_descendants
    count_descendants_matching(&:alive?)
  end

  def number_of_descendants_named(name)
    count_descendants_matching { |descendant| descendant.name == name }
  end

  private

  def count_descendants_matching(&block)
    children.inject(0) do |count, child|
      count += 1 if yield(child)
      count + child.count_descendants_matching(&block)
    end
  end
end
```

## Related

- The block-based answer to what Form Template Method solves with inheritance
- Plain duplication at one end only: [Extract Function](extract-function.md)
- Shared statements around a call: [Move Statements into Function](move-statements-into-function.md)
