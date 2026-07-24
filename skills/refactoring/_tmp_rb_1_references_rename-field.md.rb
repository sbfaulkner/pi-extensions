class Organization
  def initialize(data)
    @name = data[:name]
  end

  attr_accessor :name
end
