# Duplicate Observed Data

**Tag:** organizing-data · **Source:** *Refactoring* (1st edition)

## Motivation

*Largely historical.* Domain data living inside GUI widget code can't be used by domain
logic without dragging the presentation along. The 1st-edition mechanics copy the data into
a domain object and keep the two synchronized with the Observer pattern. The *principle* —
**separate domain data from presentation** — is as vital as ever; the *mechanics* have been
absorbed by framework data-binding (and by server-rendered or reactive architectures that
never trap domain state in widgets). Reach for this only when working in a legacy
widget-holds-the-data GUI without binding support.

## Mechanics

1. Create a domain class for the data and give the presentation class a reference to it.
2. Make the presentation observe the domain object (or otherwise subscribe to changes).
3. For each piece of data, move ownership to the domain object: widget events update the
   domain object; the observation updates the widget from it. Run tests after each piece.
4. Move behavior that used the widget copies onto the domain object.

## Example

Sketch — an interval widget whose fields become domain state:

```ruby
class IntervalWindow
  def initialize
    @interval = Interval.new
    @interval.add_observer(self)
  end

  def start_field_changed(text)
    @interval.start = text # domain owns the data...
  end

  def update(interval)
    start_field.text = interval.start # ...widget reflects it
  end
end

class Interval
  include Observable

  attr_reader :start

  def start=(value)
    @start = value
    changed
    notify_observers(self)
  end
end
```

## Related

- The underlying separation at architecture scale: [Split Phase](split-phase.md)
- Moving data/behavior to its right home: [Move Field](move-field.md), [Move Function](move-function.md)
