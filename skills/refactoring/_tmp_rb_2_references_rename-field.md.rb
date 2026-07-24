class Organization
  def initialize(data)
    @title = data[:title] || data[:name]
  end

  attr_accessor :title
end
