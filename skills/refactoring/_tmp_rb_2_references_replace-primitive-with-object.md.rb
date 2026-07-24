class Priority
  LEGAL_VALUES = %w[low normal high rush].freeze

  def initialize(value)
    raise ArgumentError, "<#{value}> is invalid" unless LEGAL_VALUES.include?(value)

    @value = value
  end

  def to_s
    @value
  end

  def index
    LEGAL_VALUES.index(@value)
  end

  def higher_than?(other)
    index > other.index
  end
end

order.priority.higher_than?(Priority.new("normal"))
