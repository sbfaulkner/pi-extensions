# Replace Subclass with Delegate

**Tag:** dealing-with-inheritance

## Motivation

Inheritance is a single, one-shot form of extension: a class can vary along only one axis, the
choice is fixed at instantiation, and it tightly couples subclass to superclass. When these
limits bite — you need to vary along several dimensions, or change the "type" at runtime —
replace the subclass with a delegate object. Delegation ("favor composition over inheritance")
is more flexible: you can swap the delegate, combine several, and keep the classes loosely
coupled.

## Mechanics

1. If the constructor has many callers, apply [Replace Constructor with Factory Function](replace-constructor-with-factory-function.md).
2. Create an empty delegate class for the subclass's behavior; its constructor takes any
   subclass-specific parameters plus a back-reference to the superclass instance.
3. Add a field to the superclass to hold the delegate.
4. Move each subclass method to the delegate class, one at a time. Where the superclass needs
   to dispatch to the delegate, add the dispatch (checking for the delegate's presence). Run
   tests after each.
5. Once all behavior is moved, remove the subclass.
6. Run the tests.

## Example

After the refactoring, a "premium" booking that used to be a subclass becomes a delegate:

```ruby
class Booking
  attr_reader :show

  def initialize(show, date)
    @show = show
    @date = date
    @premium_delegate = nil
  end

  def be_premium(extras)
    @premium_delegate = PremiumBookingDelegate.new(self, extras)
  end

  def has_talkback?
    if @premium_delegate
      @premium_delegate.has_talkback?
    else
      @show.has_own_talkback? && !weekend?
    end
  end
end

class PremiumBookingDelegate
  def initialize(host_booking, extras)
    @host = host_booking
    @extras = extras
  end

  def has_talkback?
    @host.show.has_own_talkback?
  end
end
```

## Related

- Superclass equivalent: [Replace Superclass with Delegate](replace-superclass-with-delegate.md)
- Uses [Replace Constructor with Factory Function](replace-constructor-with-factory-function.md), [Move Function](move-function.md)
- Reverse (toward inheritance): [Remove Subclass](remove-subclass.md)
