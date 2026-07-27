# Introduce Gateway

**Tag:** moving-features · **Source:** *Refactoring: Ruby Edition*

## Motivation

When application code talks to an external system (HTTP APIs, message queues, third-party
SDKs) directly, the external interface's vocabulary and quirks leak everywhere it's used —
and tests must stub the wire. A **gateway** is one object that encapsulates all access to
the external system behind an interface shaped by *your application's* needs. Client code
reads in domain terms, the external dependency is swappable, and tests get a single,
obvious seam.

**With Sorbet:** declare the gateway as an `interface!` module with a production
implementation; test fakes then implement the same interface and the type checker keeps
fake and real in sync — the classic drift problem with hand-rolled stubs.

## Mechanics

1. Create a gateway class exposing only the operations your application needs, named in
   domain terms.
2. Move the external-system calls (connection setup, serialization, error translation)
   into the gateway.
3. Change one call site to use the gateway; run the tests.
4. Repeat for each remaining call site, then confine the external library's require/usage
   to the gateway file.

## Example

Before — HTTP details in domain code:

```ruby
class WeatherReport
  def for_city(city)
    response = Net::HTTP.get_response(URI("https://weather.example.com/v1/#{city}"))
    raise "weather service error" unless response.code == "200"

    JSON.parse(response.body)["forecast"]
  end
end
```

After introducing a gateway:

```ruby
class WeatherGateway
  def initialize(host = "weather.example.com")
    @host = host
  end

  def forecast(city)
    response = Net::HTTP.get_response(URI("https://#{@host}/v1/#{city}"))
    raise WeatherUnavailableError unless response.code == "200"

    JSON.parse(response.body)["forecast"]
  end
end

class WeatherReport
  def initialize(gateway = WeatherGateway.new)
    @gateway = gateway
  end

  def for_city(city)
    @gateway.forecast(city)
  end
end
```

Domain code now speaks `forecast`; tests inject a fake gateway.

## Related

- Fluent wrapper when the pain is API *shape* rather than API *location*: [Introduce Expression Builder](introduce-expression-builder.md)
- Kindred encapsulations: [Hide Delegate](hide-delegate.md), [Encapsulate Variable](encapsulate-variable.md)
