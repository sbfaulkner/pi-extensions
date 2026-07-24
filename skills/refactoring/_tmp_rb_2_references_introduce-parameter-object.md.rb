class NumberRange
  attr_reader :min, :max

  def initialize(min, max)
    @min = min
    @max = max
  end

  def contains?(value)
    value >= min && value <= max
  end
end

def readings_outside_range(station, range)
  station[:readings].reject { |r| range.contains?(r[:temp]) }
end

range = NumberRange.new(
  operating_plan[:temperature_floor],
  operating_plan[:temperature_ceiling],
)
alerts = readings_outside_range(station, range)
