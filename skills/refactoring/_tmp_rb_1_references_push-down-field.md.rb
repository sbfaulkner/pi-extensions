class Employee
  def initialize
    @quota = nil
  end
end

class Salesperson < Employee; end
class Engineer < Employee; end
