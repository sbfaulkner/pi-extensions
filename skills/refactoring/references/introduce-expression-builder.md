# Introduce Expression Builder

**Tag:** moving-features · **Source:** *Refactoring: Ruby Edition*

## Motivation

Sometimes a library's API is serviceable but its call sites read badly — positional
arguments, awkward hashes, multi-step setup. An **expression builder** is a thin fluent
facade over the API: client code reads as a sentence, while the builder translates the
fluent calls into the underlying interface. Use it when readability at many call sites
justifies maintaining the facade; for one or two call sites it's over-engineering. This is
how test frameworks earn `expect(x).to eq(y)`-style surfaces over plainer machinery.

## Mechanics

1. Create a builder class whose methods mirror how you *want* call sites to read, each
   returning `self` (or the next builder in the sentence).
2. Have the terminal method (or the builder internally) invoke the underlying API.
3. Migrate one call site to the builder; run the tests.
4. Repeat for the remaining call sites; keep direct API use and builder use from mixing in
   the same code.

## Example

Before — the raw API forces a hash at every call site:

```ruby
http.request(:get, "/books", { params: { author: "fowler" }, headers: { "Accept" => "application/json" } })
```

After introducing an expression builder:

```ruby
class RequestBuilder
  def initialize(http)
    @http = http
    @params = {}
    @headers = {}
  end

  def get(path)
    @method = :get
    @path = path
    self
  end

  def param(key, value)
    @params[key] = value
    self
  end

  def accept_json
    @headers["Accept"] = "application/json"
    self
  end

  def execute
    @http.request(@method, @path, { params: @params, headers: @headers })
  end
end

RequestBuilder.new(http).get("/books").param(:author, "fowler").accept_json.execute
```

## Related

- The chaining technique it's built on: [Replace Temp with Chain](replace-temp-with-chain.md)
- Encapsulating *where* an external system is used: [Introduce Gateway](introduce-gateway.md)
