class Bird
  def initialize(data)
    @data = data
  end

  def plumage
    "unknown"
  end
end

class EuropeanSwallow < Bird
  def plumage
    "average"
  end
end

class AfricanSwallow < Bird
  def plumage
    @data[:number_of_coconuts] > 2 ? "tired" : "average"
  end
end

class NorwegianBlueParrot < Bird
  def plumage
    @data[:voltage] > 100 ? "scorched" : "beautiful"
  end
end

def create_bird(data)
  klass = {
    "EuropeanSwallow" => EuropeanSwallow,
    "AfricanSwallow" => AfricanSwallow,
    "NorwegianBlueParrot" => NorwegianBlueParrot,
  }.fetch(data[:type], Bird)
  klass.new(data)
end

# call site:
create_bird(bird).plumage
