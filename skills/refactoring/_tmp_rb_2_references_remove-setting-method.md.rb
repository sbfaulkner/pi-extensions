class Person
  attr_accessor :name
  attr_reader :id

  def initialize(id)
    @id = id
  end
end
