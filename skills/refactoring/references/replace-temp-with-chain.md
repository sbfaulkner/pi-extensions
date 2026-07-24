# Replace Temp with Chain

**Tag:** basic · **Source:** *Refactoring: Ruby Edition*

## Motivation

A temp that exists only to receive a sequence of calls on the *same* object is noise —
chain the calls instead. This requires the methods to return something chainable (often
`self`), and it's only appropriate when every call targets the same object: chaining *into
other objects* is the Message Chains smell ([Hide Delegate](hide-delegate.md) territory),
not this refactoring. Distinguish carefully: a fluent interface chains on one receiver;
a train wreck reaches through several.

## Mechanics

1. Confirm each method in the sequence is called on the same object.
2. Make the methods chainable: return `self` from each (or from the ones that don't already
   return a useful chainable value).
3. Run the tests.
4. Replace the temp-and-statements with a single chained expression.
5. Run the tests.

## Example

Before — a temp exists only to receive configuration calls:

```ruby
class Select
  def self.with_option(option)
    select = new
    select.options << option
    select
  end

  def options
    @options ||= []
  end

  def add_option(option)
    options << option
  end
end

select = Select.with_option(1999)
select.add_option(2000)
select.add_option(2001)
```

After making `add_option` chainable:

```ruby
class Select
  def self.with_option(option)
    new.and_option(option)
  end

  def options
    @options ||= []
  end

  def and_option(option)
    options << option
    self
  end
end

select = Select.with_option(1999).and_option(2000).and_option(2001)
```

## Related

- Chains across *different* objects are a smell: [Hide Delegate](hide-delegate.md)
- Fluent wrapper over a clumsy API: [Introduce Expression Builder](introduce-expression-builder.md)
- Remove a temp derived from an expression: [Inline Variable](inline-variable.md), [Replace Temp with Query](replace-temp-with-query.md)
