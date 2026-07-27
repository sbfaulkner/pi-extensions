# Introduce Local Extension

**Tag:** moving-features · **Source:** *Refactoring* (1st edition)

## Motivation

When one [foreign method](introduce-foreign-method.md) becomes several, scattered helpers
stop scaling — you want the methods grouped and dispatched like real methods. Build a
**local extension**: a subclass or a wrapper of the foreign class carrying your additions,
used in your code in place of the original. Ruby offers a third route — reopening the class
(monkey-patching) — which is idiomatic but *global*: every user of the class everywhere
sees your methods, name collisions strike at a distance, and upgrades can silently change
what you patched. Prefer the subclass/wrapper unless the extension is small, unambiguous,
and genuinely universal for your codebase. (Refinements scope a reopen lexically, but bring
their own surprises and tooling gaps.)

**With Sorbet:** the calculus tips further toward subclass/wrapper — reopened core/gem
classes require RBI shim maintenance, and Sorbet does not support refinements at all. A
subclass is just a class: sigs work, no shims.

## Mechanics

1. Create the extension class: subclass the foreign class (when construction is under your
   control), or wrap it (when instances come from elsewhere — accept one in the
   constructor and delegate).
2. Add converting constructors/factories as needed to produce the extension from the
   original.
3. Move your foreign methods onto it ([Move Function](move-function.md)), dropping the
   foreign-object parameter.
4. Use the extension in place of the original where the added behavior is needed.
5. Run the tests.

## Example

Before — foreign methods piling up:

```ruby
def next_day(date)
  Date.new(date.year, date.month, date.day + 1)
end

def workdays_until(date, other)
  # ...
end
```

After introducing a local extension by subclass:

```ruby
class MfDate < Date
  def next_day
    self.class.new(year, month, day + 1)
  end

  def workdays_until(other)
    # ...
  end
end

new_start = MfDate.new(2026, 7, 24).next_day
```

## Related

- The single-method starting point: [Introduce Foreign Method](introduce-foreign-method.md)
- Wrapper trade-offs at scale: [Replace Superclass with Delegate](replace-superclass-with-delegate.md)
