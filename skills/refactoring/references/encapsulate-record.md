# Encapsulate Record

**Tag:** encapsulation · **Alias:** Replace Record with Data Class

## Motivation

Records (plain hashes/structs) are convenient but expose their structure and can't
distinguish stored fields from computed ones. Replacing a record with a class lets you hide
the internal representation, add computed accessors that look identical to stored ones, and
provide a clear, controlled interface — especially valuable for mutable data that's passed
around widely.

## Mechanics

1. [Encapsulate Variable](encapsulate-variable.md) for the variable holding the record.
2. Replace the record's value with a simple class that wraps the raw record; define an
   accessor that returns the class. Run the tests.
3. Provide getters/setters on the class for each field.
4. Replace each user of the raw record's fields with a call to the class accessor, one at a
   time, running tests.
5. Remove raw-structure access; hide the underlying data.

## Example

Before — a bare hash used everywhere:

```ruby
organization = { name: "Acme Gooseberries", country: "GB" }
organization[:name]
```

After wrapping in a class:

```ruby
class Organization
  def initialize(data)
    @name = data[:name]
    @country = data[:country]
  end

  attr_accessor :name, :country
end

organization = Organization.new(name: "Acme Gooseberries", country: "GB")
organization.name
```

## Related

- Built on [Encapsulate Variable](encapsulate-variable.md)
- For collection fields: [Encapsulate Collection](encapsulate-collection.md)
- Wrap a primitive with meaning: [Replace Primitive with Object](replace-primitive-with-object.md)
