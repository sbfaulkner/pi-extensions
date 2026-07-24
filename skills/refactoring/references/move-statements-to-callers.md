# Move Statements to Callers

**Tag:** moving-features · **Inverse:** [Move Statements into Function](move-statements-into-function.md)

## Motivation

Functions are the basic unit of abstraction, but abstraction boundaries drift. When a
function that used to do one coherent thing now needs to behave differently for some
callers, the common behavior may need to move *out* to the callers so each can vary it.
This is the reverse of [Move Statements into Function](move-statements-into-function.md).

## Mechanics

1. For a simple case with few callers, cut the statements from the function, paste them into
   each caller, and run tests.
2. Otherwise, apply [Extract Function](extract-function.md) to the code you want to *keep*
   inside the function, giving it a temporary name.
3. Use [Inline Function](inline-function.md) on the original function. Every caller now has
   the full body inline, including the statements you want to move.
4. Apply [Change Function Declaration](change-function-declaration.md) to rename the extracted
   function back to the original name.
5. Run the tests.

## Example

Before — `emit_photo_data` also prints the location, which only some callers want:

```ruby
def render_person(person)
  emit_photo_data(person[:photo])
end

def list_recent_photos(photos)
  photos.each { |p| emit_photo_data(p) }
end

def emit_photo_data(photo)
  puts "<p>title: #{photo[:title]}</p>"
  puts "<p>location: #{photo[:location]}</p>"
end
```

After moving the location line to callers so each can decide:

```ruby
def render_person(person)
  emit_photo_data(person[:photo])
  puts "<p>location: #{person[:photo][:location]}</p>"
end

def list_recent_photos(photos)
  photos.each do |p|
    emit_photo_data(p)
    puts "<p>location: #{p[:location]}</p>"
  end
end

def emit_photo_data(photo)
  puts "<p>title: #{photo[:title]}</p>"
end
```

## Related

- Inverse: [Move Statements into Function](move-statements-into-function.md)
- Uses [Extract Function](extract-function.md), [Inline Function](inline-function.md), [Change Function Declaration](change-function-declaration.md)
